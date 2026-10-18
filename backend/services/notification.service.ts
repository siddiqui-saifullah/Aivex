import mongoose, { type Types } from "mongoose";
import Notification, { type NotificationStatus, type NotificationType } from "../models/notification.model.js";
import userModel from "../models/user.model.js";
import { emitToUser } from "../socket/notifications.js";

type Id = Types.ObjectId | string;

const PAGE_SIZE = 30;

export interface NotifyInput {
    /** Recipients; the actor is never notified about their own action. */
    users: Id[];
    type: NotificationType;
    /** "{actor}" is replaced with the actor's username. */
    title: string;
    body?: string;
    link?: string;
    actorId?: Id | null;
    /** Invite notifications: the project, answered with accept/decline. */
    projectId?: Id | null;
    status?: NotificationStatus | null;
}

const toClient = (n: {
    _id: Types.ObjectId;
    type: string;
    title: string;
    body: string;
    link: string;
    actor: { id: Types.ObjectId | null; username: string } | null;
    project?: Types.ObjectId | null;
    status?: string | null;
    read: boolean;
    createdAt: Date;
}) => ({
    _id: String(n._id),
    type: n.type,
    title: n.title,
    body: n.body,
    link: n.link,
    actor: n.actor ? { id: n.actor.id ? String(n.actor.id) : null, username: n.actor.username } : null,
    projectId: n.project ? String(n.project) : null,
    status: n.status ?? null,
    read: n.read,
    createdAt: n.createdAt,
});

export type ClientNotification = ReturnType<typeof toClient>;

/** Store notifications and push them to recipients who are online. Never throws. */
export const notify = async ({
    users,
    type,
    title,
    body = "",
    link = "",
    actorId = null,
    projectId = null,
    status = null,
}: NotifyInput) => {
    try {
        const recipients = [...new Set(users.map(String))].filter(
            (id) => id !== String(actorId ?? "") && mongoose.Types.ObjectId.isValid(id),
        );
        if (recipients.length === 0) return;

        const actorUser = actorId
            ? await userModel.findById(actorId).select("username").lean()
            : null;
        const actor = actorUser ? { id: actorUser._id, username: actorUser.username } : null;
        const text = (s: string) => s.replaceAll("{actor}", actor ? `@${actor.username}` : "Someone");

        const docs = await Notification.insertMany(
            recipients.map((user) => ({
                user,
                type,
                title: text(title).slice(0, 200),
                body: text(body).slice(0, 500),
                link,
                actor,
                project: projectId,
                status,
            })),
        );
        for (const doc of docs) emitToUser(String(doc.user), "notification:new", toClient(doc.toObject()));
    } catch (err) {
        // A failed notification must never break the action that caused it
        console.error("notify failed:", err);
    }
};

/** An invite was answered (or withdrawn): update the invitee's notifications. */
export const resolveInviteNotifications = async ({ userId, projectId, status }: {
    userId: Id;
    projectId: Id;
    status: NotificationStatus;
}) => {
    try {
        await Notification.updateMany(
            { user: userId, type: "project-invite", project: projectId, status: "pending" },
            { $set: { status, read: true } },
        );
        const unread = await Notification.countDocuments({ user: userId, read: false });
        emitToUser(String(userId), "notification:resolved", { projectId: String(projectId), status, unread });
    } catch (err) {
        console.error("resolve invite notifications failed:", err);
    }
};

export const listNotifications = async ({ userId, before }: { userId: Id; before?: string }) => {
    const filter: Record<string, unknown> = { user: userId };
    if (before && !Number.isNaN(Date.parse(before))) filter.createdAt = { $lt: new Date(before) };

    const [items, unread] = await Promise.all([
        Notification.find(filter).sort({ createdAt: -1 }).limit(PAGE_SIZE + 1).lean(),
        Notification.countDocuments({ user: userId, read: false }),
    ]);
    return {
        items: items.slice(0, PAGE_SIZE).map(toClient),
        hasMore: items.length > PAGE_SIZE,
        unread,
    };
};

/** Mark some (ids) or all of a user's notifications as read. */
export const markRead = async ({ userId, ids }: { userId: Id; ids?: unknown }) => {
    const filter: Record<string, unknown> = { user: userId, read: false };
    if (Array.isArray(ids)) {
        const valid = ids.filter((id): id is string => typeof id === "string" && mongoose.Types.ObjectId.isValid(id));
        if (valid.length === 0) return { unread: await Notification.countDocuments({ user: userId, read: false }) };
        filter._id = { $in: valid };
    }
    await Notification.updateMany(filter, { $set: { read: true } });
    const unread = await Notification.countDocuments({ user: userId, read: false });
    emitToUser(String(userId), "notification:unread", { unread });
    return { unread };
};

export const clearNotifications = async ({ userId }: { userId: Id }) => {
    await Notification.deleteMany({ user: userId });
    emitToUser(String(userId), "notification:unread", { unread: 0 });
};
