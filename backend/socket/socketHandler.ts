import type { Server, Socket } from "socket.io";
import * as ai from "../controllers/ai.controller.js";
import * as chatService from "../services/chats.service.js";
import * as projectService from "../services/project.service.js";
import { AI_ERROR_REPLY, type EditorFocus } from "../services/ai.service.js";
import type { AiResponse, SocketData } from "../types/index.js";
import { flattenFileTree } from "../utils/flattenFileTree.js";
import { fromStoredFiles } from "../utils/fileStore.js";
import Project from "../models/project.model.js";
import ChatMessage from "../models/chat.model.js";
import * as Y from "yjs";
import * as collab from "./collab.js";
import { AI_DISABLED_MESSAGE, aiPolicyInProject } from "../services/aiPolicy.service.js";
import Assignment from "../models/assignment.model.js";
import { quotaMessage, quotaStatus, takeQuota, type QuotaStatus } from "../services/aiQuota.service.js";
import { notify } from "../services/notification.service.js";
import userModel from "../models/user.model.js";

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
    /** ...and applied to the live shared document (clients must not re-apply them). */
    filesSynced?: boolean;
    timestamp: Date | undefined;
}

interface ServerToClientEvents {
    "user-joined": (data: { userId: string; username: string; timestamp: number }) => void;
    "user-typing": (data: { userId: string; username: string; isTyping: boolean }) => void;
    "project-message": (data: ProjectMessagePayload) => void;
    "message-deleted": (data: { id: string }) => void;
    "project-updated": (data: { projectId: string; reason: string }) => void;
    "collab:update": (update: Uint8Array) => void;
    "collab:awareness": (update: Uint8Array) => void;
    "collab:left": (data: { clientId: number }) => void;
    "collab:saved": (data: { userId: string; username: string }) => void;
    /** The user's daily Vex allowance, after each question. */
    "ai-usage": (data: QuotaStatus) => void;
}

type Ack<T> = (response: T) => void;
type SendAck = Ack<{ ok: true; id: string; timestamp?: Date } | { ok: false; error: string }>;
type DeleteAck = Ack<{ ok: boolean; error?: string }>;
type CollabJoinAck = Ack<{ ok: true; update: Uint8Array; stateVector: Uint8Array } | { ok: false; error: string }>;

interface ClientToServerEvents {
    "project-message": (data: { message?: unknown; context?: unknown }, ack?: SendAck) => void;
    "user-typing": (data: { isTyping?: boolean }) => void;
    "delete-message": (data: { id?: unknown }, ack?: DeleteAck) => void;
    "collab:join": (data: { stateVector?: unknown; clientId?: unknown }, ack?: CollabJoinAck) => void;
    "collab:update": (update: unknown) => void;
    "collab:awareness": (update: unknown) => void;
    "collab:saved": () => void;
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

    handleCollab(socket, roomId);

    // Handle user disconnect
    socket.on("disconnect", () => {
        handleUserDisconnect(socket, roomId);
    });
};


