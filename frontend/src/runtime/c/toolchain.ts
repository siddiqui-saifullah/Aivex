/**
 * In-browser C toolchain: XCC's compiler (itself compiled to WebAssembly,
 * ~350 KB) turns C into a WASI program, which then runs on a small WASI shim.
 * No server is involved, so it is free, unlimited and works offline.
 *
 * Environment-agnostic (worker or Node): callers pass the toolchain bytes and
 * the I/O callbacks.
 */
import {
  ConsoleStdout,
  Directory,
  Fd,
  File,
  Inode,
  OpenFile,
  PreopenDirectory,
  WASI,
  WASIProcExit,
  wasi,
} from "@bjorn3/browser_wasi_shim";

export interface Toolchain {
  compiler: WebAssembly.Module;
  /** Headers and libc, by path under /usr (e.g. "include/stdio.h"). */
  sysroot: Map<string, Uint8Array>;
}

export interface CompileResult {
  ok: boolean;
  wasm?: Uint8Array;
  /** Compiler errors / warnings, with paths relative to the project. */
  diagnostics: string;
}

export type ExitReason =
  | { kind: "exit"; code: number }
  | { kind: "crash"; message: string };

/** Stack for the compiled program (C programs often keep big local arrays). */
const STACK_SIZE = 8 * 1024 * 1024;
const WORK_DIR = "/work";

const encoder = new TextEncoder();

const decodeBase64 = (b64: string) => {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
};

export const loadToolchain = async (ccWasm: ArrayBuffer, sysrootJson: Record<string, string>): Promise<Toolchain> => {
  const compiler = await WebAssembly.compile(ccWasm);
  const sysroot = new Map<string, Uint8Array>();
  for (const [path, b64] of Object.entries(sysrootJson)) sysroot.set(path, decodeBase64(b64));
  return { compiler, sysroot };
};

/** Build an in-memory directory tree from "a/b/c.h" -> bytes. */
const buildTree = (files: Iterable<[string, Uint8Array]>): Map<string, Inode> => {
  const root = new Map<string, Inode>();
  for (const [path, data] of files) {
    const parts = path.split("/").filter(Boolean);
    let dir = root;
    for (const part of parts.slice(0, -1)) {
      let next = dir.get(part);
      if (!(next instanceof Directory)) {
        next = new Directory(new Map());
        dir.set(part, next);
      }
      dir = (next as Directory).contents;
    }
    dir.set(parts[parts.length - 1], new File(data));
  }
  return root;
};

/** Output fd that forwards raw text (no line buffering: libc already flushes per line). */
const textOutput = (write: (text: string) => void) => {
  const decoder = new TextDecoder("utf-8", { fatal: false });
  return new ConsoleStdout((bytes: Uint8Array) => write(decoder.decode(bytes, { stream: true })));
};

/**
 * stdin backed by a pull function. Returns null for end of input. Reported as
 * a character device so libc treats a short read as "more may come".
 */
class PullStdin extends Fd {
  private buffer: Uint8Array = new Uint8Array(0);
  private ended = false;
  private pull: () => Uint8Array | null;

  constructor(pull: () => Uint8Array | null) {
    super();
    this.pull = pull;
  }

  fd_fdstat_get() {
    return { ret: 0, fdstat: new wasi.Fdstat(wasi.FILETYPE_CHARACTER_DEVICE, 0) };
  }

  fd_filestat_get() {
    return { ret: 0, filestat: new wasi.Filestat(0n, wasi.FILETYPE_CHARACTER_DEVICE, 0n) };
  }

  fd_read(size: number) {
    if (this.buffer.length === 0 && !this.ended) {
      const chunk = this.pull();
      if (chunk === null) this.ended = true;
      else this.buffer = chunk;
    }
    const data = this.buffer.slice(0, size);
    this.buffer = this.buffer.slice(data.length);
    return { ret: 0, data };
  }
}

