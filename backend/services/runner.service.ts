import { Compiler, CompilerError, type Stage } from "aivex-cc";
import AppError from "../errors/AppError.js";
import { createLimiter } from "../middleware/rateLimit.middleware.js";

/**
 * Runs C, C++, Java, Python, ... on the server.
 *
 * - C and C++ compile in a local Docker sandbox (the aivex-cc package) when
 *   CC_RUNNER=docker is set.
 * - Everything else (and C/C++ without CC_RUNNER) is forwarded to a
 *   Piston-compatible sandbox (https://github.com/engineer-man/piston). Point
 *   PISTON_URL at a self-hosted instance and optionally set PISTON_TOKEN if the
 *   instance requires an Authorization header.
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

/** 20 runs per user per minute, shared by POST /run and socket runs. */
export const runLimiter = createLimiter({ windowMs: 60_000, max: 20 });

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
    /** Hit the time limit (only reported by the Docker runner). */
    timedOut?: boolean;
}

/** Live progress for socket runs. Piston runs report everything at the end. */
export interface RunHooks {
    onCompiled?: (compile: RunStage) => void;
    onStdout?: (chunk: string) => void;
    onStderr?: (chunk: string) => void;
    /** Abort to stop the run. */
    signal?: AbortSignal;
    /** True when output was delivered through onStdout/onStderr as it happened. */
    streamed?: boolean;
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

const usesDockerCompiler = (language: RunnerLanguage) =>
    process.env.CC_RUNNER === "docker" && (language === "c" || language === "cpp");

export const isRunnerConfigured = () =>
    Boolean(process.env.PISTON_URL) || process.env.CC_RUNNER === "docker";

let compiler: Compiler | null = null;

const getCompiler = () => {
    compiler ??= new Compiler({
        image: process.env.CC_IMAGE || undefined,
        runtime: process.env.CC_DOCKER_RUNTIME || undefined,
        workRoot: process.env.CC_WORK_DIR || undefined,
        maxConcurrent: Number(process.env.CC_MAX_CONCURRENT) || undefined,
        limits: { maxFiles: MAX_FILES, maxSourceBytes: MAX_SOURCE_BYTES, maxStdinBytes: MAX_STDIN_BYTES },
    });
    return compiler;
};

/** Pull the compiler image at startup so the first run isn't slow. */
export const warmUpRunner = async () => {
    if (process.env.CC_RUNNER !== "docker") return;
    try {
        await getCompiler().prepare();
        console.log(`C/C++ runner ready (gcc ${await getCompiler().getVersion()})`);
    } catch (err) {
        console.error("C/C++ runner unavailable:", (err as Error).message);
    }
};

/** AppError status for runs stopped by the user (nginx's "client closed request"). */
export const RUN_STOPPED_STATUS = 499;

const COMPILER_ERROR_STATUS = {
    INVALID_INPUT: 400,
    BUSY: 503,
    DOCKER_UNAVAILABLE: 503,
    ABORTED: RUN_STOPPED_STATUS,
} as const;

const toRunStage = ({ stdout, stderr, code, signal, timedOut }: Stage): RunStage =>
    ({ stdout, stderr, code, signal, timedOut });

const runWithDocker = async (
    language: "c" | "cpp",
    files: RunFile[],
    stdin: string,
    hooks: RunHooks,
): Promise<RunResult> => {
    try {
        const result = await getCompiler().run({
            language,
            files,
            stdin,
            signal: hooks.signal,
            onCompiled: hooks.onCompiled && ((stage) => hooks.onCompiled!(toRunStage(stage))),
            onStdout: hooks.onStdout,
            onStderr: hooks.onStderr,
        });
        return {
            language,
            version: result.version,
            compile: toRunStage(result.compile),
            // Compile failed: the client shows the compile errors and ignores this
            run: result.run ? toRunStage(result.run) : { stdout: "", stderr: "", code: null, signal: null },
            durationMs: result.durationMs,
        };
    } catch (err) {
        if (err instanceof CompilerError) {
            if (err.code === "DOCKER_UNAVAILABLE") console.error("C/C++ runner:", err.message);
            throw new AppError(
                err.code === "DOCKER_UNAVAILABLE" ? "The C/C++ compiler is unavailable right now" : err.message,
                COMPILER_ERROR_STATUS[err.code],
            );
        }
        throw err;
    }
};

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
}, hooks: RunHooks = {}): Promise<RunResult> => {
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

    if (usesDockerCompiler(language as RunnerLanguage)) {
        hooks.streamed = true;
        return runWithDocker(language as "c" | "cpp", cleanFiles, stdin, hooks);
    }

    const baseUrl = process.env.PISTON_URL;
    if (!baseUrl) {
        throw new AppError("Code runner is not configured on this server (PISTON_URL missing)", 503);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const stop = () => controller.abort();
    hooks.signal?.addEventListener("abort", stop, { once: true });
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
        if (hooks.signal?.aborted) {
            throw new AppError("Run was stopped", RUN_STOPPED_STATUS);
        }
        if ((err as Error).name === "AbortError") {
            throw new AppError("Code runner timed out", 504);
        }
        throw new AppError("Code runner is unreachable", 502);
    } finally {
        clearTimeout(timer);
        hooks.signal?.removeEventListener("abort", stop);
    }
};
