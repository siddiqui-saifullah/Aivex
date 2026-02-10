import * as ai from "../controllers/ai.controller.js";
import * as chatService from "../services/chats.service.js";


export const initializeSocketHandlers = (io) => {
    io.on('connection', (socket) => {
        handleUserConnection(socket, io);
    });
};


const handleUserConnection = (socket, io) => {
    console.log("user connected:", socket.user.id);

    const roomId = socket.project._id.toString();
    socket.join(roomId);

    // Emit user join event to others
    socket.broadcast.to(roomId).emit("user-joined", {
        userId: socket.user.id,
        username: socket.user.username,
        timestamp: Date.now(),
    });

    // Listen for project messages
    socket.on('project-message', (data) =>
        handleProjectMessage(socket, data, io, roomId)
    );

    // Listen for typing indicator
    socket.on('user-typing', (data) => {
        socket.broadcast.to(roomId).emit('user-typing', {
            userId: socket.user.id,
            username: socket.user.username,
            isTyping: data.isTyping,
        });
    });

    // Generic event handler
    socket.on('event', (data) => {
        // TODO: Implement custom event handling
    });

    // Handle user disconnect
    socket.on("disconnect", () => {
        handleUserDisconnect(socket, roomId);
    });
};


const handleProjectMessage = async (socket, data, io, roomId) => {
    const message = data?.message;

    if (typeof message !== "string" || !message.trim()) {
        return;
    }

    const text = message.trim();

    await handleUserMessage(socket, text, io, roomId);

    if (text.toLowerCase().startsWith("@vex")) {
        handleAiMessage(socket, text, io, roomId);
    }
};


const handleAiMessage = async (socket, message, io, roomId) => {
    const prompt = message.replace(/^@vex/i, "").trim();

    const response = await ai.getResult({ prompt });

    const savedMessage = await chatService.createProjectChat({
        projectId: socket.project._id,
        senderId: null,
        role: "ai",
        text: response?.text,
    });

    const aiMessage = {
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



const handleUserMessage = async (socket, message, io, roomId) => {
    const savedMessage = await chatService.createProjectChat({
        projectId: socket.project._id,
        senderId: socket.user.id,
        role: "user",
        text: message,
        filePatch: null,
    });

    const safeMessage = {
        message: savedMessage.text,
        sender: {
            id: socket.user.id,
            username: socket.user.username,
        },
        timestamp: savedMessage.createdAt,
    };

    socket.broadcast.to(roomId).emit("project-message", safeMessage);
};



const handleUserDisconnect = (socket, roomId) => {
    console.log("user disconnected:", socket.user.id);
    socket.leave(roomId);
};
