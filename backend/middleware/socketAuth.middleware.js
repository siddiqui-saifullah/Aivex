import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import Project from "../models/project.model.js";
import userModal from "../models/user.model.js";

export const socketAuth = async (socket, next) => {
    try {
        const token = socket.handshake.auth?.token || socket.handshake.headers.authorization.split(' ')[1];


        if (!token) {
            return next(new Error("Authentication error"));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (!decoded) {
            return next(new Error("Authentication error"))
        }

        const user = await userModal.findById(decoded.userId).select("_id username").lean();

        socket.user = {
            id: decoded.userId,
            username: user.username
        };

        const projectId = socket.handshake.query.projectId;
        const project = mongoose.Types.ObjectId.isValid(projectId) && await Project.findById(projectId).lean();

        if (!project) {
            return next(new Error("Invalid or non-existent projectId"));
        }

        socket.project = project;

        next();

    } catch (error) {
        next(new Error("Authentication failed"));
    }
}