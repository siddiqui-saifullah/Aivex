import mongoose, { type Types } from "mongoose";
import JourneyEvent, { type JourneyType } from "../models/journeyEvent.model.js";
import Assignment from "../models/assignment.model.js";
import Classroom from "../models/classroom.model.js";
import Project from "../models/project.model.js";
import Submission from "../models/submission.model.js";
import HelpRequest from "../models/helpRequest.model.js";
import userModel from "../models/user.model.js";
import AppError from "../errors/AppError.js";
import { fromStoredFiles, toStoredFiles } from "../utils/fileStore.js";

type Id = Types.ObjectId | string;
type Files = Record<string, string>;

/** A full copy of the files at most this often (line counts are kept for every save). */
const SNAPSHOT_EVERY_MS = 60_000;
/** Projects bigger than this keep line counts only. */
const MAX_SNAPSHOT_CHARS = 400_000;
/** Gaps longer than this between steps don't count as time spent. */
const IDLE_GAP_MS = 10 * 60_000;
const HIDDEN = /(^|\/)\.aivex$/;

/* -------------------------------------------------------------------------- */
/* DIFF                                                                       */
/* -------------------------------------------------------------------------- */
/** Lines added and removed between two versions of a file (by line multiset). */
const lineDiff = (before: string, after: string) => {
    const counts = new Map<string, number>();
    for (const line of before.split("\n")) counts.set(line, (counts.get(line) ?? 0) + 1);
    let added = 0;
    for (const line of after.split("\n")) {
        const n = counts.get(line) ?? 0;
        if (n > 0) counts.set(line, n - 1);
        else added++;
    }
    let removed = 0;
    for (const n of counts.values()) removed += n;
    return { added, removed };
};

export const diffFiles = (before: Files, after: Files) => {
    let added = 0;
    let removed = 0;
    const files: string[] = [];
    for (const path of new Set([...Object.keys(before), ...Object.keys(after)])) {
        if (HIDDEN.test(path)) continue;
        if (before[path] === after[path]) continue;
        const d = lineDiff(before[path] ?? "", after[path] ?? "");
        if (!(path in before)) d.removed = 0;
        if (!(path in after)) d.added = 0;
        added += d.added;
        removed += d.removed;
        files.push(path);
    }
    return { added, removed, files };
};

/* -------------------------------------------------------------------------- */
/* RECORDING                                                                  */
/* -------------------------------------------------------------------------- */
type ProjectRef = { _id: Id; owner: Id; assignment?: Id | null; classroom?: Id | null };

const isAssignmentWork = (p: ProjectRef | null | undefined): p is ProjectRef & { assignment: Id } =>
    Boolean(p?.assignment && p.classroom);

/** A save or an AI edit: line counts, plus a snapshot when the last one is old enough. */
export const recordChange = async ({ project, before, after, actor, type }: {
    project: ProjectRef | null;
    before: Files;
    after: Files;
    actor: Id | null;
    type: Extract<JourneyType, "save" | "ai-edit">;
}) => {
    if (!isAssignmentWork(project)) return;
    const diff = diffFiles(before, after);
    if (diff.files.length === 0) return;

    const lastSnapshot = await JourneyEvent.findOne({ project: project._id, snapshot: { $ne: null } })
        .sort({ createdAt: -1 })
        .select("createdAt")
        .lean();
    const stored = toStoredFiles(after);
    const due = !lastSnapshot || Date.now() - lastSnapshot.createdAt.getTime() >= SNAPSHOT_EVERY_MS || type === "ai-edit";
    const small = JSON.stringify(stored).length <= MAX_SNAPSHOT_CHARS;

    await JourneyEvent.create({
        project: project._id,
        assignment: project.assignment,
        student: project.owner,
        actor,
        type,
        ...diff,
        snapshot: due && small ? stored : null,
    });
};

/** Never lets journey bookkeeping break the request that triggered it. */
export const recordSafely = (work: Promise<unknown>) => {
    work.catch((err) => console.error("Journey record failed:", err));
};

/** A run reported by the browser (C/C++ compile and run, or a Node run). */
export const recordRun = async ({ projectId, userId, ok, message }: {
    projectId: string;
    userId: Id;
    ok: unknown;
    message: unknown;
}) => {
    if (!mongoose.Types.ObjectId.isValid(projectId)) throw new AppError("Invalid project id", 400);
    if (typeof ok !== "boolean") throw new AppError("ok must be true or false", 400);
    const project = await Project.findOne({ _id: projectId, users: userId }).select("owner assignment classroom").lean();
    if (!project) throw new AppError("Project not found", 404);
    if (!isAssignmentWork(project)) return { recorded: false };
    await JourneyEvent.create({
        project: project._id,
        assignment: project.assignment,
        student: project.owner,
        actor: userId,
        type: "run",
        ok,
        message: typeof message === "string" ? message.trim().slice(0, 300) : "",
    });
    return { recorded: true };
};

/** A question to Vex in an assignment project. */
export const recordAiQuestion = async ({ projectId, userId, prompt }: { projectId: Id; userId: Id; prompt: string }) => {
    const project = await Project.findById(projectId).select("owner assignment classroom").lean();
    if (!isAssignmentWork(project)) return;
    await JourneyEvent.create({
        project: project._id,
        assignment: project.assignment,
        student: project.owner,
        actor: userId,
        type: "ai",
        message: prompt.slice(0, 300),
    });
};

