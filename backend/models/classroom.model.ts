import mongoose, { type Types } from "mongoose";
import { PROJECT_STACKS, type ProjectStack } from "./project.model.js";
import type { StoredFile } from "../utils/fileStore.js";

/**
 * A class run by a teacher. Students join with a short code and each gets
 * their own copy of the starter files as a project the teacher is also a
 * member of, so the teacher can open it and help live.
 */
export interface IClassroom {
    name: string;
    teacher: Types.ObjectId;
    /** Short join code, e.g. "K7Q2MX". */
    code: string;
    stack: ProjectStack;
    /** Whether students may use Vex AI in their class projects. */
    aiEnabled: boolean;
    starterFiles: StoredFile[];
    students: { user: Types.ObjectId; project: Types.ObjectId; joinedAt: Date }[];
    createdAt: Date;
    updatedAt: Date;
}

const classroomSchema = new mongoose.Schema<IClassroom>(
    {
        name: { type: String, required: true, trim: true, maxlength: 60 },
        teacher: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        code: { type: String, required: true, unique: true, uppercase: true },
        stack: { type: String, enum: PROJECT_STACKS, default: "c" },
        aiEnabled: { type: Boolean, default: true },
        starterFiles: { type: mongoose.Schema.Types.Mixed, default: () => [] },
        students: [
            {
                user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
                project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
                joinedAt: { type: Date, default: Date.now },
            },
        ],
    },
    { timestamps: true },
);

classroomSchema.index({ teacher: 1 });
classroomSchema.index({ "students.user": 1 });

const Classroom = mongoose.model<IClassroom>("Classroom", classroomSchema);
export default Classroom;
