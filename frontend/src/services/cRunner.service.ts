/**
 * Runs C and C++ programs in the browser (see runtime/c and runtime/cxx). One
 * worker is kept warm between runs; stopping a program terminates it and the
 * next run starts a fresh one (the compiler comes from the HTTP cache, so that
 * is quick). C++ is compiled by a separate worker that is never stopped, as
 * its compiler is much bigger.
 */
import {
  INPUT_BUFFER_SIZE,
  INPUT_EOF,
  INPUT_PROVIDED,
  type CRunResult,
  type CWorkerEvent,
  type CWorkerRequest,
} from "../runtime/c/protocol";
import type { CxxCompilerEvent, CxxCompilerRequest } from "../runtime/cxx/protocol";

/** Bump when public/wcc changes so browsers fetch the new compiler. */
const WCC_VERSION = "3";
const BASE = `${import.meta.env.BASE_URL}wcc/`;
/** public/cxx, versioned by its manifest.json */
const CXX_BASE = `${import.meta.env.BASE_URL}cxx/`;

export type NativeLanguage = "c" | "cpp";

/** Languages compiled and run in the browser, by file extension. */
export const nativeLanguageOf = (path: string | null): NativeLanguage | null => {
  if (!path) return null;
  if (/\.c$/i.test(path)) return "c";
  if (/\.(cpp|cc|cxx|c\+\+)$/i.test(path)) return "cpp";
  return null;
};

/** CPU time a program may use (time spent waiting for typed input doesn't count). */
const TIME_LIMIT_MS = 20_000;

export interface CRunHandlers {
  onStatus?: (phase: "loading" | "compiling" | "running") => void;
  /** First C++ run: compiler download progress in bytes. */
  onProgress?: (loaded: number, total: number) => void;
  onOutput: (stream: "stdout" | "stderr", text: string) => void;
  onWarnings?: (text: string) => void;
  /** The program is waiting for input (interactive mode). */
  onInputRequest?: () => void;
  onDone: (result: CRunResult | { kind: "stopped"; reason: "user" | "timeout" }) => void;
}

export interface CRunHandle {
  /** Send a line the user typed (a newline is added). */
  provideInput: (text: string) => void;
  /** End of input (Ctrl+D). */
  sendEof: () => void;
  stop: () => void;
}

/** Interactive input needs SharedArrayBuffer, i.e. a cross-origin isolated page. */
export const supportsInteractiveInput = () =>
  typeof SharedArrayBuffer !== "undefined" && (globalThis as { crossOriginIsolated?: boolean }).crossOriginIsolated === true;

let worker: Worker | null = null;
let nextId = 1;

const createWorker = () =>
  new Worker(new URL("../runtime/c/cRunner.worker.ts", import.meta.url), { type: "module", name: "c-runner" });

const getWorker = () => (worker ??= createWorker());

let cxxWorker: Worker | null = null;

const getCxxWorker = () =>
  (cxxWorker ??= new Worker(new URL("../runtime/cxx/cxxCompiler.worker.ts", import.meta.url), {
    type: "module",
    name: "cxx-compiler",
  }));

/** Start loading the compiler in the background (e.g. when a .c or .cpp file is opened). */
export const warmCRunner = (language: NativeLanguage = "c") => {
  if (language === "cpp") {
    const req: CxxCompilerRequest = { type: "warm", base: CXX_BASE };
    getCxxWorker().postMessage(req);
    return;
  }
  const req: CWorkerRequest = { type: "warm", base: BASE, version: WCC_VERSION };
  getWorker().postMessage(req);
};

