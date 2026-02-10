import mongoose from "mongoose";
import Project from "../models/project.model.js";
import * as chatService from "../services/chats.service.js";
import { normalizeChatMessage } from "../utils/normalizeChatMessage.js";


export const getProjectChatsController = async (req, res) => {
    try {
        const userId = req.user._id;
        if (!userId) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const { projectId } = req.params;
        if (!projectId) {
            return res.status(400).json({ message: "ProjectId required" });
        }

        if (!mongoose.Types.ObjectId.isValid(projectId)) {
            return res.status(400).json({ message: "Invalid projectId" });
        }

        const project = await Project
            .findById(projectId)
            .select("users")
            .lean();

        if (!project) {
            return res.status(404).json({ message: "Project Not Found " });
        }

        const isMember = project.users.some(
            id => id.toString() === userId.toString()
        );

        if (!isMember) {
            return res.status(403).json({ message: "Access denied" });
        }

        const projectChats = await chatService.getProjectChats({ projectId });

        const normalizedChats = projectChats.map(normalizeChatMessage);

        return res.status(200).json({ projectChats: normalizedChats });

    } catch (error) {
        console.error("getProjectCahts :- ", error);
        return res.status(500).json({
            message: "Failed to fetch project chats"
        });
    }

}


export const createProjectChatController = async (req, res) => {
    try {
        const message = await chatService.createProjectChat({
            projectId: req.params.projectId,
            senderId: req.user._id,
            role: "user",
            text: req.body.text,
            filePatch: req.body.filePatch,
        });

        res.status(201).json(message);
    } catch (err) {
        res.status(500).json({ message: "Failed to create message" });
    }
};

