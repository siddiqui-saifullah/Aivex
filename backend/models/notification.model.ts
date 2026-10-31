import mongoose, { type Types } from "mongoose";

export const NOTIFICATION_TYPES = [
    "project-invite",
    "invite-accepted",
    "invite-declined",
    "project-removed",
    "project-owner",
    "mention",
    "class-join",
    "class-ai",
    "class-leave",
    "class-removed",
    "report-update",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** For notifications that ask for an answer (project invites). */
export const NOTIFICATION_STATUSES = ["pending", "accepted", "declined", "cancelled", "expired"] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export interface INotification {
    user: Types.ObjectId;
    type: NotificationType;
    title: string;
    body: string;
    /** In-app path to open, e.g. "/projects/<id>". */
    link: string;
    actor: { id: Types.ObjectId | null; username: string } | null;
    /** The project an invite is for. */
    project: Types.ObjectId | null;
    status: NotificationStatus | null;
    read: boolean;
    createdAt: Date;
}

const notificationSchema = new mongoose.Schema<INotification>(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        type: { type: String, enum: NOTIFICATION_TYPES, required: true },
        title: { type: String, required: true, maxlength: 200 },
        body: { type: String, default: "", maxlength: 500 },
        link: { type: String, default: "" },
        actor: {
            type: { id: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, username: String },
            default: null,
            _id: false,
        },
        project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", default: null },
        status: { type: String, enum: [...NOTIFICATION_STATUSES, null], default: null },
        read: { type: Boolean, default: false },
    },
    { timestamps: { createdAt: true, updatedAt: false } },
);

notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, read: 1 });
// Old notifications clean themselves up
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 60 });

const Notification = mongoose.model<INotification>("Notification", notificationSchema);
export default Notification;
