import AppError from "../errors/AppError.js";

/**
 * Runs C, C++, Java, Python, ... by forwarding to a Piston-compatible
 * sandbox (https://github.com/engineer-man/piston). Point PISTON_URL at a
 * self-hosted instance (recommended: free VM + `docker run ghcr.io/engineer-man/piston`)
 * and optionally set PISTON_TOKEN if the instance requires an Authorization header.
 *
 * Node.js projects keep running in the browser (WebContainer); this service is
 * only for languages a browser can't run.
 */

export const RUNNER_LANGUAGES = {
    c: { piston: "c", label: "C", extensions: ["c"] },
    cpp: { piston: "c++", label: "C++", extensions: ["cpp", "cc", "cxx"] },
    java: { piston: "java", label: "Java", extensions: ["java"] },
    python: { piston: "python", label: "Python", extensions: ["py"] },
    go: { piston: "go", label: "Go", extensions: ["go"] },
    rust: { piston: "rust", label: "Rust", extensions: ["rs"] },
    csharp: { piston: "csharp", label: "C#", extensions: ["cs"] },
    kotlin: { piston: "kotlin", label: "Kotlin", extensions: ["kt"] },
    php: { piston: "php", label: "PHP", extensions: ["php"] },
    ruby: { piston: "ruby", label: "Ruby", extensions: ["rb"] },
} as const;

export type RunnerLanguage = keyof typeof RUNNER_LANGUAGES;

const MAX_FILES = 20;
const MAX_SOURCE_BYTES = 200 * 1024;
const MAX_STDIN_BYTES = 64 * 1024;
const REQUEST_TIMEOUT_MS = 30_000;

export interface RunFile {
    name: string;
    content: string;
}

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

interface PistonStage {
    stdout?: string;
    stderr?: string;
    code?: number | null;
    signal?: string | null;
}

export const isRunnerConfigured = () => Boolean(process.env.PISTON_URL);

const toStage = (stage: PistonStage): RunStage => ({
    stdout: stage.stdout ?? "",
    stderr: stage.stderr ?? "",
    code: stage.code ?? null,
    signal: stage.signal ?? null,
});

export const runCode = async ({ language, files, stdin = "" }: {
    language: unknown;
    files: unknown;
    stdin?: unknown;
}): Promise<RunResult> => {
    const baseUrl = process.env.PISTON_URL;
    if (!baseUrl) {
        throw new AppError("Code runner is not configured on this server (PISTON_URL missing)", 503);
    }

    if (typeof language !== "string" || !(language in RUNNER_LANGUAGES)) {
        throw new AppError("Unsupported language", 400);
    }

    if (!Array.isArray(files) || files.length === 0 || files.length > MAX_FILES) {
        throw new AppError(`Provide between 1 and ${MAX_FILES} files`, 400);
    }

    let totalBytes = 0;
    const cleanFiles: RunFile[] = files.map((f) => {
        if (!f || typeof f.name !== "string" || typeof f.content !== "string") {
            throw new AppError("Each file needs a name and content", 400);
        }
        totalBytes += Buffer.byteLength(f.content);
        return { name: f.name, content: f.content };
    });

    if (totalBytes > MAX_SOURCE_BYTES) {
        throw new AppError("Source code is too large to run", 413);
    }

    if (typeof stdin !== "string" || Buffer.byteLength(stdin) > MAX_STDIN_BYTES) {
        throw new AppError("Input (stdin) is too large", 413);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const started = Date.now();

    try {
        const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/v2/execute`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...(process.env.PISTON_TOKEN ? { Authorization: process.env.PISTON_TOKEN } : {}),
            },
            body: JSON.stringify({
                language: RUNNER_LANGUAGES[language as RunnerLanguage].piston,
                version: "*",
                files: cleanFiles,
                stdin,
                compile_timeout: 10_000,
                run_timeout: 5_000,
            }),
            signal: controller.signal,
        });

        const data = await response.json().catch(() => ({})) as {
            message?: string;
            language?: string;
            version?: string;
            compile?: PistonStage;
            run?: PistonStage;
        };

        if (!response.ok || !data.run) {
            throw new AppError(data.message || `Code runner error (${response.status})`, 502);
        }

        return {
            language: data.language ?? language,
            version: data.version ?? "",
            compile: data.compile ? toStage(data.compile) : undefined,
            run: toStage(data.run),
            durationMs: Date.now() - started,
        };
    } catch (err) {
        if (err instanceof AppError) throw err;
        if ((err as Error).name === "AbortError") {
            throw new AppError("Code runner timed out", 504);
        }
        throw new AppError("Code runner is unreachable", 502);
    } finally {
        clearTimeout(timer);
    }
};
