import mongoose, { type Types } from "mongoose";

export const REPORT_TARGETS = ["user", "project", "message"] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];

export const REPORT_REASONS = ["spam", "harassment", "hate", "sexual", "violence", "impersonation", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_ACTIONS = ["dismissed", "content-removed", "user-suspended", "no-action"] as const;
export type ReportAction = (typeof REPORT_ACTIONS)[number];

/**
 * A user reporting another user, a project or a chat message for abuse.
 * Bugs and feedback are `Issue`s instead.
 */
export interface IAbuseReport {
    reporter: Types.ObjectId;
    targetType: ReportTarget;
    /** The reported user, project or message. */
    target: Types.ObjectId;
    /** Who is responsible for the target (the user, the project owner, the sender). */
    targetUser: Types.ObjectId | null;
    reason: ReportReason;
    details: string;
    /** What the reporter saw, kept even if the content is later deleted. */
    snapshot: { text?: string; name?: string; username?: string; projectId?: Types.ObjectId | null };
    status: "open" | "closed";
    action: ReportAction | null;
    adminNote: string;
    resolvedBy: Types.ObjectId | null;
    resolvedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

const abuseReportSchema = new mongoose.Schema<IAbuseReport>(
    {
        reporter: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        targetType: { type: String, enum: REPORT_TARGETS, required: true },
        target: { type: mongoose.Schema.Types.ObjectId, required: true },
        targetUser: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        reason: { type: String, enum: REPORT_REASONS, required: true },
        details: { type: String, default: "", maxlength: 1000 },
        snapshot: {
            text: { type: String, maxlength: 4000 },
            name: String,
            username: String,
            projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", default: null },
        },
        status: { type: String, enum: ["open", "closed"], default: "open" },
        action: { type: String, enum: [...REPORT_ACTIONS, null], default: null },
        adminNote: { type: String, default: "", maxlength: 1000 },
        resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        resolvedAt: { type: Date, default: null },
    },
    { timestamps: true },
);

abuseReportSchema.index({ status: 1, createdAt: -1 });
abuseReportSchema.index({ reporter: 1, targetType: 1, target: 1, status: 1 });
abuseReportSchema.index({ targetUser: 1 });

export default mongoose.model<IAbuseReport>("AbuseReport", abuseReportSchema);
