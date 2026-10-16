import { randomBytes } from "node:crypto";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { dockerExec, runContainer } from "./docker.js";
import { CompilerError } from "./errors.js";
import type { CompilerOptions, Language, Limits, RunOptions, RunResult, Stage } from "./types.js";
import {
    extensionOf,
    isLanguage,
    SOURCE_EXTENSIONS,
    validateFiles,
    validateFlags,
    validateStdin,
} from "./validate.js";

export * from "./types.js";
export { CompilerError, type CompilerErrorCode } from "./errors.js";
export { SOURCE_EXTENSIONS } from "./validate.js";

export const DEFAULT_IMAGE = "gcc:14";

export const DEFAULT_LIMITS: Limits = {
    compileTimeoutMs: 15_000,
    runTimeoutMs: 5_000,
    compileMemoryMb: 512,
    runMemoryMb: 256,
    cpus: 1,
    pids: 64,
    maxOutputBytes: 64 * 1024,
    maxSourceBytes: 256 * 1024,
    maxFiles: 50,
    maxStdinBytes: 64 * 1024,
};

const TOOLCHAIN: Record<Language, { cc: string; std: string }> = {
    c: { cc: "gcc", std: "-std=gnu17" },
    cpp: { cc: "g++", std: "-std=gnu++20" },
};

const WORK = "/work";
const BINARY = `${WORK}/a.out`;

/** A tiny FIFO semaphore so a burst of runs can't start dozens of containers. */
class Slots {
    private active = 0;
    private waiting: (() => void)[] = [];

    constructor(private max: number) {}

    async acquire(timeoutMs: number, signal?: AbortSignal): Promise<() => void> {
        if (this.active < this.max) {
            this.active++;
            return this.releaser();
        }
        return new Promise((resolve, reject) => {
            const grant = () => {
                clearTimeout(timer);
                signal?.removeEventListener("abort", onAbort);
                this.active++;
                resolve(this.releaser());
            };
            const leave = (err: CompilerError) => {
                clearTimeout(timer);
                this.waiting = this.waiting.filter((w) => w !== grant);
                reject(err);
            };
            const onAbort = () => leave(new CompilerError("ABORTED", "Run was aborted"));
            const timer = setTimeout(
                () => leave(new CompilerError("BUSY", "The compiler is busy, please try again shortly")),
                timeoutMs,
            );
            signal?.addEventListener("abort", onAbort, { once: true });
            this.waiting.push(grant);
        });
    }

    private releaser() {
        let released = false;
        return () => {
            if (released) return;
            released = true;
            this.active--;
            this.waiting.shift()?.();
        };
    }
}

/** Flags shared by both containers: no network, no privileges, bounded resources. */
const sandboxArgs = (limits: Limits, memoryMb: number, maxFileMb: number, runtime?: string) => [
    ...(runtime ? ["--runtime", runtime] : []),
    "--network", "none",
    "--cap-drop", "ALL",
    "--security-opt", "no-new-privileges",
    "--user", "65534:65534",
    "--read-only",
    "--tmpfs", "/tmp:rw,nosuid,nodev,size=64m",
    "--memory", `${memoryMb}m`,
    "--memory-swap", `${memoryMb}m`,
    "--cpus", String(limits.cpus),
    "--pids-limit", String(limits.pids),
    "--ulimit", "nofile=256:256",
    "--ulimit", `fsize=${maxFileMb * 1024 * 1024}`,
    "--env", "HOME=/tmp",
    "--workdir", WORK,
];

/**
 * In-container backstop: if the container outlives our own timer (e.g. the
 * force-remove raced its creation), coreutils `timeout` still kills it.
 */
const withTimeout = (timeoutMs: number, command: string[]) =>
    ["timeout", "-s", "KILL", String(Math.ceil(timeoutMs / 1000) + 2), ...command];

export class Compiler {
    readonly image: string;
    readonly limits: Limits;
    private docker: string;
    private runtime: string | undefined;
    private workRoot: string;
    private queueTimeoutMs: number;
    private slots: Slots;
    private version: Promise<string> | null = null;

    constructor(options: CompilerOptions = {}) {
        this.image = options.image ?? DEFAULT_IMAGE;
        this.docker = options.dockerPath ?? "docker";
        this.runtime = options.runtime;
        this.workRoot = options.workRoot ?? tmpdir();
        this.queueTimeoutMs = options.queueTimeoutMs ?? 30_000;
        this.limits = { ...DEFAULT_LIMITS, ...options.limits };
        this.slots = new Slots(Math.max(1, options.maxConcurrent ?? 4));
    }

    /** True when the Docker daemon is reachable. */
    async isAvailable(): Promise<boolean> {
        try {
            const { code } = await dockerExec(this.docker, ["version", "--format", "{{.Server.Version}}"], 10_000);
            return code === 0;
        } catch {
            return false;
        }
    }