/* -------------------------------------------------------------------------- */
/* READING                                                                    */
/* -------------------------------------------------------------------------- */
/** The teacher of the class, or the student themself. */
const assertCanView = async (assignmentId: string, studentId: string, userId: Id) => {
    if (!mongoose.Types.ObjectId.isValid(assignmentId)) throw new AppError("Invalid assignment id", 400);
    if (!mongoose.Types.ObjectId.isValid(studentId)) throw new AppError("Invalid student id", 400);
    const assignment = await Assignment.findById(assignmentId).select("title classroom").lean();
    if (!assignment) throw new AppError("Assignment not found", 404);
    const classroom = await Classroom.findById(assignment.classroom).select("name teacher").lean();
    if (!classroom) throw new AppError("Assignment not found", 404);
    const isTeacher = String(classroom.teacher) === String(userId);
    if (!isTeacher && String(studentId) !== String(userId)) throw new AppError("Journey not found", 404);
    return { assignment, classroom, isTeacher };
};

/** Time spent: the gaps between consecutive steps, ignoring long breaks. */
const activeMinutes = (times: number[]) => {
    let ms = 0;
    for (let i = 1; i < times.length; i++) {
        const gap = times[i] - times[i - 1];
        if (gap > 0 && gap <= IDLE_GAP_MS) ms += gap;
    }
    return Math.round(ms / 60_000);
};

export const getJourney = async ({ assignmentId, studentId, userId }: {
    assignmentId: string;
    studentId: string;
    userId: Id;
}) => {
    const { assignment, classroom, isTeacher } = await assertCanView(assignmentId, studentId, userId);

    const [events, submissions, help, student] = await Promise.all([
        JourneyEvent.find({ assignment: assignment._id, student: studentId })
            .select("-snapshot")
            .sort({ createdAt: 1 })
            .lean(),
        Submission.find({ assignment: assignment._id, student: studentId })
            .select("version status marks createdAt")
            .sort({ createdAt: 1 })
            .lean(),
        HelpRequest.find({ assignment: assignment._id, student: studentId }).select("message createdAt").lean(),
        userModel.findById(studentId).select("name username").lean(),
    ]);
    const withSnapshot = new Set(
        (await JourneyEvent.find({ assignment: assignment._id, student: studentId, snapshot: { $ne: null } }).select("_id").lean())
            .map((e) => String(e._id)),
    );

    const timeline = [
        ...events.map((e) => ({
            _id: String(e._id),
            type: e.type as string,
            at: e.createdAt,
            byTeacher: e.actor ? String(e.actor) === String(classroom.teacher) : false,
            added: e.added,
            removed: e.removed,
            files: e.files,
            ok: e.ok,
            message: e.message,
            hasSnapshot: withSnapshot.has(String(e._id)),
        })),
        ...submissions.map((s) => ({
            _id: String(s._id),
            type: "submit",
            at: s.createdAt,
            byTeacher: false,
            added: 0,
            removed: 0,
            files: [] as string[],
            ok: null,
            message: `Version ${s.version}`,
            hasSnapshot: false,
        })),
        ...help.map((h) => ({
            _id: String(h._id),
            type: "help",
            at: h.createdAt,
            byTeacher: false,
            added: 0,
            removed: 0,
            files: [] as string[],
            ok: null,
            message: h.message,
            hasSnapshot: false,
        })),
    ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

    const own = timeline.filter((e) => !e.byTeacher);
    const runs = own.filter((e) => e.type === "run");
    return {
        assignment: { _id: assignment._id, title: assignment.title },
        classroom: { _id: classroom._id, name: classroom.name },
        student: { _id: studentId, name: student?.name, username: student?.username },
        viewer: isTeacher ? "teacher" : "student",
        summary: {
            minutes: activeMinutes(own.map((e) => new Date(e.at).getTime())),
            saves: own.filter((e) => e.type === "save").length,
            linesWritten: own.filter((e) => e.type === "save").reduce((n, e) => n + e.added, 0),
            runs: runs.length,
            failedRuns: runs.filter((e) => e.ok === false).length,
            aiQuestions: own.filter((e) => e.type === "ai").length,
            aiLines: timeline.filter((e) => e.type === "ai-edit").reduce((n, e) => n + e.added, 0),
            helpRequests: own.filter((e) => e.type === "help").length,
            submissions: submissions.length,
            firstAt: timeline[0]?.at ?? null,
            lastAt: timeline[timeline.length - 1]?.at ?? null,
        },
        timeline,
    };
};

/** The files at one snapshot, with the previous snapshot to diff against. */
export const getJourneySnapshot = async ({ assignmentId, studentId, eventId, userId }: {
    assignmentId: string;
    studentId: string;
    eventId: string;
    userId: Id;
}) => {
    const { assignment } = await assertCanView(assignmentId, studentId, userId);
    if (!mongoose.Types.ObjectId.isValid(eventId)) throw new AppError("Invalid event id", 400);
    const event = await JourneyEvent.findOne({ _id: eventId, assignment: assignment._id, student: studentId, snapshot: { $ne: null } }).lean();
    if (!event) throw new AppError("Snapshot not found", 404);
    const previous = await JourneyEvent.findOne({
        assignment: assignment._id,
        student: studentId,
        snapshot: { $ne: null },
        createdAt: { $lt: event.createdAt },
    })
        .sort({ createdAt: -1 })
        .lean();
    return {
        _id: event._id,
        at: event.createdAt,
        files: fromStoredFiles(event.snapshot ?? []),
        previous: previous ? fromStoredFiles(previous.snapshot ?? []) : null,
    };
};

/** Work that leaves the class (or an assignment that is deleted) takes its journey with it. */
export const deleteJourneys = async (filter: { project?: { $in: Id[] }; assignment?: Id | { $in: Id[] } }) => {
    await JourneyEvent.deleteMany(filter);
};
