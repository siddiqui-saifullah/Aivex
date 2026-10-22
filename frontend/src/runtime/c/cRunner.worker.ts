/// <reference lib="webworker" />
/**
 * Compiles and runs C in a worker so the page never freezes (C++ arrives
 * already compiled by the C++ compiler worker). Interactive input
 * (scanf waiting for the user) blocks this worker on a SharedArrayBuffer until
 * the page writes the typed line into it.
 */
import { compileC, loadToolchain, runProgram, type Toolchain } from "./toolchain";
import type { CWorkerRequest, CWorkerEvent } from "./protocol";
import { INPUT_EOF, INPUT_READY, INPUT_WAITING } from "./protocol";

declare const self: DedicatedWorkerGlobalScope;

const OUTPUT_LIMIT = 1_000_000; // characters
const FLUSH_INTERVAL_MS = 50;

let toolchainPromise: Promise<Toolchain> | null = null;

const getToolchain = (base: string, version: string) => {
  toolchainPromise ??= (async () => {
    const [cc, sysroot] = await Promise.all([
      fetch(`${base}cc.wasm?v=${version}`).then((r) => {
        if (!r.ok) throw new Error(`Could not load the C compiler (${r.status})`);
        return r.arrayBuffer();
      }),
      fetch(`${base}sysroot.json?v=${version}`).then((r) => {
        if (!r.ok) throw new Error(`Could not load the C library (${r.status})`);
        return r.json() as Promise<Record<string, string>>;
      }),
    ]);
    return loadToolchain(cc, sysroot);
  })();
  toolchainPromise.catch(() => (toolchainPromise = null));
  return toolchainPromise;
};

const post = (event: CWorkerEvent) => self.postMessage(event);

class OutputLimitError extends Error {
  constructor() {
    super("Output limit exceeded (1 MB): is there an endless loop printing?");
  }
}

const run = async (req: Extract<CWorkerRequest, { type: "run" }>) => {
  const { id } = req;
  let wasm = req.wasm;
  let compileMs = req.compileMs ?? 0;
  if (!wasm) {
    const isCold = toolchainPromise === null;
    post({ type: "status", id, phase: isCold ? "loading" : "compiling" });
    let toolchain: Toolchain;
    try {
      toolchain = await getToolchain(req.base, req.version);
    } catch (err) {
      post({ type: "done", id, result: { kind: "error", message: (err as Error).message } });
      return;
    }

    if (isCold) post({ type: "status", id, phase: "compiling" });
    const t0 = performance.now();
    const compiled = compileC(toolchain, req.files, req.sources);
    compileMs = performance.now() - t0;
    if (!compiled.ok || !compiled.wasm) {
      post({ type: "done", id, result: { kind: "compile-error", diagnostics: compiled.diagnostics, compileMs } });
      return;
    }
    if (compiled.diagnostics.trim()) post({ type: "warnings", id, text: compiled.diagnostics });
    wasm = compiled.wasm;
  }
  post({ type: "status", id, phase: "running" });

  // Batched output: one message per ~50 ms instead of one per printf
  let pending: { stream: "stdout" | "stderr"; text: string } | null = null;
  let lastFlush = performance.now();
  let total = 0;
  const flush = () => {
    if (pending) post({ type: "output", id, stream: pending.stream, text: pending.text });
    pending = null;
    lastFlush = performance.now();
  };
  const write = (stream: "stdout" | "stderr") => (text: string) => {
    total += text.length;
    if (total > OUTPUT_LIMIT) throw new OutputLimitError();
    if (pending && pending.stream !== stream) flush();
    pending = pending ? { stream, text: pending.text + text } : { stream, text };
    if (performance.now() - lastFlush > FLUSH_INTERVAL_MS) flush();
  };

  const encoder = new TextEncoder();
  let prefilled: Uint8Array | null = req.stdin ? encoder.encode(req.stdin) : null;
  const shared = req.input;
  const control = shared ? new Int32Array(shared, 0, 2) : null;
  const data = shared ? new Uint8Array(shared, 8) : null;

  let waitedMs = 0; // time spent waiting for the user doesn't count as run time
  const readStdin = (): Uint8Array | null => {
    if (prefilled) {
      const chunk = prefilled;
      prefilled = null;
      return chunk;
    }
    if (!control || !data) return null; // no interactive input available
    flush(); // show the prompt before waiting
    Atomics.store(control, 0, INPUT_WAITING);
    post({ type: "input-request", id });
    const waitStart = performance.now();
    Atomics.wait(control, 0, INPUT_WAITING);
    waitedMs += performance.now() - waitStart;
    if (Atomics.load(control, 0) === INPUT_EOF) return null;
    const length = Atomics.load(control, 1);
    const chunk = data.slice(0, length);
    Atomics.store(control, 0, INPUT_READY);
    return chunk;
  };

  // sleep(): show what was printed, then block without burning CPU
  const sleepCell = typeof SharedArrayBuffer !== "undefined" ? new Int32Array(new SharedArrayBuffer(4)) : null;
  const sleep = (ms: number) => {
    flush();
    post({ type: "sleep", id, ms });
    const start = performance.now();
    if (sleepCell) Atomics.wait(sleepCell, 0, 0, ms);
    while (performance.now() - start < ms) {
      /* fallback spin */
    }
    waitedMs += performance.now() - start;
  };

  const r0 = performance.now();
  const result = runProgram(wasm, {
    stdout: write("stdout"),
    stderr: write("stderr"),
    readStdin,
    files: req.files,
    sleep,
  });
  const runMs = performance.now() - r0 - waitedMs;
  flush();
  post({
    type: "done",
    id,
    result: result.kind === "exit"
      ? { kind: "exit", code: result.code, compileMs, runMs }
      : { kind: "crash", message: result.message, compileMs, runMs },
  });
};

self.onmessage = (event: MessageEvent<CWorkerRequest>) => {
  const req = event.data;
  if (req.type === "warm") {
    getToolchain(req.base, req.version).catch(() => {});
  } else if (req.type === "run") {
    run(req).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      post({ type: "done", id: req.id, result: { kind: "error", message } });
    });
  }
};
