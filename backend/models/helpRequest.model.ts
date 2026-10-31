import mongoose, { type Types } from "mongoose";

/**
 * A student asking their teacher for help with a class project. One open
 * request per project; the teacher marks it resolved after helping.
 */
export interface IHelpRequest {
    classroom: Types.ObjectId;
    student: Types.ObjectId;
    project: Types.ObjectId;
    assignment: Types.ObjectId | null;
    message: string;
    status: "open" | "resolved";
    resolvedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

const helpRequestSchema = new mongoose.Schema<IHelpRequest>(
    {
        classroom: { type: mongoose.Schema.Types.ObjectId, ref: "Classroom", required: true },
        student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
        assignment: { type: mongoose.Schema.Types.ObjectId, ref: "Assignment", default: null },
        message: { type: String, default: "", maxlength: 500 },
        status: { type: String, enum: ["open", "resolved"], default: "open" },
        resolvedAt: { type: Date, default: null },
    },
    { timestamps: true },
);

helpRequestSchema.index({ classroom: 1, status: 1, createdAt: -1 });
helpRequestSchema.index({ project: 1, status: 1 });

const HelpRequest = mongoose.model<IHelpRequest>("HelpRequest", helpRequestSchema);
export default HelpRequest;
