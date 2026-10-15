import type { Server, Socket } from "socket.io";
import * as ai from "../controllers/ai.controller.js";
import * as chatService from "../services/chats.service.js";
import * as projectService from "../services/project.service.js";
import type { EditorFocus } from "../services/ai.service.js";
import type { AiResponse, SocketData } from "../types/index.js";
import { flattenFileTree } from "../utils/flattenFileTree.js";
import { fromStoredFiles } from "../utils/fileStore.js";
import Project from "../models/project.model.js";
import ChatMessage from "../models/chat.model.js";

interface ChatSender {
    id: string;
    username: string;
}

interface ProjectMessagePayload {
    id: string;
    message: string | AiResponse;
    role?: "ai";
    sender: ChatSender;
    isAI?: boolean;
    /** AI file changes were already saved to the project on the server. */
    filesSaved?: boolean;
    timestamp: Date | undefined;
}

interface ServerToClientEvents {
    "user-joined": (data: { userId: string; username: string; timestamp: number }) => void;
    "user-typing": (data: { userId: string; username: string; isTyping: boolean }) => void;
    "project-message": (data: ProjectMessagePayload) => void;
    "message-deleted": (data: { id: string }) => void;
    "project-updated": (data: { projectId: string; reason: string }) => void;
}

type Ack<T> = (response: T) => void;
type SendAck = Ack<{ ok: true; id: string; timestamp?: Date } | { ok: false; error: string }>;
type DeleteAck = Ack<{ ok: boolean; error?: string }>;

interface ClientToServerEvents {
    "project-message": (data: { message?: unknown; context?: unknown }, ack?: SendAck) => void;
    "user-typing": (data: { isTyping?: boolean }) => void;
    "delete-message": (data: { id?: unknown }, ack?: DeleteAck) => void;
}

export type AppServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
export type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;


export const initializeSocketHandlers = (io: AppServer) => {
    io.on('connection', (socket) => {
        handleUserConnection(socket, io);
    });
};


const handleUserConnection = (socket: AppSocket, io: AppServer) => {
    console.log("user connected:", socket.data.user.id);

    const roomId = socket.data.project._id.toString();
    socket.join(roomId);

    // Emit user join event to others
    socket.broadcast.to(roomId).emit("user-joined", {
        userId: socket.data.user.id,
        username: socket.data.user.username,
        timestamp: Date.now(),
    });

    // Listen for project messages
    socket.on('project-message', (data, ack) => {
        // Listener promises are not awaited by socket.io; an unhandled rejection
        // here would crash the whole process, so always catch.
        handleProjectMessage(socket, data, io, roomId, ack).catch((err) => {
            console.error("project-message handler failed:", err);
            ack?.({ ok: false, error: "Failed to send message" });
        });
    });

    // Delete one of your own messages
    socket.on('delete-message', (data, ack) => {
        handleDeleteMessage(socket, data, io, roomId)
            .then(() => ack?.({ ok: true }))
            .catch((err: Error) => {
                ack?.({ ok: false, error: err.message || "Failed to delete message" });
            });
    });

    // Listen for typing indicator
    socket.on('user-typing', (data) => {
        socket.broadcast.to(roomId).emit('user-typing', {
            userId: socket.data.user.id,
            username: socket.data.user.username,
            isTyping: Boolean(data?.isTyping),
        });
    });

    // Handle user disconnect
    socket.on("disconnect", () => {
        handleUserDisconnect(socket, roomId);
    });
};


/** What the editor sends along with an AI request (validated, size-capped). */
interface AiRequestContext {
    focus: EditorFocus;
    /** Unsaved contents of the open file, so the AI sees the latest edits. */
    activeFileContent?: string;
}

const MAX_ACTIVE_FILE_CHARS = 100_000;
const MAX_SELECTION_CHARS = 20_000;

const parseAiContext = (raw: unknown): AiRequestContext => {
    const ctx = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const activeFile = typeof ctx.activeFile === "string" && ctx.activeFile.length < 500
        ? ctx.activeFile
        : undefined;
    if (!activeFile) return { focus: {} };

    const sel = (ctx.selection && typeof ctx.selection === "object" ? ctx.selection : null) as
        { startLine?: unknown; endLine?: unknown; text?: unknown } | null;
    const selection = sel
        && Number.isInteger(sel.startLine) && Number.isInteger(sel.endLine)
        && typeof sel.text === "string" && sel.text.trim() && sel.text.length <= MAX_SELECTION_CHARS
        ? { startLine: sel.startLine as number, endLine: sel.endLine as number, text: sel.text }
        : undefined;

    const activeFileContent = typeof ctx.activeFileContent === "string"
        && ctx.activeFileContent.length <= MAX_ACTIVE_FILE_CHARS
        ? ctx.activeFileContent
        : undefined;

    return { focus: { activeFile, selection }, activeFileContent };
};

const handleProjectMessage = async (
    socket: AppSocket,
    data: { message?: unknown; context?: unknown },
    io: AppServer,
    roomId: string,
    ack?: SendAck,
) => {
    const message = data?.message;

    if (typeof message !== "string" || !message.trim()) {
        ack?.({ ok: false, error: "Message cannot be empty" });
        return;
    }

    const text = message.trim();

    await handleUserMessage(socket, text, io, roomId, ack);

    if (text.toLowerCase().startsWith("@vex")) {
        await handleAiMessage(socket, text, io, roomId, parseAiContext(data?.context));
    }
};


