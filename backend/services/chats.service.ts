import mongoose, { type Types } from "mongoose";
import ChatMessage, { type IChatMessage } from "../models/chat.model.js";
import AppError from "../errors/AppError.js";
import { toStoredFiles } from "../utils/fileStore.js";

type Id = Types.ObjectId | string;

/* -------------------------------------------------------------------------- */
/* GET ALL CHATS OF PROJECT                                                   */
/* -------------------------------------------------------------------------- */
export const getProjectChats = async ({ projectId }: { projectId: Id }) => {
    if (!projectId) {
        throw new AppError("ProjectId is required", 400);
    }

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
        throw new AppError("Invalid projectId", 400);
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
}: {
    projectId: Id;
    senderId?: Id | null;
    role: IChatMessage["role"];
    text?: string;
    filePatch?: Record<string, string> | null;
}) => {
    if (!projectId || !role) {
        throw new AppError("Required fields missing", 400);
    }

    const message = await ChatMessage.create({
        project: projectId,
        sender: senderId || null,
        role,
        text,
        filePatch: filePatch ? toStoredFiles(filePatch) : null,
    });

    return message;
};

/* -------------------------------------------------------------------------- */
/* DELETE ONE MESSAGE BY ID                                                   */
/* -------------------------------------------------------------------------- */
export const deleteMessageById = async ({ messageId, userId, projectId }: {
    messageId: Id;
    userId: Id;
    /** When given, the message must belong to this project. */
    projectId?: Id;
}) => {
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
        throw new AppError("Invalid message id", 400);
    }

    const message = await ChatMessage.findById(messageId);

    if (!message || (projectId && !message.project?.equals(projectId))) {
        throw new AppError("Message not found", 404);
    }

    if (!message.sender || !message.sender.equals(userId)) {
        throw new AppError("Not allowed to delete this message", 403);
    }

    await message.deleteOne();
};

/* -------------------------------------------------------------------------- */
/* DELETE PROJECT CHATS                                                       */
/* -------------------------------------------------------------------------- */
export const deleteChatsByProjectId = async ({ projectId }: { projectId: Id }) => {
    if (!projectId) {
        throw new AppError("projectId is required to delete chats", 400);
    }

    const result = await ChatMessage.deleteMany({ project: projectId });

    return {
        deletedCount: result.deletedCount,
    };
};
