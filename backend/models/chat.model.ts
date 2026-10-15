import mongoose, { type Types } from "mongoose";
import type { StoredFile } from "../utils/fileStore.js";

export interface IChatMessage {
    project: Types.ObjectId | null;
    conversation: Types.ObjectId | null;
    sender: Types.ObjectId | null;
    role: "user" | "ai" | "system";
    text: string;
    /** Files generated with this (AI) message, as a flat path -> contents map. */
    filePatch: StoredFile[] | Record<string, string> | null;
    expiresAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}

const chatMessageSchema = new mongoose.Schema<IChatMessage>(
    {
        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project",
            default: null,
            index: true,
        },

        conversation: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Conversation",
            default: null,
            index: true,
        },

        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },

        role: {
            type: String,
            enum: ["user", "ai", "system"],
            required: true,
        },

        text: {
            type: String,
            trim: true,
            default: "",
        },

        // Stored as [{ path, contents }] (see utils/fileStore): file paths
        // contain "." which Mongoose Maps and MongoDB keys don't handle well.
        filePatch: {
            type: mongoose.Schema.Types.Mixed,
            default: null,
        },

        expiresAt: Date,
    },
    { timestamps: true }
);

chatMessageSchema.pre("validate", function (next) {
    const hasProject = !!this.project;
    const hasConversation = !!this.conversation;

    if (hasProject === hasConversation) {
        return next(new Error("Message must belong to exactly one context"));
    }
    next();
});

chatMessageSchema.pre("save", function (next) {
    if (!this.expiresAt) {
        this.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }
    next();
});

export default mongoose.model<IChatMessage>("ChatMessage", chatMessageSchema);
