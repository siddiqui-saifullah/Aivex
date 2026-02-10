import mongoose from "mongoose";
import ChatMessage from "../models/chat.model.js";
import AppError from "../errors/AppError.js";


/* -------------------------------------------------------------------------- */
/* GET ALL CHATS OF PROJECT                                                   */
/* -------------------------------------------------------------------------- */
export const getProjectChats = async ({ projectId }) => {
    if (!projectId) {
        throw new Error("ProjectId is required");
    }

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
        throw new Error("Invalid projectId");
    }

    return ChatMessage
        .find({ project: projectId })
        .sort({ createdAt: 1 })
        .lean();
};


/* -------------------------------------------------------------------------- */
/* CREATE PROJECT CHAT                                                        */
/* -------------------------------------------------------------------------- */
export const createProjectChat = async ({
    projectId,
    senderId,
    role,
    text,
    filePatch,
}) => {
    if (!projectId || !role) {
        throw new Error("Required fields missing");
    }

    const message = await ChatMessage.create({
        project: projectId,
        sender: senderId || null,
        role,
        text,
        filePatch,
    });

    return message;
};

/* -------------------------------------------------------------------------- */
/* DELETE ONE MESSAGE BY ID                                                   */
/* -------------------------------------------------------------------------- */
export const deleteMessageById = async ({ messageId, userId }) => {
    const message = await Chat.findById(messageId);

    if (!message) {
        throw new AppError("Message not found", 404);
    }

    if (!message.sender.equals(userId)) {
        throw new AppError("Not allowed to delete this message", 403);
    }

    await message.deleteOne();
};

/* -------------------------------------------------------------------------- */
/* DELETE PROJECT CHATS                                                       */
/* -------------------------------------------------------------------------- */
export const deleteChatsByProjectId = async ({ projectId }) => {
    if (!projectId) {
        throw new AppError("projectId is required to delete chats", 400);
    }

    const result = await ChatMessage.deleteMany({ project: projectId });

    return {
        deletedCount: result.deletedCount,
    };
};

