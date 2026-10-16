import { CompilerError } from "./errors.js";
import type { Language, Limits, SourceFile } from "./types.js";

export const SOURCE_EXTENSIONS: Record<Language, readonly string[]> = {
    c: ["c"],
    cpp: ["cpp", "cc", "cxx", "c++"],
};

const HEADER_EXTENSIONS = ["h", "hh", "hpp", "hxx", "inl", "tpp", "ipp"];

// Letters, digits, spaces and . _ - +; a segment may not start with "-" or a
// space, end with a space, or be "." / "..". Arguments never pass through a shell.
const SAFE_SEGMENT = /^(?![- ])(?!\.{1,2}$)[A-Za-z0-9._+ -]{1,100}(?<! )$/;

const SAFE_FLAGS = new Set([
    "-O0", "-O1", "-O2", "-O3", "-Os", "-Og",
    "-g", "-Wall", "-Wextra", "-Werror", "-Wpedantic", "-pedantic", "-w",
    "-lm", "-lpthread", "-pthread",
    "-fno-exceptions", "-fno-rtti",
]);
const SAFE_STD = /^-std=(c|gnu)(89|90|99|11|17|18|2x|23|\+\+(98|03|11|14|17|20|2a|23|2b|26|2c))$/;
const SAFE_DEFINE = /^-D[A-Za-z_][A-Za-z0-9_]{0,63}(=[A-Za-z0-9_.]{0,64})?$/;

export const extensionOf = (name: string) => {
    const base = name.slice(name.lastIndexOf("/") + 1);
    const dot = base.lastIndexOf(".");
    return dot > 0 ? base.slice(dot + 1).toLowerCase() : "";
};

export const isLanguage = (value: unknown): value is Language =>
    value === "c" || value === "cpp";

/** Normalizes "./a//b.c" to "a/b.c" and rejects anything that could escape the work dir. */
export const normalizePath = (name: string): string => {
    const segments = name.replace(/\\/g, "/").split("/").filter((s) => s !== "" && s !== ".");
    if (segments.length === 0 || segments.length > 10 || !segments.every((s) => SAFE_SEGMENT.test(s))) {
        throw new CompilerError("INVALID_INPUT", `Invalid file name: ${JSON.stringify(name.slice(0, 120))}`);
    }
    return segments.join("/");
};

export const validateFiles = (language: Language, files: unknown, limits: Limits): SourceFile[] => {
    if (!Array.isArray(files) || files.length === 0 || files.length > limits.maxFiles) {
        throw new CompilerError("INVALID_INPUT", `Provide between 1 and ${limits.maxFiles} files`);
    }

    const seen = new Set<string>();
    let totalBytes = 0;
    const clean = files.map((f: unknown) => {
        const file = f as Partial<SourceFile> | null;
        if (!file || typeof file.name !== "string" || typeof file.content !== "string") {
            throw new CompilerError("INVALID_INPUT", "Each file needs a name and content");
        }
        const name = normalizePath(file.name);
        // Case-insensitive so it also holds on case-insensitive host filesystems
        if (seen.has(name.toLowerCase())) {
            throw new CompilerError("INVALID_INPUT", `Duplicate file: ${name}`);
        }
        seen.add(name.toLowerCase());
        totalBytes += Buffer.byteLength(file.content);
        return { name, content: file.content };
    });

    if (totalBytes > limits.maxSourceBytes) {
        throw new CompilerError("INVALID_INPUT", "Source code is too large");
    }

    const allowed = [...SOURCE_EXTENSIONS[language], ...HEADER_EXTENSIONS];
    const entryExt = extensionOf(clean[0].name);
    if (!SOURCE_EXTENSIONS[language].includes(entryExt)) {
        throw new CompilerError("INVALID_INPUT", `${clean[0].name} is not a ${language === "c" ? "C" : "C++"} source file`);
    }
    const stray = clean.find((f) => !allowed.includes(extensionOf(f.name)));
    if (stray) {
        throw new CompilerError("INVALID_INPUT", `Unsupported file type: ${stray.name}`);
    }

    return clean;
};

export const validateFlags = (flags: unknown): string[] => {
    if (flags === undefined) return [];
    if (!Array.isArray(flags) || flags.length > 20) {
        throw new CompilerError("INVALID_INPUT", "flags must be an array of at most 20 strings");
    }
    for (const flag of flags) {
        if (typeof flag !== "string" || !(SAFE_FLAGS.has(flag) || SAFE_STD.test(flag) || SAFE_DEFINE.test(flag))) {
            throw new CompilerError("INVALID_INPUT", `Compiler flag not allowed: ${String(flag).slice(0, 60)}`);
        }
    }
    return flags as string[];
};

export const validateStdin = (stdin: unknown, limits: Limits): string => {
    if (stdin === undefined) return "";
    if (typeof stdin !== "string" || Buffer.byteLength(stdin) > limits.maxStdinBytes) {
        throw new CompilerError("INVALID_INPUT", "Input (stdin) is too large");
    }
    return stdin;
};
