import mongoose from "mongoose";
import userModel from "../models/user.model.js";
import Project from "../models/project.model.js";
import Classroom from "../models/classroom.model.js";
import ChatMessage from "../models/chat.model.js";
import ActivityDay from "../models/activityDay.model.js";
import { utcDay } from "./activity.service.js";

const DAY_MS = 86_400_000;
const PAGE_SIZE = 50;

const daysAgo = (n: number) => new Date(Date.now() - n * DAY_MS);

/** The last `n` UTC days, oldest first. */
const lastDays = (n: number) =>
    Array.from({ length: n }, (_, i) => utcDay(new Date(Date.now() - (n - 1 - i) * DAY_MS)));

const bucket = (days: string[], dates: Date[]) => {
    const counts = new Map(days.map((d) => [d, 0]));
    for (const date of dates) {
        const day = utcDay(new Date(date));
        if (counts.has(day)) counts.set(day, counts.get(day)! + 1);
    }
    return days.map((day) => ({ day, count: counts.get(day)! }));
};

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* -------------------------------------------------------------------------- */
/* OVERVIEW                                                                   */
/* -------------------------------------------------------------------------- */
export const getOverview = async () => {
    const days = lastDays(30);
    const since = new Date(`${days[0]}T00:00:00.000Z`);

    const [
        users,
        projects,
        classrooms,
        messages,
        aiReplies,
        activeToday,
        active7d,
        active30d,
        newUsers,
        newProjects,
        aiRecent,
        activity,
        stacks,
        lastActiveUser,
    ] = await Promise.all([
        userModel.countDocuments(),
        Project.countDocuments(),
        Classroom.countDocuments(),
        ChatMessage.countDocuments({ project: { $ne: null } }),
        ChatMessage.countDocuments({ role: "ai" }),
        ActivityDay.countDocuments({ day: utcDay() }),
        userModel.countDocuments({ lastActiveAt: { $gte: daysAgo(7) } }),
        userModel.countDocuments({ lastActiveAt: { $gte: daysAgo(30) } }),
        userModel.find({ createdAt: { $gte: since } }).select("createdAt").lean(),
        Project.find({ createdAt: { $gte: since } }).select("createdAt").lean(),
        ChatMessage.find({ role: "ai", createdAt: { $gte: since } }).select("createdAt").lean(),
        ActivityDay.find({ day: { $gte: days[0] } }).select("day").lean(),
        Project.find().select("stack").lean(),
        userModel.findOne({ lastActiveAt: { $ne: null } }).sort({ lastActiveAt: -1 }).select("username lastActiveAt").lean(),
    ]);

    const activeCounts = new Map(days.map((d) => [d, 0]));
    for (const a of activity) activeCounts.set(a.day, (activeCounts.get(a.day) ?? 0) + 1);

    const stackCounts = new Map<string, number>();
    for (const p of stacks) stackCounts.set(p.stack, (stackCounts.get(p.stack) ?? 0) + 1);

    return {
        totals: { users, projects, classrooms, messages, aiReplies },
        active: { today: activeToday, last7d: active7d, last30d: active30d },
        lastActivity: lastActiveUser
            ? { username: lastActiveUser.username, at: lastActiveUser.lastActiveAt }
            : null,
        series: {
            activeUsers: days.map((day) => ({ day, count: activeCounts.get(day) ?? 0 })),
            signups: bucket(days, newUsers.map((u) => u.createdAt)),
            projectsCreated: bucket(days, newProjects.map((p) => p.createdAt)),
            aiReplies: bucket(days, aiRecent.map((m) => m.createdAt)),
        },
        stacks: [...stackCounts.entries()]
            .map(([stack, count]) => ({ stack, count }))
            .sort((a, b) => b.count - a.count),
        generatedAt: new Date(),
    };
};

/* -------------------------------------------------------------------------- */
/* USERS                                                                      */
/* -------------------------------------------------------------------------- */
const USER_SORTS: Record<string, Record<string, 1 | -1>> = {
    active: { lastActiveAt: -1, createdAt: -1 },
    joined: { createdAt: -1 },
    login: { lastLoginAt: -1, createdAt: -1 },
    name: { username: 1 },
};

