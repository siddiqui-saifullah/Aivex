import mongoose, { type Types } from "mongoose";
import AppError from "../errors/AppError.js";
import AbuseReport, { REPORT_REASONS, REPORT_TARGETS, type ReportReason, type ReportTarget } from "../models/abuseReport.model.js";
import Issue from "../models/issue.model.js";
import Project from "../models/project.model.js";
import ChatMessage from "../models/chat.model.js";
import userModel from "../models/user.model.js";
import redisClient from "./redis.service.js";
import { notify } from "./notification.service.js";
import { disconnectUser, notifyMessageDeleted } from "../socket/io.js";

type Id = Types.ObjectId | string;

const PAGE_SIZE = 25;
const isId = (id: unknown): id is string => typeof id === "string" && mongoose.Types.ObjectId.isValid(id);
const clip = (text: unknown, max: number) => (typeof text === "string" ? text.trim().slice(0, max) : "");

/* -------------------------------------------------------------------------- */
/* BUG / ISSUE REPORTS                                                        */
/* -------------------------------------------------------------------------- */
const ISSUE_TYPES = ["bug", "feature", "feedback"] as const;
const SEVERITIES = ["low", "medium", "high", "critical"] as const;
const ISSUE_STATUSES = ["open", "acknowledged", "resolved", "closed"] as const;
type IssueStatus = (typeof ISSUE_STATUSES)[number];

const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
    allowed.includes(value as T) ? (value as T) : fallback;

/** A bug, idea or feedback, from inside a project ("general" when not in one). */
export const createIssue = async ({ projectId, userId, report }: {
    projectId: string;
    userId: Id;
    report: Record<string, unknown>;
}) => {
    const title = clip(report.title, 120);
    const description = clip(report.description, 2000);
    if (!title || !description) throw new AppError("Title and description are required", 400);

    let project: Types.ObjectId | null = null;
    if (projectId !== "general") {
        if (!isId(projectId)) throw new AppError("Invalid project id", 400);
        const found = await Project.exists({ _id: projectId, users: userId });
        if (!found) throw new AppError("Project not found or access denied", 404);
        project = found._id;
    }

    const context = (report.context && typeof report.context === "object" ? report.context : {}) as Record<string, unknown>;
    return Issue.create({
        type: pick(report.type, ISSUE_TYPES, "bug"),
        severity: pick(report.severity, SEVERITIES, "medium"),
        title,
        description,
        reportedBy: userId,
        project,
        context: {
            filePath: clip(context.filePath, 300) || undefined,
            line: Number.isFinite(Number(context.line)) ? Number(context.line) : undefined,
            stack: clip(context.stack, 4000) || undefined,
            runtimeLogs: clip(context.runtimeLogs, 4000) || undefined,
            userAgent: clip(context.userAgent, 300) || undefined,
        },
    });
};

/** Admin: issues, newest first, optionally by status and type. */
export const listIssues = async ({ status, type, page = 1 }: { status?: string; type?: string; page?: number }) => {
    const filter: Record<string, unknown> = {};
    if (status && ISSUE_STATUSES.includes(status as IssueStatus)) filter.status = status;
    if (type && ISSUE_TYPES.includes(type as (typeof ISSUE_TYPES)[number])) filter.type = type;
    const [items, total, open] = await Promise.all([
        Issue.find(filter)
            .sort({ createdAt: -1 })
            .skip((Math.max(1, page) - 1) * PAGE_SIZE)
            .limit(PAGE_SIZE)
            .populate("reportedBy", "name username email")
            .populate("project", "name")
            .lean(),
        Issue.countDocuments(filter),
        Issue.countDocuments({ status: { $in: ["open", "acknowledged"] } }),
    ]);
    return { items, total, open, page, pageSize: PAGE_SIZE };
};

