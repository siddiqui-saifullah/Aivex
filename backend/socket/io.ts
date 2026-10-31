import type { AppServer } from "./socketHandler.js";

/**
 * Holds the socket.io server so HTTP controllers can push realtime
 * updates to a project's room.
 */
let ioInstance: AppServer | null = null;

export const setIo = (io: AppServer) => {
    ioInstance = io;
};

export type ProjectUpdateReason = "members" | "owner" | "renamed" | "deleted" | "memory" | "ai-policy" | "assignment" | "help";

/** Tell everyone in a project's room that its metadata changed. */
export const notifyProjectUpdated = (projectId: string, reason: ProjectUpdateReason) => {
    ioInstance?.to(String(projectId)).emit("project-updated", { projectId: String(projectId), reason });
};

/** Drop a user's live connections to a project they no longer belong to. */
export const disconnectUserFromProject = async (projectId: string, userId: string) => {
    if (!ioInstance) return;

    const sockets = await ioInstance.in(String(projectId)).fetchSockets();
    for (const socket of sockets) {
        if (socket.data.user?.id === String(userId)) {
            socket.emit("project-updated", { projectId: String(projectId), reason: "members" });
            socket.disconnect(true);
        }
    }
};

/** A chat message was removed (e.g. by a moderator): drop it from open chats. */
export const notifyMessageDeleted = (projectId: string, messageId: string) => {
    ioInstance?.to(String(projectId)).emit("message-deleted", { id: String(messageId) });
};

/** Close every live connection of a user (suspended accounts). */
export const disconnectUser = async (userId: string) => {
    if (!ioInstance) return;
    for (const nsp of [ioInstance.of("/"), ioInstance.of("/notifications")]) {
        for (const socket of await nsp.fetchSockets()) {
            if (String(socket.data.user?.id) === String(userId)) socket.disconnect(true);
        }
    }
};

/** Who is connected to each project's room right now (user ids). */
export const onlineUsersByProject = async (projectIds: string[]) => {
    const online = new Map<string, Set<string>>();
    if (!ioInstance) return online;
    await Promise.all(projectIds.map(async (id) => {
        const sockets = await ioInstance!.in(id).fetchSockets();
        online.set(id, new Set(sockets.map((s) => String(s.data.user?.id))));
    }));
    return online;
};
