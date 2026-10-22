/// <reference lib="webworker" />
/**
 * Compiles C++ in the browser with Clang/LLVM compiled to WebAssembly
 * (@yowasp/clang, prepared into public/cxx by scripts/prepare-cxx.mjs). The
 * compiler is big (~40 MB download, cached by the browser), so this worker is
 * kept alive across runs; programs run in the C runner worker.
 */
import flags from "./flags.json";
import type { CxxCompilerEvent, CxxCompilerRequest } from "./protocol";

declare const self: DedicatedWorkerGlobalScope;

type Tree = { [name: string]: Tree | string | Uint8Array };
type Command = (args: string[] | null, files?: Tree, options?: Record<string, unknown>) => Promise<Tree | undefined>;
interface ClangModule {
  setResources: (resources: {
    modules: () => Promise<Record<string, WebAssembly.Module>>;
    filesystem: (unpackTar: (tar: ArrayBuffer) => Tree) => Promise<Record<string, Tree>>;
  }) => void;
  commands: Record<"clang++", Command>;
}

interface Manifest {
  version: string;
  sizes: Record<string, number>;
}

const CORES = ["llvm.core.wasm", "llvm.core2.wasm", "llvm.core3.wasm", "llvm.core4.wasm"];
const WORK_DIR = "/work";

const post = (event: CxxCompilerEvent) => self.postMessage(event);

/** Download progress goes to whichever run is waiting for the compiler. */
let progressListener: ((loaded: number, total: number) => void) | null = null;

/** Fetch a gzipped file (reporting progress) and decompress it. */
const fetchGz = async (url: string, onBytes: (n: number) => void): Promise<ArrayBuffer> => {
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error(`Could not load the C++ compiler (${response.status})`);
  const counted = response.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        onBytes(chunk.length);
        controller.enqueue(chunk);
      },
    }),
  );
  const bytes = new Uint8Array(await new Response(counted).arrayBuffer());
  // A server may already have undone the gzip (Content-Encoding)
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return bytes.buffer;
  return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
};

/**
 * Import the compiler's loader from public/cxx. Through a blob URL because
 * Vite's dev server refuses `import()` of files in public/.
 */
const importScript = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load the C++ compiler (${response.status})`);
  const blobUrl = URL.createObjectURL(new Blob([await response.text()], { type: "text/javascript" }));
  try {
    return (await import(/* @vite-ignore */ blobUrl)) as ClangModule;
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
};

let compilerPromise: Promise<ClangModule> | null = null;

const getCompiler = (base: string) => {
  compilerPromise ??= (async () => {
    const manifest = (await fetch(`${base}manifest.json`, { cache: "no-cache" }).then((r) => {
      if (!r.ok) throw new Error(`Could not load the C++ compiler (${r.status})`);
      return r.json();
    })) as Manifest;
    const total = Object.values(manifest.sizes).reduce((a, b) => a + b, 0);
    let loaded = 0;
    const onBytes = (n: number) => {
      loaded += n;
      progressListener?.(loaded, total);
    };
    const url = (file: string) => `${base}${file}?v=${manifest.version}`;

    const [clang, modules, sysroot, pch] = await Promise.all([
      importScript(url("clang.js")),
      Promise.all(CORES.map(async (f) => [f, await WebAssembly.compile(await fetchGz(url(`${f}.gz`), onBytes))] as const)),
      fetchGz(url("sysroot.tar.gz"), onBytes),
      fetchGz(url("stdc++.pch.gz"), onBytes),
    ]);
    clang.setResources({
      modules: async () => Object.fromEntries(modules),
      filesystem: async (unpackTar) => {
        const usr = unpackTar(sysroot);
        usr.share = { aivex: { [flags.pch.split("/").pop()!]: new Uint8Array(pch) } };
        return { usr };
      },
    });
    await clang.commands["clang++"](null, {}, { fetchProgress: () => {} }); // set up the file system once
    return clang;
  })();
  compilerPromise.catch(() => (compilerPromise = null));
  return compilerPromise;
};

/** "dir/a.cpp" -> nested tree under /work */
const buildTree = (files: Record<string, string>): Tree => {
  const root: Tree = {};
  for (const [path, content] of Object.entries(files)) {
    const parts = path.split("/").filter(Boolean);
    let dir = root;
    for (const part of parts.slice(0, -1)) {
      if (typeof dir[part] !== "object" || dir[part] instanceof Uint8Array) dir[part] = {};
      dir = dir[part] as Tree;
    }
    dir[parts[parts.length - 1]] = content;
  }
  return root;
};

const cleanDiagnostics = (text: string) => text.replaceAll(`${WORK_DIR}/`, "");

const compile = async (req: Extract<CxxCompilerRequest, { type: "compile" }>) => {
  const { id } = req;
  const cold = compilerPromise === null;
  post({ type: "status", id, phase: cold ? "loading" : "compiling" });
  progressListener = (loaded, total) => post({ type: "progress", id, loaded, total });
  let clang: ClangModule;
  try {
    clang = await getCompiler(req.base);
  } finally {
    progressListener = null;
  }
  if (cold) post({ type: "status", id, phase: "compiling" });

  const t0 = performance.now();
  let diagnostics = "";
  const decoder = new TextDecoder();
  const capture = (bytes: Uint8Array | null) => {
    if (bytes) diagnostics += decoder.decode(bytes, { stream: true });
  };
  const run = (usePch: boolean) =>
    clang.commands["clang++"](
      [
        ...flags.compile,
        ...(usePch ? ["-include-pch", flags.pch] : []),
        ...req.sources.map((s) => `${WORK_DIR}/${s}`),
        ...flags.link,
        "-o",
        "/out/a.wasm",
      ],
      { work: buildTree(req.files), out: {} },
      { stdout: capture, stderr: capture, decodeASCII: false },
    );

  let out: Tree | undefined;
  try {
    out = await run(true);
  } catch {
    // Never let a stale precompiled header block a run: retry without it
    if (/precompiled header|PCH file/i.test(diagnostics)) {
      diagnostics = "";
      try {
        out = await run(false);
      } catch {
        /* reported below */
      }
    }
  }
  const compileMs = performance.now() - t0;
  const wasm = (out?.out as Tree | undefined)?.["a.wasm"];
  if (!(wasm instanceof Uint8Array)) {
    post({ type: "result", id, ok: false, diagnostics: cleanDiagnostics(diagnostics) || "Compilation failed", compileMs });
    return;
  }
  post({ type: "result", id, ok: true, wasm, diagnostics: cleanDiagnostics(diagnostics), compileMs });
};

self.onmessage = (event: MessageEvent<CxxCompilerRequest>) => {
  const req = event.data;
  if (req.type === "warm") {
    getCompiler(req.base).catch(() => {});
  } else if (req.type === "compile") {
    compile(req).catch((err: unknown) => {
      post({ type: "error", id: req.id, message: err instanceof Error ? err.message : String(err) });
    });
  }
};
