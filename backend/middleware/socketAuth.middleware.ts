import jwt, { type JwtPayload } from "jsonwebtoken";
import mongoose from "mongoose";
import Project from "../models/project.model.js";
import userModal from "../models/user.model.js";
import redisClient from "../services/redis.service.js";
import { touchUser } from "../services/activity.service.js";
import { isSuspended } from "../services/report.service.js";
import type { Socket } from "socket.io";
import type { AppSocket } from "../socket/socketHandler.js";

type Handshake = Socket["handshake"];

/** The user behind a socket handshake's token, or null. */
export const authenticateSocketUser = async (handshake: Handshake) => {
    try {
        const token: string | undefined =
            handshake.auth?.token || handshake.headers.authorization?.split(' ')[1];
        if (!token) return null;

        // Tokens revoked on logout must not open new socket connections either
        if (await redisClient.get(token)) return null;

        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
        if (!decoded?.userId) return null;
        if (await isSuspended(decoded.userId)) return null;

        const user = await userModal.findById(decoded.userId).select("_id username").lean();
        if (!user) return null;

        touchUser(user._id);
        return { id: String(decoded.userId), username: user.username };
    } catch {
        return null;
    }
};

export const socketAuth = async (socket: AppSocket, next: (err?: Error) => void) => {
    try {
        const user = await authenticateSocketUser(socket.handshake);
        if (!user) {
            return next(new Error("Authentication error"));
        }

        const projectId = socket.handshake.query.projectId;
        const project = typeof projectId === "string" && mongoose.Types.ObjectId.isValid(projectId)
            ? await Project.findById(projectId).select("_id users").lean()
            : null;

        if (!project) {
            return next(new Error("Invalid or non-existent projectId"));
        }

        // Only project members may join the project's chat room
        const isMember = project.users.some(id => id.toString() === user.id);
        if (!isMember) {
            return next(new Error("Access denied"));
        }

        socket.data.user = user;
        socket.data.project = { _id: project._id };

        next();

    } catch (error) {
        next(new Error("Authentication failed"));
    }
}