/** Pick what to compile: the entry file plus other source files without their own main(). */
export const pickCSources = (entry: string, files: Record<string, string>) => {
  const language = nativeLanguageOf(entry);
  const others = Object.keys(files).filter(
    (path) => path !== entry && nativeLanguageOf(path) === language && !/\bmain\s*\(/.test(files[path] ?? ""),
  );
  return [entry, ...others];
};

export const runC = (
  { files, entry, stdin }: { files: Record<string, string>; entry: string; stdin: string },
  handlers: CRunHandlers,
): CRunHandle => {
  const language = nativeLanguageOf(entry) ?? "c";
  const id = nextId++;
  const w = getWorker();
  const shared = supportsInteractiveInput() ? new SharedArrayBuffer(8 + INPUT_BUFFER_SIZE) : undefined;
  const control = shared ? new Int32Array(shared, 0, 2) : null;
  const data = shared ? new Uint8Array(shared, 8) : null;
  const encoder = new TextEncoder();

  let finished = false;
  let waitingForInput = false;
  let activeMs = 0;
  let runningSince: number | null = null;

  const finish = (result: Parameters<CRunHandlers["onDone"]>[0]) => {
    if (finished) return;
    finished = true;
    clearInterval(timer);
    w.removeEventListener("message", onMessage);
    cxxWorker?.removeEventListener("message", onCompilerMessage);
    handlers.onDone(result);
  };

  const killWorker = () => {
    w.terminate();
    if (worker === w) worker = null;
  };

  // CPU time limit (infinite loops), paused while waiting for the user
  const timer = setInterval(() => {
    if (runningSince === null || waitingForInput) return;
    if (activeMs + (performance.now() - runningSince) > TIME_LIMIT_MS) {
      killWorker();
      finish({ kind: "stopped", reason: "timeout" });
    }
  }, 250);

  const onMessage = (event: MessageEvent<CWorkerEvent>) => {
    const msg = event.data;
    if (msg.id !== id) return;
    switch (msg.type) {
      case "status":
        if (msg.phase === "running") runningSince = performance.now();
        handlers.onStatus?.(msg.phase);
        break;
      case "warnings":
        handlers.onWarnings?.(msg.text);
        break;
      case "output":
        handlers.onOutput(msg.stream, msg.text);
        break;
      case "input-request":
        if (runningSince !== null) activeMs += performance.now() - runningSince;
        runningSince = null;
        waitingForInput = true;
        handlers.onInputRequest?.();
        break;
      case "sleep":
        activeMs -= msg.ms; // sleeping isn't CPU time
        break;
      case "done":
        finish(msg.result);
        break;
    }
  };
  w.addEventListener("message", onMessage);

  const sources = pickCSources(entry, files);
  const start = (compiled?: { wasm: Uint8Array; compileMs: number }) => {
    const req: CWorkerRequest = {
      type: "run",
      id,
      base: BASE,
      version: WCC_VERSION,
      files,
      sources,
      stdin,
      input: shared,
      ...compiled,
    };
    w.postMessage(req, compiled ? [compiled.wasm.buffer] : []);
  };

  // C++: compile in the compiler worker first, then run like C
  function onCompilerMessage(event: MessageEvent<CxxCompilerEvent>) {
    const msg = event.data;
    if (msg.id !== id || finished) return;
    switch (msg.type) {
      case "status":
        handlers.onStatus?.(msg.phase);
        break;
      case "progress":
        handlers.onProgress?.(msg.loaded, msg.total);
        break;
      case "result":
        cxxWorker?.removeEventListener("message", onCompilerMessage);
        if (!msg.ok) {
          finish({ kind: "compile-error", diagnostics: msg.diagnostics, compileMs: msg.compileMs });
          return;
        }
        if (msg.diagnostics.trim()) handlers.onWarnings?.(msg.diagnostics);
        start({ wasm: msg.wasm, compileMs: msg.compileMs });
        break;
      case "error":
        finish({ kind: "error", message: msg.message });
        break;
    }
  }

  if (language === "cpp") {
    const compiler = getCxxWorker();
    compiler.addEventListener("message", onCompilerMessage);
    const req: CxxCompilerRequest = { type: "compile", id, base: CXX_BASE, files, sources };
    compiler.postMessage(req);
  } else {
    start();
  }

  const respond = (state: number, bytes?: Uint8Array) => {
    if (!control || !data || !waitingForInput || finished) return;
    waitingForInput = false;
    runningSince = performance.now();
    if (bytes) {
      const chunk = bytes.subarray(0, data.length);
      data.set(chunk);
      Atomics.store(control, 1, chunk.length);
    }
    Atomics.store(control, 0, state);
    Atomics.notify(control, 0);
  };

  return {
    provideInput: (text) => respond(INPUT_PROVIDED, encoder.encode(`${text}\n`)),
    sendEof: () => respond(INPUT_EOF),
    stop: () => {
      if (finished) return;
      killWorker();
      finish({ kind: "stopped", reason: "user" });
    },
  };
};

const SIGNAL_EXITS: Record<number, string> = {
  130: "Interrupted",
  134: "Aborted",
  136: "Floating point exception",
  139: "Segmentation fault",
  143: "Terminated",
};

/** How a non-zero exit code reads in the output ("Aborted" for abort()). */
export const describeExitCode = (code: number) =>
  SIGNAL_EXITS[code] ? `${SIGNAL_EXITS[code]} (exit code ${code})` : `Exited with code ${code}`;