/** Admin: change an issue's status and/or answer the reporter. */
export const updateIssue = async ({ issueId, status, reply }: {
    issueId: string;
    status?: unknown;
    reply?: unknown;
}) => {
    if (!isId(issueId)) throw new AppError("Invalid issue id", 400);
    const issue = await Issue.findById(issueId);
    if (!issue) throw new AppError("Issue not found", 404);

    if (status !== undefined) {
        if (!ISSUE_STATUSES.includes(status as IssueStatus)) throw new AppError("Invalid status", 400);
        issue.status = status as IssueStatus;
        issue.resolvedAt = status === "resolved" || status === "closed" ? new Date() : null;
    }
    const answer = clip(reply, 2000);
    if (answer) issue.adminReply = answer;
    await issue.save();

    if (answer || status !== undefined) {
        void notify({
            users: [issue.reportedBy],
            type: "report-update",
            title: `Your report “${issue.title}” is ${issue.status}`,
            body: answer || "Thanks for helping us improve Aivex.",
            link: "",
        });
    }
    return issue.toObject();
};

/* -------------------------------------------------------------------------- */
/* ABUSE REPORTS                                                              */
/* -------------------------------------------------------------------------- */
/** What is being reported, checked against what the reporter can actually see. */
const resolveTarget = async (targetType: ReportTarget, targetId: string, reporterId: Id) => {
    if (targetType === "user") {
        const user = await userModel.findById(targetId).select("name username").lean();
        if (!user) throw new AppError("User not found", 404);
        return { targetUser: user._id, snapshot: { name: user.name, username: user.username } };
    }
    if (targetType === "project") {
        // Members and people invited to it are the only ones who can see a project
        const project = await Project.findOne({
            _id: targetId,
            $or: [{ users: reporterId }, { "invites.user": reporterId }],
        }).select("name owner").lean();
        if (!project) throw new AppError("Project not found", 404);
        return { targetUser: project.owner, snapshot: { name: project.name, projectId: project._id } };
    }
    const message = await ChatMessage.findById(targetId).select("project sender role text").lean();
    if (!message || !message.project) throw new AppError("Message not found", 404);
    if (!(await Project.exists({ _id: message.project, users: reporterId }))) {
        throw new AppError("Message not found", 404);
    }
    if (message.role !== "user" || !message.sender) {
        throw new AppError("Only messages from people can be reported. Use “Report a problem” for AI answers", 400);
    }
    const sender = await userModel.findById(message.sender).select("username").lean();
    return {
        targetUser: message.sender,
        snapshot: { text: message.text.slice(0, 4000), username: sender?.username, projectId: message.project },
    };
};

export const createAbuseReport = async ({ reporterId, targetType, targetId, reason, details }: {
    reporterId: Id;
    targetType: unknown;
    targetId: unknown;
    reason: unknown;
    details: unknown;
}) => {
    if (!REPORT_TARGETS.includes(targetType as ReportTarget)) throw new AppError("Invalid report target", 400);
    if (!isId(targetId)) throw new AppError("Invalid id", 400);
    if (!REPORT_REASONS.includes(reason as ReportReason)) throw new AppError("Choose a reason", 400);
    const text = clip(details, 1000);
    if (reason === "other" && text.length < 10) throw new AppError("Tell us what happened (at least 10 characters)", 400);

    const { targetUser, snapshot } = await resolveTarget(targetType as ReportTarget, targetId, reporterId);
    if (targetUser && String(targetUser) === String(reporterId)) {
        throw new AppError("You can't report yourself", 400);
    }

    const duplicate = await AbuseReport.exists({ reporter: reporterId, targetType, target: targetId, status: "open" });
    if (duplicate) throw new AppError("You already reported this. We'll review it soon", 409);

    const report = await AbuseReport.create({
        reporter: reporterId,
        targetType,
        target: targetId,
        targetUser,
        reason,
        details: text,
        snapshot,
    });
    return { _id: report._id, status: report.status };
};

/** Admin: reports, newest first, with how often the same person was reported. */
export const listAbuseReports = async ({ status = "open", page = 1 }: { status?: string; page?: number }) => {
    const filter = status === "closed" ? { status: "closed" } : status === "all" ? {} : { status: "open" };
    const [items, total, open] = await Promise.all([
        AbuseReport.find(filter)
            .sort({ createdAt: -1 })
            .skip((Math.max(1, page) - 1) * PAGE_SIZE)
            .limit(PAGE_SIZE)
            .populate("reporter", "name username")
            .populate("targetUser", "name username email suspendedAt")
            .lean(),
        AbuseReport.countDocuments(filter),
        AbuseReport.countDocuments({ status: "open" }),
    ]);
    const userIds = [...new Set(items.map((r) => String((r.targetUser as { _id?: unknown } | null)?._id ?? "")).filter(Boolean))];
    const counts = await AbuseReport.aggregate<{ _id: Types.ObjectId; count: number }>([
        { $match: { targetUser: { $in: userIds.map((id) => new mongoose.Types.ObjectId(id)) } } },
        { $group: { _id: "$targetUser", count: { $sum: 1 } } },
    ]);
    const countBy = new Map(counts.map((c) => [String(c._id), c.count]));
    return {
        items: items.map((r) => ({
            ...r,
            reportsAgainstUser: countBy.get(String((r.targetUser as { _id?: unknown } | null)?._id ?? "")) ?? 0,
        })),
        total,
        open,
        page,
        pageSize: PAGE_SIZE,
    };
};

