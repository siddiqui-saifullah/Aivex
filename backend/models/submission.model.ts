import mongoose, { type Types } from "mongoose";
import type { StoredFile } from "../utils/fileStore.js";

/**
 * - submitted: waiting for the teacher
 * - reviewed: the teacher gave feedback (and maybe marks)
 * - revision-requested: the teacher asked for changes; the student resubmits
 */
export const SUBMISSION_STATUSES = ["submitted", "reviewed", "revision-requested"] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

/**
 * A student's hand-in for an assignment: a snapshot of their project's files
 * at that moment. The files never change after submitting; each resubmission
 * is a new version. Only the teacher's review fields are updated.
 */
export interface ISubmission {
    assignment: Types.ObjectId;
    classroom: Types.ObjectId;
    student: Types.ObjectId;
    project: Types.ObjectId;
    version: number;
    files: StoredFile[];
    note: string;
    status: SubmissionStatus;
    feedback: string;
    marks: number | null;
    reviewedBy: Types.ObjectId | null;
    reviewedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

const submissionSchema = new mongoose.Schema<ISubmission>(
    {
        assignment: { type: mongoose.Schema.Types.ObjectId, ref: "Assignment", required: true },
        classroom: { type: mongoose.Schema.Types.ObjectId, ref: "Classroom", required: true },
        student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
        version: { type: Number, required: true, min: 1 },
        files: { type: mongoose.Schema.Types.Mixed, default: () => [] },
        note: { type: String, default: "", maxlength: 1000 },
        status: { type: String, enum: SUBMISSION_STATUSES, default: "submitted" },
        feedback: { type: String, default: "", maxlength: 5000 },
        marks: { type: Number, default: null },
        reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        reviewedAt: { type: Date, default: null },
    },
    { timestamps: true },
);

// One row per version; a double submit can't create the same version twice
submissionSchema.index({ assignment: 1, student: 1, version: 1 }, { unique: true });
submissionSchema.index({ classroom: 1, status: 1 });

const Submission = mongoose.model<ISubmission>("Submission", submissionSchema);
export default Submission;
