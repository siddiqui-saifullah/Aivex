export type CompilerErrorCode =
    /** The request itself is bad (unknown language, unsafe path, too large...). */
    | "INVALID_INPUT"
    /** Docker is missing, not running, or the image can't be started. */
    | "DOCKER_UNAVAILABLE"
    /** Waited too long for a free slot. */
    | "BUSY"
    /** The caller aborted the run. */
    | "ABORTED";

export class CompilerError extends Error {
    readonly code: CompilerErrorCode;

    constructor(code: CompilerErrorCode, message: string) {
        super(message);
        this.name = "CompilerError";
        this.code = code;
    }
}
