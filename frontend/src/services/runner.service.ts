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
}

export interface RunResult {
  language: string;
  version: string;
  compile?: RunStage;
  run: RunStage;
  durationMs: number;
}

/**
 * Run the active file. Other project files of the same language are sent too
 * (headers, other classes/modules); the active file goes first as the entry point.
 */
export const runFile = async (
  activeFile: string,
  files: FlatFileTree,
  stdin: string,
): Promise<RunResult> => {
  const language = getRunnerLanguage(activeFile);
  if (!language) throw new Error("This file type runs in the browser");

  const related = Object.keys(files).filter((path) => {
    if (path === activeFile) return false;
    const lang = getRunnerLanguage(path);
    // C/C++ projects also need their headers
    const isHeader = /\.(h|hpp)$/i.test(path) && ["c", "cpp"].includes(language.id);
    return lang?.id === language.id || isHeader;
  });

  const { data } = await axios.post<RunResult>("/run", {
    language: language.id,
    stdin,
    files: [activeFile, ...related].map((path) => ({
      // Paths relative to the project root, so #include "lib/x.h" etc. still resolve
      name: path,
      content: files[path] ?? "",
    })),
  });
  return data;
};
