import mongoose, { type Types } from "mongoose";
import type { StoredFile } from "../utils/fileStore.js";

export const PROJECT_STACKS = ["react", "nodejs", "nextjs", "htmlcssjs", "c", "cpp"] as const;
export type ProjectStack = (typeof PROJECT_STACKS)[number];

export interface IProject {
    name: string;
    stack: ProjectStack;
    owner: Types.ObjectId;
    users: Types.ObjectId[];
    lastRenamedAt: Date | null;
    /** Long-term notes the AI keeps about this project (purpose, preferences, decisions). */
    aiMemory: string;
    /**
     * Stored as `[{ path, contents }]` (see utils/fileStore). Older projects
     * may still hold a `{ path: contents }` object; read via `fromStoredFiles`.
     */
    files: StoredFile[] | Record<string, string>;
    settings: {
        entry: string;
        port: number;
    };
    /** Set on a student's class projects (their class project and assignment work). */
    classroom: Types.ObjectId | null;
    /** Set on a student's work for one assignment of the class. */
    assignment: Types.ObjectId | null;
    /** People invited but who haven't accepted yet (not members). */
    invites: { user: Types.ObjectId; invitedBy: Types.ObjectId; createdAt: Date }[];
    /** The GitHub repository this project syncs with. */
    github: {
        repo: string;
        branch: string;
        /** The last commit pushed or pulled. */
        lastCommit: string;
        /** Hash of the files at that moment, to spot local changes before a pull. */
        syncedHash: string;
        syncedAt: Date;
    } | null;
    /** Usage tracking (admin dashboard). */
    lastOpenedAt: Date | null;
    lastOpenedBy: Types.ObjectId | null;
    openCount: number;
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

        aiMemory: {
            type: String,
            default: "",
            maxlength: 2000,
        },


        github: {
            type: {
                repo: String,
                branch: String,
                lastCommit: String,
                syncedHash: String,
                syncedAt: Date,
            },
            default: null,
            _id: false,
        },

        files: {
            type: mongoose.Schema.Types.Mixed,
            default: () => []
        },

        settings: {
            entry: { type: String, default: "npm start" },
            port: { type: Number, default: 5173 },
        },

        classroom: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Classroom",
            default: null,
        },

        assignment: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Assignment",
            default: null,
        },

        lastOpenedAt: { type: Date, default: null },
        lastOpenedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        openCount: { type: Number, default: 0 },

        invites: [
            {
                _id: false,
                user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
                invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
                createdAt: { type: Date, default: Date.now },
            },
        ],
    },
    { timestamps: true }
);


projectSchema.index({ users: 1 });
projectSchema.index({ "invites.user": 1 });
projectSchema.index({ assignment: 1, owner: 1 });

const Project = mongoose.model<IProject>("Project", projectSchema);
export default Project;
