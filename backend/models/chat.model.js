import mongoose from "mongoose";

const chatMessageSchema = new mongoose.Schema(
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

        filePatch: {
            type: Map,
            of: String,
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

export default mongoose.model("ChatMessage", chatMessageSchema);
