import mongoose, { type Types } from "mongoose";

export interface IIssue {
    type: "bug" | "feature" | "feedback";
    title: string;
    description: string;
    severity: "low" | "medium" | "high" | "critical";
    reportedBy: Types.ObjectId;
    /** The project it was reported from, if any. */
    project: Types.ObjectId | null;
    /** The admin's answer, shown to the reporter. */
    adminReply: string;
    resolvedAt: Date | null;
    context?: {
        filePath?: string;
        line?: number;
        stack?: string;
        runtimeLogs?: string;
        userAgent?: string;
    };
    status: "open" | "acknowledged" | "resolved" | "closed";
    createdAt: Date;
    updatedAt: Date;
}

const issueSchema = new mongoose.Schema<IIssue>(
    {
        type: {
            type: String,
            enum: ["bug", "feature", "feedback"],
            required: true,
        },

        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 120,
        },

        description: {
            type: String,
            required: true,
            maxlength: 2000,
        },

        severity: {
            type: String,
            enum: ["low", "medium", "high", "critical"],
            default: "medium",
        },

        project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", default: null },
        adminReply: { type: String, default: "", maxlength: 2000 },
        resolvedAt: { type: Date, default: null },

        reportedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        context: {
            filePath: String,
            line: Number,
            stack: String,
            runtimeLogs: String,
            userAgent: String,
        },

        status: {
            type: String,
            enum: ["open", "acknowledged", "resolved", "closed"],
            default: "open",
        },
    },
    {
        timestamps: true, // adds createdAt & updatedAt
    }
);

issueSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model<IIssue>("Issue", issueSchema);
