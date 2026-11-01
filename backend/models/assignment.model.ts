import mongoose, { type Types } from "mongoose";
import { PROJECT_STACKS, type ProjectStack } from "./project.model.js";
import type { StoredFile } from "../utils/fileStore.js";

/**
 * How much students may use Vex AI while working on an assignment:
 * - allowed: as in any project
 * - hints: Vex explains and gives hints, but never writes code into the project
 * - disabled: no AI for students
 * The teacher can always use Vex. Turning AI off for the whole class wins.
 */
export const AI_POLICIES = ["allowed", "hints", "disabled"] as const;
export type AiPolicy = (typeof AI_POLICIES)[number];

/**
 * A test case for auto-grading (C and C++ assignments): the program gets
 * `input` on stdin and must print `expected`. Hidden tests are never shown
 * to students, only whether they passed.
 */
export interface ITestCase {
    _id: Types.ObjectId;
    name: string;
    input: string;
    expected: string;
    points: number;
    hidden: boolean;
}

/**
 * Work the teacher sets for a class. Each student who starts it gets their
 * own project with a copy of the starter files, shared with the teacher.
 */
export interface IAssignment {
    classroom: Types.ObjectId;
    title: string;
    instructions: string;
    stack: ProjectStack;
    starterFiles: StoredFile[];
    dueAt: Date | null;
    aiPolicy: AiPolicy;
    /** Optional: marks the teacher grades out of. */
    maxMarks: number | null;
    /** Auto-grading test cases (C and C++). */
    tests: ITestCase[];
    createdBy: Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}

const assignmentSchema = new mongoose.Schema<IAssignment>(
    {
        classroom: { type: mongoose.Schema.Types.ObjectId, ref: "Classroom", required: true },
        title: { type: String, required: true, trim: true, maxlength: 100 },
        instructions: { type: String, default: "", maxlength: 10_000 },
        stack: { type: String, enum: PROJECT_STACKS, default: "c" },
        starterFiles: { type: mongoose.Schema.Types.Mixed, default: () => [] },
        dueAt: { type: Date, default: null },
        aiPolicy: { type: String, enum: AI_POLICIES, default: "allowed" },
        maxMarks: { type: Number, default: null, min: 1, max: 1000 },
        tests: {
            type: [
                {
                    name: { type: String, trim: true, maxlength: 80, default: "" },
                    input: { type: String, default: "", maxlength: 10_000 },
                    expected: { type: String, default: "", maxlength: 10_000 },
                    points: { type: Number, default: 1, min: 1, max: 100 },
                    hidden: { type: Boolean, default: false },
                },
            ],
            default: [],
        },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    },
    { timestamps: true },
);

assignmentSchema.index({ classroom: 1, createdAt: -1 });

const Assignment = mongoose.model<IAssignment>("Assignment", assignmentSchema);
export default Assignment;
