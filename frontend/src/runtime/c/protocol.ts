/** Messages between the page and the C runner worker. */

/** Input handshake states in the shared control word. */
export const INPUT_READY = 0;
export const INPUT_WAITING = 1;
export const INPUT_PROVIDED = 2;
export const INPUT_EOF = 3;
/** Bytes available for one line of typed input. */
export const INPUT_BUFFER_SIZE = 64 * 1024;

export type CWorkerRequest =
  | { type: "warm"; base: string; version: string }
  | {
      type: "run";
      id: number;
      base: string;
      version: string;
      /** Every project file (headers, data files for fopen). */
      files: Record<string, string>;
      /** Translation units to compile, entry first. */
      sources: string[];
      /** Input given up front (the Input tab); interactive input follows. */
      stdin: string;
      /** [control: Int32 x2][data] — present when the page is cross-origin isolated. */
      input?: SharedArrayBuffer;
    };

export type CRunResult =
  | { kind: "exit"; code: number; compileMs: number; runMs: number }
  | { kind: "crash"; message: string; compileMs: number; runMs: number }
  | { kind: "compile-error"; diagnostics: string; compileMs: number }
  | { kind: "error"; message: string };

export type CWorkerEvent =
  | { type: "status"; id: number; phase: "loading" | "compiling" | "running" }
  | { type: "warnings"; id: number; text: string }
  | { type: "output"; id: number; stream: "stdout" | "stderr"; text: string }
  | { type: "input-request"; id: number }
  /** The program is sleeping for `ms` (doesn't count toward the CPU limit). */
  | { type: "sleep"; id: number; ms: number }
  | { type: "done"; id: number; result: CRunResult };
