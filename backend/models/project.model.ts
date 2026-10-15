import mongoose, { type Types } from "mongoose";
import type { StoredFile } from "../utils/fileStore.js";

export const PROJECT_STACKS = ["react", "nodejs", "nextjs"] as const;
export type ProjectStack = (typeof PROJECT_STACKS)[number];

export interface IProject {
    name: string;
    stack: ProjectStack;
    owner: Types.ObjectId;
    users: Types.ObjectId[];
    lastRenamedAt: Date | null;
    /**
     * Stored as `[{ path, contents }]` (see utils/fileStore). Older projects
     * may still hold a `{ path: contents }` object; read via `fromStoredFiles`.
     */
    files: StoredFile[] | Record<string, string>;
    settings: {
        entry: string;
        port: number;
    };
    createdAt: Date;
    updatedAt: Date;
}

const projectSchema = new mongoose.Schema<IProject>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            unique: true,
        },

        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        users: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            },
        ],

        stack: {
            type: String,
            enum: PROJECT_STACKS,
            default: "nodejs",
            lowercase: true,
        },

        lastRenamedAt: {
            type: Date,
            default: null,
        },


        files: {
            type: mongoose.Schema.Types.Mixed,
            default: () => []
        },

        settings: {
            entry: { type: String, default: "npm start" },
            port: { type: Number, default: 5173 },
        },
    },
    { timestamps: true }
);


projectSchema.index({ users: 1 });

const Project = mongoose.model<IProject>("Project", projectSchema);
export default Project;
