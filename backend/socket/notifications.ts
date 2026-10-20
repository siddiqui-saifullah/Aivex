import type { Namespace, Server } from "socket.io";
import { authenticateSocketUser } from "../middleware/socketAuth.middleware.js";

/**
 * Per-user realtime channel (namespace "/notifications"): any page can listen
 * for a user's notifications without joining a project.
 */
let namespace: Namespace | null = null;

const userRoom = (userId: string) => `user:${userId}`;

export const initNotificationSocket = (io: Server) => {
    namespace = io.of("/notifications");
    namespace.use(async (socket, next) => {
        const user = await authenticateSocketUser(socket.handshake);
        if (!user) return next(new Error("Authentication error"));
        socket.data.user = user;
        next();
    });
    namespace.on("connection", (socket) => {
        socket.join(userRoom(socket.data.user.id));
    });
};

export const emitToUser = (userId: string, event: string, payload: unknown) => {
    namespace?.to(userRoom(userId)).emit(event, payload);
};