    /** Pulls the compiler image if it isn't present yet (first run would otherwise be slow). */
    async prepare(): Promise<void> {
        const inspect = await dockerExec(this.docker, ["image", "inspect", this.image], 30_000);
        if (inspect.code === 0) return;
        const pull = await dockerExec(this.docker, ["pull", this.image], 10 * 60_000);
        if (pull.code !== 0) {
            throw new CompilerError("DOCKER_UNAVAILABLE", `Could not pull ${this.image}: ${pull.stderr.trim()}`);
        }
    }

    /** The gcc version inside the image, e.g. "14.2.0". */
    getVersion(): Promise<string> {
        this.version ??= dockerExec(this.docker, [
            "run", "--rm", "--network", "none", this.image, "gcc", "-dumpfullversion",
        ]).then(({ code, stdout, stderr }) => {
            if (code !== 0) {
                throw new CompilerError("DOCKER_UNAVAILABLE", stderr.trim().split("\n")[0] || "Compiler image unavailable");
            }
            return stdout.trim();
        });
        // Don't cache failures (e.g. daemon started later)
        this.version.catch(() => { this.version = null; });
        return this.version;
    }

    /** Compiles the files and, if that succeeds, runs the program with `stdin`. */
    async run(options: RunOptions): Promise<RunResult> {
        const started = Date.now();
        const { language, signal } = options;
        if (!isLanguage(language)) {
            throw new CompilerError("INVALID_INPUT", `Unsupported language: ${String(language)} (use "c" or "cpp")`);
        }
        const files = validateFiles(language, options.files, this.limits);
        const flags = validateFlags(options.flags);
        const stdin = validateStdin(options.stdin, this.limits);
        if (signal?.aborted) throw new CompilerError("ABORTED", "Run was aborted");

        const release = await this.slots.acquire(this.queueTimeoutMs, signal);
        const dir = await mkdtemp(join(this.workRoot, "aivex-cc-"));
        try {
            // The container user (nobody) must be able to write the binary
            await chmod(dir, 0o777);
            for (const file of files) {
                const target = join(dir, file.name);
                await mkdir(dirname(target), { recursive: true, mode: 0o755 });
                await writeFile(target, file.content, { mode: 0o644 });
            }

            const [version, compile] = await Promise.all([
                this.getVersion(),
                this.compile(language, dir, files.map((f) => f.name), flags, signal),
            ]);

            if (compile.code !== 0) {
                return { language, version, compile, durationMs: Date.now() - started };
            }

            const run = await this.execute(dir, stdin, options);
            return { language, version, compile, run, durationMs: Date.now() - started };
        } finally {
            release();
            await rm(dir, { recursive: true, force: true }).catch(() => {});
        }
    }

    private compile(language: Language, dir: string, names: string[], flags: string[], signal?: AbortSignal): Promise<Stage> {
        const { cc, std } = TOOLCHAIN[language];
        const sources = names
            .filter((n) => SOURCE_EXTENSIONS[language].includes(extensionOf(n)))
            .map((n) => `${WORK}/${n}`);
        const defaults = [
            ...(flags.some((f) => f.startsWith("-std=")) ? [] : [std]),
            ...(flags.some((f) => /^-O/.test(f)) ? [] : ["-O2"]),
        ];

        return runContainer({
            docker: this.docker,
            name: `aivex-cc-${randomBytes(8).toString("hex")}`,
            runArgs: [
                ...sandboxArgs(this.limits, this.limits.compileMemoryMb, 64, this.runtime),
                "--volume", `${dir}:${WORK}`,
                this.image,
            ],
            command: withTimeout(this.limits.compileTimeoutMs, [
                cc, ...defaults, ...flags, "-pipe", `-I${WORK}`,
                "-fdiagnostics-color=never", "-o", BINARY, ...sources, "-lm",
            ]),
            timeoutMs: this.limits.compileTimeoutMs,
            maxOutputBytes: this.limits.maxOutputBytes,
            signal,
        }).then((stage) => ({
            ...stage,
            // Paths in diagnostics should match the project, not the sandbox
            stdout: stage.stdout.replaceAll(`${WORK}/`, ""),
            stderr: stage.stderr.replaceAll(`${WORK}/`, ""),
        }));
    }

    private execute(dir: string, stdin: string, options: RunOptions): Promise<Stage> {
        return runContainer({
            docker: this.docker,
            name: `aivex-cc-${randomBytes(8).toString("hex")}`,
            runArgs: [
                ...sandboxArgs(this.limits, this.limits.runMemoryMb, 16, this.runtime),
                "--volume", `${dir}:${WORK}:ro`,
                this.image,
            ],
            command: withTimeout(this.limits.runTimeoutMs, [BINARY]),
            stdin,
            timeoutMs: this.limits.runTimeoutMs,
            maxOutputBytes: this.limits.maxOutputBytes,
            onStdout: options.onStdout,
            onStderr: options.onStderr,
            signal: options.signal,
        });
    }
}

let defaultCompiler: Compiler | null = null;

/** Compile and run with a shared default `Compiler` instance. */
export const compileAndRun = (options: RunOptions): Promise<RunResult> => {
    defaultCompiler ??= new Compiler();
    return defaultCompiler.run(options);
};
