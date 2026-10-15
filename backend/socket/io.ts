import type { AppServer } from "./socketHandler.js";

/**
 * Holds the socket.io server so HTTP controllers can push realtime
 * updates to a project's room.
 */
let ioInstance: AppServer | null = null;

export const setIo = (io: AppServer) => {
    ioInstance = io;
};

export type ProjectUpdateReason = "members" | "owner" | "renamed" | "deleted" | "memory";

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
