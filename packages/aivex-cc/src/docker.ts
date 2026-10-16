import { spawn } from "node:child_process";
import { constants } from "node:os";
import { StringDecoder } from "node:string_decoder";
import { CompilerError } from "./errors.js";
import type { Stage } from "./types.js";

export interface ContainerRun {
    docker: string;
    /** Unique container name, used to force-remove it on timeout/abort. */
    name: string;
    /** Everything between "docker run" and the command (flags, image). */
    runArgs: string[];
    command: string[];
    stdin?: string;
    timeoutMs: number;
    maxOutputBytes: number;
    onStdout?: (chunk: string) => void;
    onStderr?: (chunk: string) => void;
    signal?: AbortSignal;
}

const SIGNAL_NAMES = new Map<number, string>(
    Object.entries(constants.signals).map(([name, num]) => [num, name]),
);

/** docker run exits with 125 when the daemon fails or the container can't be created. */
const DOCKER_ERROR_EXIT = 125;

class OutputBuffer {
    private chunks: Buffer[] = [];
    private size = 0;
    private decoder = new StringDecoder("utf8");
    truncated = false;

    constructor(private limit: number, private onChunk?: (chunk: string) => void) {}

    /** Returns false once the limit is reached. */
    push(chunk: Buffer): boolean {
        if (this.truncated) return false;
        const room = this.limit - this.size;
        const piece = chunk.length > room ? chunk.subarray(0, room) : chunk;
        this.chunks.push(piece);
        this.size += piece.length;
        if (this.onChunk && piece.length) {
            const text = this.decoder.write(piece);
            if (text) this.onChunk(text);
        }
        if (chunk.length > room) this.truncated = true;
        return !this.truncated;
    }

    toString() {
        const text = Buffer.concat(this.chunks).toString("utf8");
        return this.truncated ? `${text}\n[output truncated]` : text;
    }
}

const forceRemove = (docker: string, name: string) =>
    new Promise<void>((resolve) => {
        const rm = spawn(docker, ["rm", "-f", name], { stdio: "ignore" });
        rm.on("error", () => resolve());
        rm.on("close", () => resolve());
    });

/** Runs one container to completion and reports how its command ended. */
export const runContainer = (opts: ContainerRun): Promise<Stage> =>
    new Promise((resolve, reject) => {
        const started = Date.now();
        const child = spawn(
            opts.docker,
            ["run", "--rm", "-i", "--name", opts.name, ...opts.runArgs, ...opts.command],
            { stdio: ["pipe", "pipe", "pipe"] },
        );

        const stdout = new OutputBuffer(opts.maxOutputBytes, opts.onStdout);
        const stderr = new OutputBuffer(opts.maxOutputBytes, opts.onStderr);
        let timedOut = false;
        let aborted = false;
        let stopping: Promise<void> | null = null;

        const stop = () => {
            stopping ??= forceRemove(opts.docker, opts.name);
            return stopping;
        };

        const timer = setTimeout(() => {
            timedOut = true;
            void stop();
        }, opts.timeoutMs);

        const onAbort = () => {
            aborted = true;
            void stop();
        };
        opts.signal?.addEventListener("abort", onAbort, { once: true });

        // Kill runaway output early instead of letting it run until the timeout
        child.stdout.on("data", (c: Buffer) => { if (!stdout.push(c)) void stop(); });
        child.stderr.on("data", (c: Buffer) => { if (!stderr.push(c)) void stop(); });

        // The program may exit without reading its input
        child.stdin.on("error", () => {});
        child.stdin.end(opts.stdin ?? "");

        child.on("error", (err: NodeJS.ErrnoException) => {
            clearTimeout(timer);
            opts.signal?.removeEventListener("abort", onAbort);
            reject(new CompilerError(
                "DOCKER_UNAVAILABLE",
                err.code === "ENOENT" ? `Docker CLI not found (${opts.docker})` : `Could not start Docker: ${err.message}`,
            ));
        });

        child.on("close", async (exitCode, exitSignal) => {
            clearTimeout(timer);
            opts.signal?.removeEventListener("abort", onAbort);
            if (stopping) await stopping;

            if (aborted) {
                return reject(new CompilerError("ABORTED", "Run was aborted"));
            }

            const err = stderr.toString();
            if (exitCode === DOCKER_ERROR_EXIT && !timedOut && /^docker: /m.test(err)) {
                return reject(new CompilerError("DOCKER_UNAVAILABLE", err.trim().split("\n")[0] || "Docker failed"));
            }

            // Inside the container a signal-killed process shows up as 128 + signal number
            let code: number | null = exitCode;
            let signal: string | null = exitSignal;
            if (timedOut) {
                code = null;
                signal = "SIGKILL";
            } else if (code !== null && code > 128 && SIGNAL_NAMES.has(code - 128)) {
                signal = SIGNAL_NAMES.get(code - 128)!;
                code = null;
            }

            resolve({
                stdout: stdout.toString(),
                stderr: err,
                code,
                signal,
                timedOut,
                truncated: stdout.truncated || stderr.truncated,
                durationMs: Date.now() - started,
            });
        });
    });

/** Plain `docker <args>`, collecting output. Used for version checks and pulls. */
export const dockerExec = (docker: string, args: string[], timeoutMs = 60_000) =>
    new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
        const child = spawn(docker, args, { stdio: ["ignore", "pipe", "pipe"] });
        let stdout = "";
        let stderr = "";
        const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
        child.stdout.on("data", (c: Buffer) => { stdout += c; });
        child.stderr.on("data", (c: Buffer) => { stderr += c; });
        child.on("error", (err) => {
            clearTimeout(timer);
            reject(new CompilerError("DOCKER_UNAVAILABLE", `Could not start Docker: ${err.message}`));
        });
        child.on("close", (code) => {
            clearTimeout(timer);
            resolve({ code, stdout, stderr });
        });
    });
