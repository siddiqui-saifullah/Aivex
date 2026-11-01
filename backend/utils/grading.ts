/**
 * Output comparison for test cases. Forgiving about whitespace that students
 * can't see: trailing spaces on a line, Windows line endings, and blank lines
 * at the end. Everything else must match exactly.
 */
export const normalizeOutput = (text: string) =>
    text
        .replace(/\r\n?/g, "\n")
        .split("\n")
        .map((line) => line.replace(/[ \t]+$/, ""))
        .join("\n")
        .replace(/\n+$/, "");

export const outputsMatch = (actual: string, expected: string) => normalizeOutput(actual) === normalizeOutput(expected);

/** The file a C/C++ program starts from: main.c / main.cpp, or any file with main(). */
export const findEntry = (files: Record<string, string>, stack: string) => {
    const ext = stack === "cpp" ? /\.(cpp|cc|cxx)$/i : /\.c$/i;
    const sources = Object.keys(files).filter((p) => ext.test(p));
    return sources.find((p) => /(^|\/)main\.(c|cpp|cc|cxx)$/i.test(p))
        ?? sources.find((p) => /\bmain\s*\(/.test(files[p] ?? ""))
        ?? null;
};

/** Languages whose assignments can have test cases. */
export const TESTABLE_STACKS = ["c", "cpp"] as const;
export const isTestableStack = (stack: string) => (TESTABLE_STACKS as readonly string[]).includes(stack);
