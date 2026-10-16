export type Language = "c" | "cpp";

export interface SourceFile {
    /** Path relative to the project root, e.g. "main.cpp" or "lib/util.h". */
    name: string;
    content: string;
}

export interface Limits {
    /** Wall-clock limit for the compiler, in ms. */
    compileTimeoutMs: number;
    /** Wall-clock limit for the program, in ms. */
    runTimeoutMs: number;
    /** Memory for the compiler container, in MB. */
    compileMemoryMb: number;
    /** Memory for the program container, in MB. */
    runMemoryMb: number;
    /** CPU cores available to each container (may be fractional). */
    cpus: number;
    /** Max processes/threads inside a container (stops fork bombs). */
    pids: number;
    /** Stdout and stderr are each cut off after this many bytes. */
    maxOutputBytes: number;
    /** Total size of all source files. */
    maxSourceBytes: number;
    maxFiles: number;
    maxStdinBytes: number;
}

export interface CompilerOptions {
    /** Docker image with gcc and g++. Default "gcc:14". */
    image?: string;
    /**
     * Docker runtime for the sandbox containers, e.g. "runsc" (gVisor) for a
     * stronger kernel boundary. Default: Docker's default runtime (runc).
     */
    runtime?: string;
    /** Docker CLI executable. Default "docker". */
    dockerPath?: string;
    /**
     * Where temporary work directories are created. Default: the OS temp dir.
     * If this process itself runs in a container that talks to the host's
     * Docker daemon, this must be a directory mounted at the same path on the host.
     */
    workRoot?: string;
    /** How many programs may compile/run at once; extra calls wait. Default 4. */
    maxConcurrent?: number;
    /** Calls waiting longer than this for a slot fail with BUSY. Default 30s. */
    queueTimeoutMs?: number;
    limits?: Partial<Limits>;
}

export interface RunOptions {
    language: Language;
    /** The first file is treated as the entry point (it is always compiled). */
    files: SourceFile[];
    stdin?: string;
    /** Extra compiler flags, e.g. ["-O0", "-g"]. Only flags from a safe allowlist are accepted. */
    flags?: string[];
    /** Called with chunks of program output as they arrive. */
    onStdout?: (chunk: string) => void;
    onStderr?: (chunk: string) => void;
    signal?: AbortSignal;
}

export interface Stage {
    stdout: string;
    stderr: string;
    /** Exit code, or null when the process was killed by a signal. */
    code: number | null;
    signal: string | null;
    /** True when the stage hit its time limit. */
    timedOut: boolean;
    /** True when stdout or stderr was cut off at maxOutputBytes. */
    truncated: boolean;
    durationMs: number;
}

export interface RunResult {
    language: Language;
    /** Compiler version, e.g. "14.2.0". */
    version: string;
    compile: Stage;
    /** Missing when compilation failed. */
    run?: Stage;
    durationMs: number;
}
