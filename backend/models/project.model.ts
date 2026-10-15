import mongoose, { type Types } from "mongoose";

export interface IProject {
    name: string;
    owner: Types.ObjectId;
    users: Types.ObjectId[];
    lastRenamedAt: Date | null;
    /** Flat file tree: `{ "src/index.js": "<contents>" }` */
    files: Record<string, string>;
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

        // stack: {
        //     type: String,
        //     enum: ["react", "nodejs", "nextjs", "html"],
        //     default: "nodejs",
        //     required: true,
        //     lowercase: true,   //removed stack for now 
        // },

        lastRenamedAt: {
            type: Date,
            default: null,
        },


        files: {
            type: Object,
            default: {}
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
