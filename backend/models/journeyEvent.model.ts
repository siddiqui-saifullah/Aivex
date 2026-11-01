import mongoose, { type Types } from "mongoose";
import type { StoredFile } from "../utils/fileStore.js";

/**
 * One step of a student's work on an assignment, for the teacher's (and the
 * student's own) "Coding Journey": saves with line counts and an occasional
 * snapshot of the files, runs with their outcome, and questions to Vex.
 * Only recorded on assignment projects.
 */
export const JOURNEY_TYPES = ["save", "ai-edit", "run", "ai"] as const;
export type JourneyType = (typeof JOURNEY_TYPES)[number];

export interface IJourneyEvent {
    project: Types.ObjectId;
    assignment: Types.ObjectId;
    student: Types.ObjectId;
    /** Who did it: the student, or the teacher helping in their project. */
    actor: Types.ObjectId | null;
    type: JourneyType;
    /** save / ai-edit: lines added and removed, and the files touched. */
    added: number;
    removed: number;
    files: string[];
    /** run: whether it compiled and finished cleanly, and the first error line. */
    ok: boolean | null;
    message: string;
    /** save / ai-edit: the whole project at that moment (not on every save). */
    snapshot: StoredFile[] | null;
    createdAt: Date;
}

const journeyEventSchema = new mongoose.Schema<IJourneyEvent>(
    {
        project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
        assignment: { type: mongoose.Schema.Types.ObjectId, ref: "Assignment", required: true },
        student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        type: { type: String, enum: JOURNEY_TYPES, required: true },
        added: { type: Number, default: 0 },
        removed: { type: Number, default: 0 },
        files: { type: [String], default: [] },
        ok: { type: Boolean, default: null },
        message: { type: String, default: "", maxlength: 300 },
        snapshot: { type: mongoose.Schema.Types.Mixed, default: null },
    },
    { timestamps: { createdAt: true, updatedAt: false } },
);

journeyEventSchema.index({ assignment: 1, student: 1, createdAt: 1 });
journeyEventSchema.index({ project: 1, createdAt: -1 });

const JourneyEvent = mongoose.model<IJourneyEvent>("JourneyEvent", journeyEventSchema);
export default JourneyEvent;
