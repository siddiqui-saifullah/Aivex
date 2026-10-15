import type { Server, Socket } from "socket.io";
import * as ai from "../controllers/ai.controller.js";
import * as chatService from "../services/chats.service.js";
import type { AiResponse, SocketData } from "../types/index.js";
import { flattenFileTree } from "../utils/flattenFileTree.js";

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
    "project-message": (data: { message?: unknown }, ack?: SendAck) => void;
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


const handleProjectMessage = async (
    socket: AppSocket,
    data: { message?: unknown },
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
        await handleAiMessage(socket, text, io, roomId);
    }
};


const handleAiMessage = async (socket: AppSocket, message: string, io: AppServer, roomId: string) => {
    const prompt = message.replace(/^@vex/i, "").trim();

    const response: AiResponse = (await ai.getResult({ prompt })) ?? {
        text: "AI failed to generate response",
    };

    // Persist generated files with the message so they survive a reload
    const files = flattenFileTree(response.fileTree);

    const savedMessage = await chatService.createProjectChat({
        projectId: socket.data.project._id,
        senderId: null,
        role: "ai",
        text: response.text,
        filePatch: Object.keys(files).length > 0 ? files : null,
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
        timestamp: savedMessage.createdAt,
    };

    io.to(roomId).emit("project-message", aiMessage);
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
