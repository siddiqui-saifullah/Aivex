/**
 * Runs C programs in the browser (see runtime/c). One worker is kept warm
 * between runs; stopping a program terminates it and the next run starts a
 * fresh one (the compiler comes from the HTTP cache, so that is quick).
 */
import {
  INPUT_BUFFER_SIZE,
  INPUT_EOF,
  INPUT_PROVIDED,
  type CRunResult,
  type CWorkerEvent,
  type CWorkerRequest,
} from "../runtime/c/protocol";

/** Bump when public/wcc changes so browsers fetch the new compiler. */
const WCC_VERSION = "1";
const BASE = `${import.meta.env.BASE_URL}wcc/`;

/** CPU time a program may use (time spent waiting for typed input doesn't count). */
const TIME_LIMIT_MS = 20_000;

export interface CRunHandlers {
  onStatus?: (phase: "loading" | "compiling" | "running") => void;
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

/** Start loading the compiler in the background (e.g. when a .c file is opened). */
export const warmCRunner = () => {
  const req: CWorkerRequest = { type: "warm", base: BASE, version: WCC_VERSION };
  getWorker().postMessage(req);
};

/** Pick what to compile: the entry file plus other .c files without their own main(). */
export const pickCSources = (entry: string, files: Record<string, string>) => {
  const others = Object.keys(files).filter(
    (path) => path !== entry && /\.c$/i.test(path) && !/\bmain\s*\(/.test(files[path] ?? ""),
  );
  return [entry, ...others];
};

export const runC = (
  { files, entry, stdin }: { files: Record<string, string>; entry: string; stdin: string },
  handlers: CRunHandlers,
): CRunHandle => {
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
      case "done":
        finish(msg.result);
        break;
    }
  };
  w.addEventListener("message", onMessage);

  const req: CWorkerRequest = {
    type: "run",
    id,
    base: BASE,
    version: WCC_VERSION,
    files,
    sources: pickCSources(entry, files),
    stdin,
    input: shared,
  };
  w.postMessage(req);

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
