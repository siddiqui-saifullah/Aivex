import mongoose from "mongoose";

const issueSchema = new mongoose.Schema(
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

        // projectId: {
        //     type: mongoose.Schema.Types.ObjectId,
        //     ref: "Project",
        //     required: true,
        // },

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

export default mongoose.model("Issue", issueSchema);
