import jwt, { type JwtPayload } from "jsonwebtoken";
import mongoose from "mongoose";
import Project from "../models/project.model.js";
import userModal from "../models/user.model.js";
import redisClient from "../services/redis.service.js";
import type { AppSocket } from "../socket/socketHandler.js";

export const socketAuth = async (socket: AppSocket, next: (err?: Error) => void) => {
    try {
        const token: string | undefined =
            socket.handshake.auth?.token || socket.handshake.headers.authorization?.split(' ')[1];


        if (!token) {
            return next(new Error("Authentication error"));
        }

        // Tokens revoked on logout must not open new socket connections either
        if (await redisClient.get(token)) {
            return next(new Error("Authentication error"));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;

        if (!decoded?.userId) {
            return next(new Error("Authentication error"))
        }

        const user = await userModal.findById(decoded.userId).select("_id username").lean();

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
        const isMember = project.users.some(id => id.toString() === String(decoded.userId));
        if (!isMember) {
            return next(new Error("Access denied"));
        }

        socket.data.user = {
            id: String(decoded.userId),
            username: user.username,
        };
        socket.data.project = { _id: project._id };

        next();

    } catch (error) {
        next(new Error("Authentication failed"));
    }
}
