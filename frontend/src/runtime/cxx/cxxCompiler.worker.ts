/// <reference lib="webworker" />
/**
 * Compiles C++ in the browser with Clang/LLVM compiled to WebAssembly
 * (@yowasp/clang, prepared into public/cxx by scripts/prepare-cxx.mjs). The
 * compiler is big (~40 MB download, cached by the browser), so this worker is
 * kept alive across runs; programs run in the C runner worker.
 */
import flags from "./flags.json";
import pchHeader from "./pch.h?raw";
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
  /** Gzipped and decoded sizes of each download, for the progress bar. */
  sizes: Record<string, number>;
  rawSizes: Record<string, number>;
}

const CORES = ["llvm.core.wasm", "llvm.core2.wasm", "llvm.core3.wasm", "llvm.core4.wasm"];
const WORK_DIR = "/work";

const post = (event: CxxCompilerEvent) => self.postMessage(event);

/** Download progress goes to whichever run is waiting for the compiler. */
let progressListener: ((loaded: number, total: number) => void) | null = null;

/** Progress of one download: the share of its bytes received so far (0..1). */
type OnProgress = (fraction: number) => void;

const fetchOk = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error(`Could not load the C++ compiler (${response.status})`);
  return response;
};

/**
 * Read a response, reporting progress. With Content-Encoding the browser
 * decodes the gzip itself and reports decoded bytes.
 */
const readCounted = async (response: Response, gzSize: number, rawSize: number, onProgress: OnProgress) => {
  const size = response.headers.get("content-encoding") ? rawSize : gzSize;
  const reader = response.body!.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onProgress(Math.min(1, received / size));
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
};

const gunzip = async (bytes: Uint8Array): Promise<ArrayBuffer> => {
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return bytes.buffer as ArrayBuffer; // already decoded
  return new Response(new Blob([bytes as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
};

/** Fetch a gzipped file and decompress it. */
const fetchGz = async (url: string, gzSize: number, rawSize: number, onProgress: OnProgress) =>
  gunzip(await readCounted(await fetchOk(url), gzSize, rawSize, onProgress));

/**
 * Compile a gzipped wasm file. When the server sends it as
 * Content-Encoding: gzip + application/wasm, compile it while it downloads:
 * the browser then also caches the compiled code, so later page loads skip
 * compiling the 73 MB compiler.
 */
const fetchWasm = async (url: string, gzSize: number, rawSize: number, onProgress: OnProgress) => {
  const response = await fetchOk(url);
  const streamable =
    response.headers.get("content-encoding") === "gzip" &&
    response.headers.get("content-type")?.startsWith("application/wasm") &&
    typeof WebAssembly.compileStreaming === "function";
  if (streamable) {
    const counting = readCounted(response.clone(), gzSize, rawSize, onProgress);
    const module = await WebAssembly.compileStreaming(response);
    await counting;
    return module;
  }
  return WebAssembly.compile(await gunzip(await readCounted(response, gzSize, rawSize, onProgress)));
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
    // Progress in compressed bytes, whatever the server's encoding
    const total = Object.values(manifest.sizes).reduce((a, b) => a + b, 0);
    const done: Record<string, number> = {};
    const progress = (file: string) => (fraction: number) => {
      done[file] = fraction * manifest.sizes[file];
      progressListener?.(Object.values(done).reduce((a, b) => a + b, 0), total);
    };
    const url = (file: string) => `${base}${file}?v=${manifest.version}`;
    const load = <T>(file: string, fn: typeof fetchGz | typeof fetchWasm) =>
      fn(url(file), manifest.sizes[file], manifest.rawSizes?.[file] ?? manifest.sizes[file], progress(file)) as Promise<T>;

    const [clang, modules, sysroot, pch] = await Promise.all([
      importScript(url("clang.js")),
      Promise.all(CORES.map(async (f) => [f, await load<WebAssembly.Module>(`${f}.gz`, fetchWasm)] as const)),
      load<ArrayBuffer>("sysroot.tar.gz", fetchGz),
      load<ArrayBuffer>("stdc++.pch.gz", fetchGz),
    ]);
    const name = (p: string) => p.split("/").pop()!;
    clang.setResources({
      modules: async () => Object.fromEntries(modules),
      filesystem: async (unpackTar) => {
        const usr = unpackTar(sysroot);
        usr.share = { aivex: { [name(flags.pch)]: new Uint8Array(pch), [name(flags.pchHeader)]: pchHeader } };
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
