import AppError from "../errors/AppError.js";
import * as runner from "../services/runner.service.js";
import type { RunHooks, RunStage } from "../services/runner.service.js";
import type { AppSocket } from "./socketHandler.js";

/**
 * Live code runs over the project socket. Output goes only to the socket that
 * started the run, as it is produced (C/C++ in the Docker sandbox) or all at
 * once when the run finishes (Piston languages).
 *
 *   client -> run:start { runId, language, files, stdin }   (ack: { ok } | { ok: false, error })
 *   server -> run:compiled { runId, compile }
 *   server -> run:output { runId, chunks: [{ stream, text }] }
 *   server -> run:exit { runId, compile?, run?, version, durationMs }
 *   server -> run:error { runId, error, stopped? }
 *   client -> run:stop { runId }
 */

export type OutputStream = "stdout" | "stderr";

export interface RunServerEvents {
    "run:compiled": (data: { runId: string; compile: RunStage }) => void;
    "run:output": (data: { runId: string; chunks: { stream: OutputStream; text: string }[] }) => void;
    "run:exit": (data: {
        runId: string;
        compile?: RunStage;
        /** Missing when compilation failed. */
        run?: RunStage;
        version: string;
        durationMs: number;
    }) => void;
    "run:error": (data: { runId: string; error: string; stopped?: boolean }) => void;
}

type StartAck = (response: { ok: true } | { ok: false; error: string }) => void;

export interface RunClientEvents {
    "run:start": (data: { runId?: unknown; language?: unknown; files?: unknown; stdin?: unknown }, ack?: StartAck) => void;
    "run:stop": (data: { runId?: unknown }) => void;
}

const RUN_ID = /^[A-Za-z0-9_-]{1,64}$/;
/** Program output is sent at most this often, so tight print loops can't flood the socket. */
const FLUSH_INTERVAL_MS = 50;

/** Collects output chunks and sends them in batches, keeping stdout/stderr order. */
const createOutputBatcher = (send: (chunks: { stream: OutputStream; text: string }[]) => void) => {
    let pending: { stream: OutputStream; text: string }[] = [];
    let timer: NodeJS.Timeout | null = null;

    const flush = () => {
        if (timer) clearTimeout(timer);
        timer = null;
        if (pending.length) send(pending);
        pending = [];
    };

    const push = (stream: OutputStream, text: string) => {
        const last = pending[pending.length - 1];
        if (last?.stream === stream) last.text += text;
        else pending.push({ stream, text });
        timer ??= setTimeout(flush, FLUSH_INTERVAL_MS);
    };

    return { push, flush };
};

export const handleRunner = (socket: AppSocket) => {
    // One run at a time per connection
    let active: { runId: string; controller: AbortController } | null = null;

    socket.on("run:start", (data, ack) => {
        const runId = data?.runId;
        if (typeof runId !== "string" || !RUN_ID.test(runId)) {
            ack?.({ ok: false, error: "Invalid run id" });
            return;
        }
        if (active) {
            ack?.({ ok: false, error: "A program is already running" });
            return;
        }
        const waitMs = runner.runLimiter(socket.data.user.id);
        if (waitMs > 0) {
            ack?.({ ok: false, error: `Too many runs, try again in ${Math.ceil(waitMs / 1000)}s` });
            return;
        }

        const controller = new AbortController();
        active = { runId, controller };
        ack?.({ ok: true });

        const output = createOutputBatcher((chunks) => socket.emit("run:output", { runId, chunks }));
        const hooks: RunHooks = {
            signal: controller.signal,
            onCompiled: (compile) => {
                output.flush();
                socket.emit("run:compiled", { runId, compile });
            },
            onStdout: (text) => output.push("stdout", text),
            onStderr: (text) => output.push("stderr", text),
        };

        runner.runCode({ language: data.language, files: data.files, stdin: data.stdin ?? "" }, hooks)
            .then((result) => {
                const compiled = !result.compile || result.compile.code === 0;
                if (!hooks.streamed) {
                    // Piston: replay the finished run as if it had streamed
                    if (result.compile) socket.emit("run:compiled", { runId, compile: result.compile });
                    if (compiled) {
                        if (result.run.stdout) output.push("stdout", result.run.stdout);
                        if (result.run.stderr) output.push("stderr", result.run.stderr);
                    }
                }
                output.flush();
                socket.emit("run:exit", {
                    runId,
                    compile: result.compile,
                    run: compiled ? result.run : undefined,
                    version: result.version,
                    durationMs: result.durationMs,
                });
            })
            .catch((err: unknown) => {
                output.flush();
                const isAppError = err instanceof AppError;
                if (!isAppError) console.error("socket run failed:", err);
                socket.emit("run:error", {
                    runId,
                    error: isAppError ? err.message : "The code runner failed",
                    stopped: isAppError && err.statusCode === runner.RUN_STOPPED_STATUS,
                });
            })
            .finally(() => {
                if (active?.runId === runId) active = null;
            });
    });

    socket.on("run:stop", (data) => {
        if (active && data?.runId === active.runId) active.controller.abort();
    });

    // Nobody is listening any more: free the sandbox
    socket.on("disconnect", () => active?.controller.abort());
};