export const listUsers = async ({ q, sort, page }: { q?: string; sort?: string; page?: number }) => {
    const filter: Record<string, unknown> = {};
    if (q?.trim()) {
        const re = new RegExp(escapeRegex(q.trim()), "i");
        filter.$or = [{ name: re }, { username: re }, { email: re }];
    }
    const pageNo = Math.max(1, Number(page) || 1);

    const [total, users] = await Promise.all([
        userModel.countDocuments(filter),
        userModel
            .find(filter)
            .sort(USER_SORTS[sort ?? ""] ?? USER_SORTS.active)
            .skip((pageNo - 1) * PAGE_SIZE)
            .limit(PAGE_SIZE)
            .select("name username email createdAt lastActiveAt lastLoginAt loginCount lastProject")
            .lean(),
    ]);

    const ids = users.map((u) => u._id);
    const memberships = await Project.find({ users: { $in: ids } }).select("owner users").lean();
    const counts = new Map<string, { owned: number; member: number }>();
    for (const p of memberships) {
        for (const u of p.users) {
            const key = String(u);
            const c = counts.get(key) ?? { owned: 0, member: 0 };
            if (String(p.owner) === key) c.owned++;
            else c.member++;
            counts.set(key, c);
        }
    }

    return {
        total,
        page: pageNo,
        pageSize: PAGE_SIZE,
        users: users.map((u) => ({
            _id: u._id,
            name: u.name,
            username: u.username,
            email: u.email,
            createdAt: u.createdAt,
            lastActiveAt: u.lastActiveAt ?? null,
            lastLoginAt: u.lastLoginAt ?? null,
            loginCount: u.loginCount ?? 0,
            lastProject: u.lastProject ?? null,
            projectsOwned: counts.get(String(u._id))?.owned ?? 0,
            projectsShared: counts.get(String(u._id))?.member ?? 0,
        })),
    };
};

/* -------------------------------------------------------------------------- */
/* PROJECTS                                                                   */
/* -------------------------------------------------------------------------- */
const PROJECT_SORTS: Record<string, Record<string, 1 | -1>> = {
    opened: { lastOpenedAt: -1, updatedAt: -1 },
    edited: { updatedAt: -1 },
    created: { createdAt: -1 },
    name: { name: 1 },
};

export const listProjects = async ({ q, sort, page }: { q?: string; sort?: string; page?: number }) => {
    const filter: Record<string, unknown> = {};
    if (q?.trim()) filter.name = new RegExp(escapeRegex(q.trim()), "i");
    const pageNo = Math.max(1, Number(page) || 1);

    const [total, projects] = await Promise.all([
        Project.countDocuments(filter),
        Project.find(filter)
            .sort(PROJECT_SORTS[sort ?? ""] ?? PROJECT_SORTS.opened)
            .skip((pageNo - 1) * PAGE_SIZE)
            .limit(PAGE_SIZE)
            .select("name stack owner users invites classroom createdAt updatedAt lastOpenedAt lastOpenedBy openCount")
            .populate("owner", "username")
            .populate("lastOpenedBy", "username")
            .lean(),
    ]);

    const ids = projects.map((p) => p._id);
    const messageCounts = await ChatMessage.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
        { $match: { project: { $in: ids } } },
        { $group: { _id: "$project", count: { $sum: 1 } } },
    ]);
    const messagesBy = new Map(messageCounts.map((m) => [String(m._id), m.count]));

    return {
        total,
        page: pageNo,
        pageSize: PAGE_SIZE,
        projects: projects.map((p) => {
            const owner = p.owner as unknown as { username?: string } | null;
            const openedBy = p.lastOpenedBy as unknown as { username?: string } | null;
            return {
                _id: p._id,
                name: p.name,
                stack: p.stack,
                owner: owner?.username ?? null,
                members: p.users.length,
                pendingInvites: p.invites?.length ?? 0,
                isClassProject: Boolean(p.classroom),
                messages: messagesBy.get(String(p._id)) ?? 0,
                createdAt: p.createdAt,
                lastEditedAt: p.updatedAt,
                lastOpenedAt: p.lastOpenedAt ?? null,
                lastOpenedBy: openedBy?.username ?? null,
                openCount: p.openCount ?? 0,
            };
        }),
    };
};
