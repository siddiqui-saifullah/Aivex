import type { Types } from "mongoose";
import userModel from "../models/user.model.js";
import Project from "../models/project.model.js";
import ActivityDay from "../models/activityDay.model.js";

type Id = Types.ObjectId | string;

/** Writes at most this often per user (or user + project). */
const THROTTLE_MS = 60_000;
const lastTouch = new Map<string, number>();
const lastDay = new Map<string, string>();

export const utcDay = (date = new Date()) => date.toISOString().slice(0, 10);

const due = (key: string) => {
    const now = Date.now();
    if (now - (lastTouch.get(key) ?? 0) < THROTTLE_MS) return false;
    lastTouch.set(key, now);
    if (lastTouch.size > 50_000) lastTouch.clear(); // keep memory bounded
    return true;
};

const isDuplicateKey = (err: unknown) => (err as { code?: number }).code === 11000;

/** Today's daily-active-users row, written once per user per day. */
const markDay = (id: string, now: Date) => {
    const day = utcDay(now);
    if (lastDay.get(id) === day) return;
    lastDay.set(id, day);
    if (lastDay.size > 50_000) lastDay.clear();
    ActivityDay.create({ day, user: id }).catch((err) => {
        if (!isDuplicateKey(err)) console.error("activity day failed:", err);
    });
};

/** The user did something: update "last active" and today's active-users row. Never throws. */
export const touchUser = (userId: Id) => {
    const id = String(userId);
    if (!due(`u:${id}`)) return;
    const now = new Date();
    void userModel.updateOne({ _id: id }, { $set: { lastActiveAt: now } }, { timestamps: false }).catch(() => undefined);
    markDay(id, now);
};

export const recordLogin = (userId: Id) => {
    const id = String(userId);
    const now = new Date();
    lastTouch.set(`u:${id}`, now.getTime()); // this write covers "last active" too
    void userModel
        .updateOne(
            { _id: id },
            { $set: { lastLoginAt: now, lastActiveAt: now }, $inc: { loginCount: 1 } },
            { timestamps: false },
        )
        .catch(() => undefined);
    markDay(id, now);
};

/** Someone opened a project: per-project "last opened" and the user's last project. */
export const recordProjectOpen = (projectId: Id, userId: Id, name: string) => {
    if (!due(`p:${String(userId)}:${String(projectId)}`)) return;
    const now = new Date();
    void Project.updateOne(
        { _id: projectId },
        { $set: { lastOpenedAt: now, lastOpenedBy: userId }, $inc: { openCount: 1 } },
        { timestamps: false }, // opening isn't editing: keep updatedAt as "last edited"
    ).catch(() => undefined);
    void userModel
        .updateOne(
            { _id: userId },
            { $set: { lastProject: { project: projectId, name, at: now } } },
            { timestamps: false },
        )
        .catch(() => undefined);
};
