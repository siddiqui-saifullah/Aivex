import type { Types } from "mongoose";

/** Identity attached to an authenticated HTTP request. */
export interface AuthUser {
    _id: Types.ObjectId | string;
}

/** Data stored on each authenticated socket connection (`socket.data`). */
export interface SocketData {
    user: { id: string; username: string };
    project: { _id: Types.ObjectId };
}

/** A single file or directory in the WebContainer-style tree the AI returns. */
export type FileTreeNode =
    | { file: { contents: string } }
    | { directory: Record<string, FileTreeNode> };

export interface AiResponse {
    text?: string;
    fileTree?: Record<string, FileTreeNode>;
    /** Paths the AI wants removed from the project. */
    deletedFiles?: string[];
    buildCommand?: string[];
    runCommand?: string[];
}

export interface IssueReport {
    type?: "bug" | "feature" | "feedback";
    title?: string;
    description?: string;
    severity?: "low" | "medium" | "high" | "critical";
    context?: Record<string, unknown>;
}
