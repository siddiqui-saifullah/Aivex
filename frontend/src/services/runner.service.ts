import type { Socket } from "socket.io-client";
import axios from "../config/axios";
import type { FlatFileTree } from "../types";

/** Languages executed on the server sandbox (everything a browser can't run). */
export const RUNNER_LANGUAGES: Record<string, { id: string; label: string }> = {
  c: { id: "c", label: "C" },
  cpp: { id: "cpp", label: "C++" },
  cc: { id: "cpp", label: "C++" },
  cxx: { id: "cpp", label: "C++" },
  java: { id: "java", label: "Java" },
  py: { id: "python", label: "Python" },
  go: { id: "go", label: "Go" },
  rs: { id: "rust", label: "Rust" },
  cs: { id: "csharp", label: "C#" },
  kt: { id: "kotlin", label: "Kotlin" },
  php: { id: "php", label: "PHP" },
  rb: { id: "ruby", label: "Ruby" },
};

const extensionOf = (path: string) => path.split(".").pop()?.toLowerCase() ?? "";

/** The sandbox language for a file, or null for files run in the browser (Node.js). */
export const getRunnerLanguage = (path: string | null) =>
  path ? RUNNER_LANGUAGES[extensionOf(path)] ?? null : null;

export interface RunStage {
  stdout: string;
  stderr: string;
  code: number | null;
  signal: string | null;
  /** Hit the time limit (reported by the built-in C/C++ runner). */
  timedOut?: boolean;
}

export interface RunResult {
  language: string;
  version: string;
  compile?: RunStage;
  run: RunStage;
  durationMs: number;
}

/**
 * What the server needs to run the active file. Other project files of the
 * same language are sent too (headers, other classes/modules); the active file
 * goes first as the entry point.
 */
const buildRunRequest = (activeFile: string, files: FlatFileTree, stdin: string) => {
  const language = getRunnerLanguage(activeFile);
  if (!language) throw new Error("This file type runs in the browser");

  const related = Object.keys(files).filter((path) => {
    if (path === activeFile) return false;
    const lang = getRunnerLanguage(path);
    // C/C++ projects also need their headers
    const isHeader = /\.(h|hh|hpp|hxx|inl|tpp|ipp)$/i.test(path) && ["c", "cpp"].includes(language.id);
    return lang?.id === language.id || isHeader;
  });

  return {
    language: language.id,
    stdin,
    files: [activeFile, ...related].map((path) => ({
      // Paths relative to the project root, so #include "lib/x.h" etc. still resolve
      name: path,
      content: files[path] ?? "",
    })),
  };
};

/** Run the active file over HTTP and get all output at the end. */
export const runFile = async (
  activeFile: string,
  files: FlatFileTree,
  stdin: string,
): Promise<RunResult> => {
  const { data } = await axios.post<RunResult>("/run", buildRunRequest(activeFile, files, stdin));
  return data;
};

export type OutputStream = "stdout" | "stderr";

export interface StreamRunHandlers {
  /** Compilation finished (compiled languages only), before the program starts. */
  onCompiled?: (compile: RunStage) => void;
  onOutput: (stream: OutputStream, text: string) => void;
}

export interface StreamRunEnd {
  compile?: RunStage;
  /** Missing when compilation failed. */
  run?: RunStage;
  version: string;
  durationMs: number;
}

export class RunStoppedError extends Error {
  constructor() {
    super("Stopped");
    this.name = "RunStoppedError";
  }
}

/**
 * Run the active file over the project socket, getting program output as it
 * is produced. `done` resolves when the program ends and rejects with
 * RunStoppedError after `stop()`, or with the server's error.
 */
export const streamRunFile = (
  socket: Socket,
  activeFile: string,
  files: FlatFileTree,
  stdin: string,
  handlers: StreamRunHandlers,
): { done: Promise<StreamRunEnd>; stop: () => void } => {
  const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const mine = (data: { runId?: string }) => data?.runId === runId;

  const onCompiled = (data: { runId: string; compile: RunStage }) => {
    if (mine(data)) handlers.onCompiled?.(data.compile);
  };
  const onOutput = (data: { runId: string; chunks: { stream: OutputStream; text: string }[] }) => {
    if (mine(data)) data.chunks.forEach((c) => handlers.onOutput(c.stream, c.text));
  };

  let settle: { resolve: (end: StreamRunEnd) => void; reject: (err: Error) => void };
  const done = new Promise<StreamRunEnd>((resolve, reject) => {
    settle = { resolve, reject };
  });

  const onExit = (data: StreamRunEnd & { runId: string }) => {
    if (!mine(data)) return;
    cleanup();
    settle.resolve(data);
  };
  const onError = (data: { runId: string; error: string; stopped?: boolean }) => {
    if (!mine(data)) return;
    cleanup();
    settle.reject(data.stopped ? new RunStoppedError() : new Error(data.error));
  };
  const onDisconnect = () => {
    cleanup();
    settle.reject(new Error("Lost connection to the server"));
  };

  const cleanup = () => {
    socket.off("run:compiled", onCompiled);
    socket.off("run:output", onOutput);
    socket.off("run:exit", onExit);
    socket.off("run:error", onError);
    socket.off("disconnect", onDisconnect);
  };

  // Listen before starting so no early output is missed
  socket.on("run:compiled", onCompiled);
  socket.on("run:output", onOutput);
  socket.on("run:exit", onExit);
  socket.on("run:error", onError);
  socket.on("disconnect", onDisconnect);

  let request;
  try {
    request = buildRunRequest(activeFile, files, stdin);
  } catch (err) {
    cleanup();
    return { done: Promise.reject(err), stop: () => {} };
  }

  socket
    .timeout(10_000)
    .emitWithAck("run:start", { runId, ...request })
    .then((ack: { ok: boolean; error?: string }) => {
      if (!ack?.ok) {
        cleanup();
        settle.reject(new Error(ack?.error || "Could not start the program"));
      }
    })
    .catch(() => {
      cleanup();
      settle.reject(new Error("The server did not respond"));
    });

  return { done, stop: () => socket.emit("run:stop", { runId }) };
};
