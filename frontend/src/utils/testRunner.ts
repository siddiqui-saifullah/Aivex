import { runC } from "../services/cRunner.service";
import type { TestCase, TestOutcome } from "../types";

/** What one test's run produced; the server decides pass or fail. */
export interface TestRun {
  test: string;
  outcome: "ran" | "compile-error" | "error" | "timeout";
  output: string;
}

/** Per test: a program that takes longer than this is "too slow". */
const TEST_TIME_LIMIT_MS = 8000;
const MAX_OUTPUT = 100_000;

/** Same rule as the server: trailing spaces, line endings and final blank lines don't matter. */
export const normalizeOutput = (text: string) =>
  text.replace(/\r\n?/g, "\n").split("\n").map((l) => l.replace(/[ \t]+$/, "")).join("\n").replace(/\n+$/, "");

/** The file a C/C++ program starts from (as the server picks it). */
export const findEntry = (files: Record<string, string>, stack: string) => {
  const ext = stack === "cpp" ? /\.(cpp|cc|cxx)$/i : /\.c$/i;
  const sources = Object.keys(files).filter((p) => ext.test(p));
  return sources.find((p) => /(^|\/)main\.(c|cpp|cc|cxx)$/i.test(p))
    ?? sources.find((p) => /\bmain\s*\(/.test(files[p] ?? ""))
    ?? null;
};

/** Run one program with `input` on stdin, collecting stdout. */
const runOne = (files: Record<string, string>, entry: string, input: string) =>
  new Promise<Omit<TestRun, "test">>((resolve) => {
    let output = "";
    let compileError = "";
    let timer: ReturnType<typeof setTimeout> | null = null;
    const handle = runC(
      { files, entry, stdin: input.endsWith("\n") || !input ? input : `${input}\n` },
      {
        onStatus: (phase) => {
          // The clock starts once compiling is done
          if (phase === "running" && !timer) timer = setTimeout(() => handle.stop(), TEST_TIME_LIMIT_MS);
        },
        onOutput: (stream, text) => {
          if (stream === "stdout" && output.length < MAX_OUTPUT) output += text;
        },
        // No one types during a test: reading past the input means end of input
        onInputRequest: () => handle.sendEof(),
        onDone: (result) => {
          if (timer) clearTimeout(timer);
          if (result.kind === "compile-error") {
            compileError = result.diagnostics;
            resolve({ outcome: "compile-error", output: compileError });
          } else if (result.kind === "stopped") resolve({ outcome: "timeout", output });
          else if (result.kind === "exit") resolve({ outcome: result.code === 0 ? "ran" : "error", output });
          else resolve({ outcome: "error", output: output || ("message" in result ? result.message : "") });
        },
      },
    );
  });

/**
 * Run tests in the browser (Aivex's built-in C/C++ compiler), one after
 * another. A compile error fails every test without running the rest.
 */
export const runTests = async (
  files: Record<string, string>,
  stack: string,
  tests: Pick<TestCase, "_id" | "input">[],
  onProgress?: (done: number, total: number) => void,
): Promise<TestRun[]> => {
  const entry = findEntry(files, stack);
  if (!entry) return tests.map((t) => ({ test: t._id, outcome: "compile-error", output: `No ${stack === "cpp" ? "C++" : "C"} file with main() found` }));
  const runs: TestRun[] = [];
  for (const [i, t] of tests.entries()) {
    onProgress?.(i, tests.length);
    const run = await runOne(files, entry, t.input);
    runs.push({ test: t._id, ...run });
    if (run.outcome === "compile-error") {
      for (const rest of tests.slice(i + 1)) runs.push({ test: rest._id, outcome: "compile-error", output: run.output });
      break;
    }
  }
  onProgress?.(tests.length, tests.length);
  return runs;
};

/** Students checking their own work: compare here (visible tests only). */
export const outcomeOf = (run: TestRun, expected: string): TestOutcome =>
  run.outcome !== "ran" ? run.outcome : normalizeOutput(run.output) === normalizeOutput(expected) ? "passed" : "failed";

export const OUTCOME_LABELS: Record<TestOutcome, string> = {
  passed: "Passed",
  failed: "Wrong output",
  "compile-error": "Didn't compile",
  error: "Crashed",
  timeout: "Too slow",
};