/** Live collaborative editing: sync the project's shared document and cursors. */
const handleCollab = (socket: AppSocket, roomId: string) => {
    let joined = false;
    let clientId: number | null = null;

    socket.on("collab:join", (data, ack) => {
        collab.joinRoom(roomId, socket.id)
            .then((room) => {
                joined = true;
                clientId = Number.isInteger(data?.clientId) ? (data.clientId as number) : null;
                const stateVector = collab.toUpdate(data?.stateVector) ?? undefined;
                ack?.({
                    ok: true,
                    // Only what the client is missing
                    update: Y.encodeStateAsUpdate(room.doc, stateVector),
                    stateVector: Y.encodeStateVector(room.doc),
                });
            })
            .catch((err) => {
                console.error("collab:join failed:", err);
                ack?.({ ok: false, error: "Live editing is unavailable" });
            });
    });

    socket.on("collab:update", (raw) => {
        const update = collab.toUpdate(raw);
        if (!joined || !update) return;
        collab.getRoom(roomId)
            .then((room) => {
                if (!room) return;
                Y.applyUpdate(room.doc, update, socket.id);
                socket.broadcast.to(roomId).emit("collab:update", update);
            })
            .catch((err) => console.error("collab:update failed:", err));
    });

    // Cursors / selections: nothing to store, just relay
    socket.on("collab:awareness", (raw) => {
        const update = collab.toUpdate(raw);
        if (joined && update) socket.broadcast.to(roomId).emit("collab:awareness", update);
    });

    socket.on("collab:saved", () => {
        if (!joined) return;
        socket.broadcast.to(roomId).emit("collab:saved", {
            userId: socket.data.user.id,
            username: socket.data.user.username,
        });
    });

    socket.on("disconnect", () => {
        if (!joined) return;
        if (clientId !== null) socket.broadcast.to(roomId).emit("collab:left", { clientId });
        collab.leaveRoom(roomId, socket.id).catch(() => { /* already gone */ });
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
    const asksAi = text.toLowerCase().startsWith("@vex");

    // Checked on every request, so the teacher's changes apply immediately
    const aiPolicy = asksAi ? await aiPolicyInProject(socket.data.project._id, socket.data.user.id) : "allowed";
    if (aiPolicy === "disabled") {
        ack?.({ ok: false, error: AI_DISABLED_MESSAGE });
        return;
    }

    // Daily Vex allowance (checked before the message is posted)
    const refund = asksAi ? await takeQuota(socket.data.user.id, "vex") : null;
    if (asksAi && !refund) {
        const status = await quotaStatus(socket.data.user.id, "vex");
        socket.emit("ai-usage", status);
        ack?.({ ok: false, error: quotaMessage("vex", status) });
        return;
    }

    await handleUserMessage(socket, text, io, roomId, ack);

    if (asksAi) {
        const ok = await handleAiMessage(socket, text, io, roomId, parseAiContext(data?.context), aiPolicy === "hints");
        // A failed answer doesn't cost the user a question
        if (!ok) refund?.();
        socket.emit("ai-usage", await quotaStatus(socket.data.user.id, "vex"));
    }
};



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
    /** Assignment rule "hints": Vex teaches, and never writes code into the project. */
    hintsOnly = false,
): Promise<boolean> => {
    const prompt = message.replace(/^@vex/i, "").trim();
    const projectId = socket.data.project._id;

    // Give the AI the current project and the recent conversation so it edits
    // what exists instead of starting from scratch
    const [project, recentChats] = await Promise.all([
        Project.findById(projectId).select("files aiMemory assignment").lean(),
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

    const assignment = hintsOnly && project?.assignment
        ? await Assignment.findById(project.assignment).select("title instructions").lean()
        : null;

    const response: AiResponse = (await ai.getResult({
        prompt,
        files,
        memory: project?.aiMemory ?? "",
        focus,
        history: toAiHistory(recentChats.reverse().slice(0, -1)), // last = this request
        hintsOnly,
        task: assignment ? `${assignment.title}\n${assignment.instructions}` : undefined,
    })) ?? {
        text: "Vex AI is unavailable right now. Please try again later.",
    };
    // Enforced here, whatever the model answered
    if (hintsOnly) {
        delete response.fileTree;
        delete response.deletedFiles;
    }

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

    // Put the AI's edits into the live document so open editors update in place
    let filesSynced = false;
    if (Object.keys(changedFiles).length || deletedFiles.length) {
        try {
            const room = await collab.getRoom(String(projectId));
            if (room) {
                const update = collab.applyFileChanges(room.doc, changedFiles, deletedFiles);
                if (update) io.to(roomId).emit("collab:update", update);
                filesSynced = true;
            }
        } catch (err) {
            console.error("Failed to sync AI changes:", err);
        }
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
        filesSynced,
        timestamp: savedMessage.createdAt,
    };

    io.to(roomId).emit("project-message", aiMessage);

    if (typeof response.memory === "string" && response.memory.trim()) {
        // Lets open panels show the refreshed memory
        io.to(roomId).emit("project-updated", { projectId: String(projectId), reason: "memory" });
    }

    return !AI_ERROR_REPLY.test(response.text ?? "");
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

    notifyMentions(socket, message, io, roomId).catch((err) => console.error("mention notify failed:", err));
};

/** "@username" in a message notifies that member, unless they're in the project right now. */
const notifyMentions = async (socket: AppSocket, message: string, io: AppServer, roomId: string) => {
    const handles = new Set(
        [...message.matchAll(/(?:^|\s)@([\w-]{2,30})/g)].map((m) => m[1].toLowerCase()).filter((h) => h !== "vex"),
    );
    if (handles.size === 0) return;

    const project = await Project.findById(socket.data.project._id).select("name users").lean();
    if (!project) return;
    const members = await userModel.find({ _id: { $in: project.users } }).select("_id username").lean();
    const mentioned = members.filter(
        (m) => handles.has(String(m.username).toLowerCase()) && String(m._id) !== socket.data.user.id,
    );
    if (mentioned.length === 0) return;

    const online = new Set((await io.in(roomId).fetchSockets()).map((s) => s.data.user?.id));
    const recipients = mentioned.filter((m) => !online.has(String(m._id))).map((m) => m._id);

    await notify({
        users: recipients,
        type: "mention",
        title: `{actor} mentioned you in “${project.name}”`,
        body: message.length > 140 ? `${message.slice(0, 140)}…` : message,
        link: `/projects/${project._id}`,
        actorId: socket.data.user.id,
    });
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
