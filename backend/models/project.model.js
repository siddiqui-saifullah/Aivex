import mongoose from "mongoose";

const projectSchema = new mongoose.Schema(
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

const Project = mongoose.model("Project", projectSchema);
export default Project;

