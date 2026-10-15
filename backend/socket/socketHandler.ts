import type { Server, Socket } from "socket.io";
import * as ai from "../controllers/ai.controller.js";
import * as chatService from "../services/chats.service.js";
import type { AiResponse, SocketData } from "../types/index.js";

interface ChatSender {
    id: string;
    username: string;
}

interface ProjectMessagePayload {
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
}

interface ClientToServerEvents {
    "project-message": (data: { message?: unknown }) => void;
    "user-typing": (data: { isTyping?: boolean }) => void;
    event: (data: unknown) => void;
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
    socket.on('project-message', (data) => {
        // Listener promises are not awaited by socket.io; an unhandled rejection
        // here would crash the whole process, so always catch.
        handleProjectMessage(socket, data, io, roomId).catch((err) => {
            console.error("project-message handler failed:", err);
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

    // Generic event handler
    socket.on('event', () => {
        // TODO: Implement custom event handling
    });

    // Handle user disconnect
    socket.on("disconnect", () => {
        handleUserDisconnect(socket, roomId);
    });
};


const handleProjectMessage = async (socket: AppSocket, data: { message?: unknown }, io: AppServer, roomId: string) => {
    const message = data?.message;

    if (typeof message !== "string" || !message.trim()) {
        return;
    }

    const text = message.trim();

    await handleUserMessage(socket, text, io, roomId);

    if (text.toLowerCase().startsWith("@vex")) {
        await handleAiMessage(socket, text, io, roomId);
    }
};


const handleAiMessage = async (socket: AppSocket, message: string, io: AppServer, roomId: string) => {
    const prompt = message.replace(/^@vex/i, "").trim();

    const response: AiResponse = (await ai.getResult({ prompt })) ?? {
        text: "AI failed to generate response",
    };

    const savedMessage = await chatService.createProjectChat({
        projectId: socket.data.project._id,
        senderId: null,
        role: "ai",
        text: response.text,
    });

    const aiMessage: ProjectMessagePayload = {
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



const handleUserMessage = async (socket: AppSocket, message: string, io: AppServer, roomId: string) => {
    const savedMessage = await chatService.createProjectChat({
        projectId: socket.data.project._id,
        senderId: socket.data.user.id,
        role: "user",
        text: message,
        filePatch: null,
    });

    const safeMessage: ProjectMessagePayload = {
        message: savedMessage.text,
        sender: {
            id: socket.data.user.id,
            username: socket.data.user.username,
        },
        timestamp: savedMessage.createdAt,
    };

    socket.broadcast.to(roomId).emit("project-message", safeMessage);
};



const handleUserDisconnect = (socket: AppSocket, roomId: string) => {
    console.log("user disconnected:", socket.data.user.id);
    socket.leave(roomId);
};