/* ---- suspension ---- */

const suspendedKey = (userId: Id) => `suspended:${String(userId)}`;

/** Checked on every request (Redis, so it doesn't cost a database query). */
export const isSuspended = async (userId: Id) => Boolean(await redisClient.get(suspendedKey(userId)));

export const setSuspended = async ({ userId, adminId, suspended, reason }: {
    userId: string;
    adminId: Id;
    suspended: boolean;
    reason?: string;
}) => {
    if (!isId(userId)) throw new AppError("Invalid user id", 400);
    if (String(userId) === String(adminId)) throw new AppError("You can't suspend yourself", 400);
    const result = await userModel.updateOne(
        { _id: userId },
        suspended
            ? { $set: { suspendedAt: new Date(), suspendedReason: clip(reason, 300) } }
            : { $set: { suspendedAt: null, suspendedReason: "" } },
    );
    if (result.matchedCount === 0) throw new AppError("User not found", 404);
    const user = await userModel.findById(userId).select("_id username suspendedAt suspendedReason").lean();
    if (suspended) {
        await redisClient.set(suspendedKey(userId), "1");
        await disconnectUser(String(userId));
    } else {
        await redisClient.del(suspendedKey(userId));
    }
    return user;
};

/** Redis can be emptied: rebuild the suspended list from the database at startup. */
export const syncSuspensions = async () => {
    const users = await userModel.find({ suspendedAt: { $ne: null } }).select("_id").lean();
    await Promise.all(users.map((u) => redisClient.set(suspendedKey(u._id), "1")));
};

/** Admin: close a report, optionally removing the content or suspending its author. */
export const resolveAbuseReport = async ({ reportId, adminId, action, note }: {
    reportId: string;
    adminId: Id;
    action: unknown;
    note?: unknown;
}) => {
    if (!isId(reportId)) throw new AppError("Invalid report id", 400);
    const report = await AbuseReport.findById(reportId);
    if (!report) throw new AppError("Report not found", 404);
    if (!["dismissed", "no-action", "content-removed", "user-suspended"].includes(String(action))) {
        throw new AppError("Invalid action", 400);
    }

    if (action === "content-removed") {
        if (report.targetType !== "message") throw new AppError("Only chat messages can be removed here", 400);
        const message = await ChatMessage.findByIdAndDelete(report.target).lean();
        if (message?.project) notifyMessageDeleted(String(message.project), String(report.target));
    }
    if (action === "user-suspended") {
        if (!report.targetUser) throw new AppError("This report has no user to suspend", 400);
        await setSuspended({
            userId: String(report.targetUser),
            adminId,
            suspended: true,
            reason: clip(note, 300) || `Reported for ${report.reason}`,
        });
    }

    // Close every open report about the same thing at once
    const resolved = { status: "closed", action, adminNote: clip(note, 1000), resolvedBy: adminId, resolvedAt: new Date() };
    const same = { targetType: report.targetType, target: report.target, status: "open" };
    const reporters = (await AbuseReport.find(same).select("reporter").lean()).map((r) => r.reporter);
    await AbuseReport.updateMany(same, { $set: resolved });

    const acted = action === "content-removed" || action === "user-suspended";
    void notify({
        users: reporters,
        type: "report-update",
        title: acted ? "We took action on your report" : "We reviewed your report",
        body: acted
            ? "Thanks for keeping Aivex safe."
            : "It didn't break our rules, but thanks for letting us know.",
        link: "",
    });
    return { closed: reporters.length };
};
