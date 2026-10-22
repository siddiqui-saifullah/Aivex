/** Messages between the page and the C++ compiler worker. */

export type CxxCompilerRequest =
  | { type: "warm"; base: string }
  | {
      type: "compile";
      id: number;
      base: string;
      /** Every project file (headers are #included from here). */
      files: Record<string, string>;
      /** Translation units to compile, entry first. */
      sources: string[];
    };

export type CxxCompilerEvent =
  | { type: "status"; id: number; phase: "loading" | "compiling" }
  /** Compiler download progress (bytes), first run only. */
  | { type: "progress"; id: number; loaded: number; total: number }
  | { type: "result"; id: number; ok: true; wasm: Uint8Array; diagnostics: string; compileMs: number }
  | { type: "result"; id: number; ok: false; diagnostics: string; compileMs: number }
  | { type: "error"; id: number; message: string };