/** Replies that carry no information for the next request (errors, quota). */
const AI_ERROR_REPLY = /^(AI failed|AI returned an empty|Vex AI (has reached|is busy|couldn't))/;

/**
 * Only the conversation with the AI is useful context: drop members'
 * small talk and failed replies, and strip the "@vex" prefix (token savings
 * matter on the free Gemini tier).
 */
const toAiHistory = (chats: { role: string; text: string }[]) =>
    chats
        .filter(c => c.role === "ai" ? !AI_ERROR_REPLY.test(c.text) : /^\s*@vex\b/i.test(c.text))
        .map(c => ({
            role: (c.role === "ai" ? "ai" : "user") as "ai" | "user",
            text: c.text.replace(/^\s*@vex\b\s*/i, ""),
        }));

const handleAiMessage = async (
    socket: AppSocket,
    message: string,
    io: AppServer,
    roomId: string,
    { focus, activeFileContent }: AiRequestContext,
) => {
    const prompt = message.replace(/^@vex/i, "").trim();
    const projectId = socket.data.project._id;

    // Give the AI the current project and the recent conversation so it edits
    // what exists instead of starting from scratch
    const [project, recentChats] = await Promise.all([
        Project.findById(projectId).select("files aiMemory").lean(),
        ChatMessage.find({ project: projectId })
            .sort({ createdAt: -1 })
            .limit(12)
            .select("role text")
            .lean(),
    ]);

    const files = fromStoredFiles(project?.files);
    // The open file may have unsaved edits in the browser; use those
    if (focus.activeFile && activeFileContent !== undefined) {
        files[focus.activeFile] = activeFileContent;
    }

    const response: AiResponse = (await ai.getResult({
        prompt,
        files,
        memory: project?.aiMemory ?? "",
        focus,
        history: toAiHistory(recentChats.reverse().slice(0, -1)), // last = this request
    })) ?? {
        text: "AI failed to generate response",
    };

    const changedFiles = flattenFileTree(response.fileTree);
    const deletedFiles = Array.isArray(response.deletedFiles)
        ? response.deletedFiles.filter((p): p is string => typeof p === "string")
        : [];

    // Save the AI's edits (and updated memory) to the project right away,
    // so they persist even if nobody presses save
    let filesSaved = false;
    try {
        filesSaved = await projectService.applyAiChanges({
            projectId,
            changed: changedFiles,
            deleted: deletedFiles,
            memory: typeof response.memory === "string" ? response.memory : undefined,
        });
    } catch (err) {
        console.error("Failed to save AI changes:", err);
    }

    // Also keep the files on the message so they can be re-applied from chat history
    const savedMessage = await chatService.createProjectChat({
        projectId: socket.data.project._id,
        senderId: null,
        role: "ai",
        text: response.text,
        filePatch: Object.keys(changedFiles).length > 0 ? changedFiles : null,
    });

    const aiMessage: ProjectMessagePayload = {
        id: String(savedMessage._id),
        message: response,
        role: "ai",
        sender: {
            id: "aivex",
            username: "AiVex",
        },
        isAI: true,
        filesSaved,
        timestamp: savedMessage.createdAt,
    };

    io.to(roomId).emit("project-message", aiMessage);

    if (typeof response.memory === "string" && response.memory.trim()) {
        // Lets open panels show the refreshed memory
        io.to(roomId).emit("project-updated", { projectId: String(projectId), reason: "memory" });
    }
};



const handleUserMessage = async (
    socket: AppSocket,
    message: string,
    io: AppServer,
    roomId: string,
    ack?: SendAck,
) => {
    const savedMessage = await chatService.createProjectChat({
        projectId: socket.data.project._id,
        senderId: socket.data.user.id,
        role: "user",
        text: message,
        filePatch: null,
    });

    // Let the sender learn the stored id (needed to delete the message later)
    ack?.({ ok: true, id: String(savedMessage._id), timestamp: savedMessage.createdAt });

    const safeMessage: ProjectMessagePayload = {
        id: String(savedMessage._id),
        message: savedMessage.text,
        sender: {
            id: socket.data.user.id,
            username: socket.data.user.username,
        },
        timestamp: savedMessage.createdAt,
    };

    socket.broadcast.to(roomId).emit("project-message", safeMessage);
};



const handleDeleteMessage = async (
    socket: AppSocket,
    data: { id?: unknown },
    io: AppServer,
    roomId: string,
) => {
    const messageId = data?.id;
    if (typeof messageId !== "string") {
        throw new Error("Message id is required");
    }

    await chatService.deleteMessageById({
        messageId,
        userId: socket.data.user.id,
        projectId: socket.data.project._id,
    });

    io.to(roomId).emit("message-deleted", { id: messageId });
};



const handleUserDisconnect = (socket: AppSocket, roomId: string) => {
    console.log("user disconnected:", socket.data.user.id);
    socket.leave(roomId);
};