const runWasi = (instanceModule: WebAssembly.Module, w: WASI): number => {
  const instance = new WebAssembly.Instance(instanceModule, {
    wasi_snapshot_preview1: w.wasiImport,
  });
  try {
    return w.start(instance as unknown as { exports: { memory: WebAssembly.Memory; _start: () => unknown } });
  } catch (err) {
    if (err instanceof WASIProcExit) return err.code;
    throw err;
  }
};

/** Program files are mounted under /work; diagnostics mention them relative to the project. */
const cleanDiagnostics = (text: string) =>
  text.replaceAll(`${WORK_DIR}/`, "").replace(/^(\S+?)\((\d+)\):/gm, "$1:$2:");

/**
 * Compile `sources` (paths in `files`, entry first). Every project file is
 * mounted so #include "x.h" works with the project's folder structure.
 */
export const compileC = (
  toolchain: Toolchain,
  files: Record<string, string>,
  sources: string[],
): CompileResult => {
  let diagnostics = "";
  const tmp = new Map<string, Inode>();
  const fds = [
    new OpenFile(new File(new Uint8Array())),
    textOutput((t) => (diagnostics += t)),
    textOutput((t) => (diagnostics += t)),
    new PreopenDirectory("/usr", buildTree(toolchain.sysroot)),
    new PreopenDirectory(
      WORK_DIR,
      buildTree(Object.entries(files).map(([p, c]) => [p, encoder.encode(c)] as [string, Uint8Array])),
    ),
    new PreopenDirectory("/tmp", tmp),
  ];
  const args = ["cc", `--stack-size=${STACK_SIZE}`, "-o", "/tmp/a.wasm", ...sources.map((s) => `${WORK_DIR}/${s}`)];
  const w = new WASI(args, [], fds, { debug: false });
  let code: number;
  try {
    code = runWasi(toolchain.compiler, w);
  } catch (err) {
    return { ok: false, diagnostics: `Compiler crashed: ${(err as Error).message}` };
  }
  const out = tmp.get("a.wasm");
  if (code !== 0 || !(out instanceof File)) {
    return { ok: false, diagnostics: cleanDiagnostics(diagnostics) || `Compilation failed (exit ${code})` };
  }
  return { ok: true, wasm: out.data, diagnostics: cleanDiagnostics(diagnostics) };
};

/** Friendly names for WebAssembly traps. */
export const describeCrash = (err: unknown): string => {
  const message = err instanceof Error ? err.message : String(err);
  if (/call stack|too much recursion/i.test(message)) return "Stack overflow: recursion is too deep";
  if (/divide by zero|division by zero/i.test(message)) return "Floating point exception: division by zero";
  if (/integer overflow/i.test(message)) return "Arithmetic error: integer overflow in division";
  if (/out of bounds|memory access/i.test(message)) return "Segmentation fault: invalid memory access";
  if (/unreachable/i.test(message)) return "Program aborted";
  if (/out of memory|could not allocate/i.test(message)) return "Out of memory";
  return message;
};

export interface RunIo {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  /** Next chunk of input, or null at end of input. May block (worker + Atomics). */
  readStdin: () => Uint8Array | null;
  /** Files the program can open (fopen) under its working directory. */
  files?: Record<string, string>;
}

/** Run a compiled program to completion. */
export const runProgram = (wasm: Uint8Array, io: RunIo): ExitReason => {
  const module = new WebAssembly.Module(wasm as Uint8Array<ArrayBuffer>);
  const fds = [
    new PullStdin(io.readStdin),
    textOutput(io.stdout),
    textOutput(io.stderr),
    // libc's working directory is ".", so fopen("data.txt") opens a project file
    new PreopenDirectory(
      ".",
      buildTree(Object.entries(io.files ?? {}).map(([p, c]) => [p, encoder.encode(c)] as [string, Uint8Array])),
    ),
    new PreopenDirectory("/tmp", new Map()),
  ];
  const w = new WASI(["a.out"], [], fds, { debug: false });
  try {
    return { kind: "exit", code: runWasi(module, w) };
  } catch (err) {
    return { kind: "crash", message: describeCrash(err) };
  }
};
