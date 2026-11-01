import mongoose, { type Types } from "mongoose";
import Assignment, { AI_POLICIES, type AiPolicy } from "../models/assignment.model.js";
import Classroom from "../models/classroom.model.js";
import Project from "../models/project.model.js";
import Submission from "../models/submission.model.js";
import { deleteJourneys } from "./journey.service.js";
import userModel from "../models/user.model.js";
import AppError from "../errors/AppError.js";
import { fromStoredFiles, toStoredFiles } from "../utils/fileStore.js";
import { detachStudentProjects } from "./classroom.service.js";
import { notifyProjectUpdated, onlineUsersByProject } from "../socket/io.js";
import { notify } from "./notification.service.js";

type Id = Types.ObjectId | string;

const MAX_TITLE = 100;
const MAX_INSTRUCTIONS = 10_000;

const assertId = (id: string, label: string) => {
    if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError(`Invalid ${label}`, 400);
};

const isDuplicateKey = (err: unknown) => (err as { code?: number }).code === 11000;

/* -------------------------------------------------------------------------- */
/* INPUT                                                                      */
/* -------------------------------------------------------------------------- */
const parseTitle = (value: unknown) => {
    const title = typeof value === "string" ? value.trim() : "";
    if (!title) throw new AppError("Assignment title is required", 400);
    if (title.length > MAX_TITLE) throw new AppError("Assignment title is too long", 400);
    return title;
};

const parseInstructions = (value: unknown) => {
    if (value === undefined || value === null) return "";
    if (typeof value !== "string") throw new AppError("Instructions must be text", 400);
    if (value.length > MAX_INSTRUCTIONS) throw new AppError("Instructions are too long", 400);
    return value.trim();
};

/** An ISO date, or null/"" for no due date. */
const parseDueAt = (value: unknown) => {
    if (value === undefined || value === null || value === "") return null;
    const date = new Date(typeof value === "string" || typeof value === "number" ? value : NaN);
    if (Number.isNaN(date.getTime())) throw new AppError("Invalid due date", 400);
    return date;
};

/** Optional whole number 1-1000, or null/"" for ungraded. */
const parseMaxMarks = (value: unknown) => {
    if (value === undefined || value === null || value === "") return null;
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > 1000) throw new AppError("Marks must be a whole number from 1 to 1000", 400);
    return n;
};

const parseAiPolicy = (value: unknown): AiPolicy => {
    if (value === undefined) return "allowed";
    if (!AI_POLICIES.includes(value as AiPolicy)) throw new AppError("AI rule must be allowed, hints or disabled", 400);
    return value as AiPolicy;
};

/* -------------------------------------------------------------------------- */
/* ACCESS                                                                     */
/* -------------------------------------------------------------------------- */
const loadClassroom = async (classroomId: string) => {
    assertId(classroomId, "class id");
    const classroom = await Classroom.findById(classroomId).select("name teacher stack starterFiles students").lean();
    if (!classroom) throw new AppError("Class not found", 404);
    return classroom;
};

type ClassroomDoc = Awaited<ReturnType<typeof loadClassroom>>;

const roleIn = (classroom: ClassroomDoc, userId: Id) => {
    if (String(classroom.teacher) === String(userId)) return "teacher" as const;
    if (classroom.students.some((s) => String(s.user) === String(userId))) return "student" as const;
    throw new AppError("You are not in this class", 403);
};

const loadAssignment = async (assignmentId: string, userId: Id) => {
    assertId(assignmentId, "assignment id");
    const assignment = await Assignment.findById(assignmentId).lean();
    if (!assignment) throw new AppError("Assignment not found", 404);
    const classroom = await loadClassroom(String(assignment.classroom));
    return { assignment, classroom, role: roleIn(classroom, userId) };
};

const teacherOnly = (role: "teacher" | "student", action: string) => {
    if (role !== "teacher") throw new AppError(`Only the teacher can ${action}`, 403);
};

const summary = (a: {
    _id: Types.ObjectId;
    classroom: Types.ObjectId;
    title: string;
    instructions: string;
    stack: string;
    dueAt: Date | null;
    aiPolicy: AiPolicy;
    maxMarks?: number | null;
    createdAt: Date;
}) => ({
    _id: a._id,
    classroom: a.classroom,
    title: a.title,
    instructions: a.instructions,
    stack: a.stack,
    dueAt: a.dueAt,
    aiPolicy: a.aiPolicy,
    maxMarks: a.maxMarks ?? null,
    createdAt: a.createdAt,
});

/** Each student's latest submission (highest version). */
const latestByStudent = <T extends { student: Types.ObjectId; version: number }>(rows: T[]) => {
    const latest = new Map<string, T>();
    for (const row of rows) {
        const key = String(row.student);
        if (!latest.has(key) || latest.get(key)!.version < row.version) latest.set(key, row);
    }
    return latest;
};

/* -------------------------------------------------------------------------- */
/* CREATE                                                                     */
/* -------------------------------------------------------------------------- */
export const createAssignment = async ({ classroomId, teacherId, input }: {
    classroomId: string;
    teacherId: Id;
    input: Record<string, unknown>;
}) => {
    const classroom = await loadClassroom(classroomId);
    teacherOnly(roleIn(classroom, teacherId), "add assignments");

    const title = parseTitle(input.title);
    const instructions = parseInstructions(input.instructions);
    const dueAt = parseDueAt(input.dueAt);
    const aiPolicy = parseAiPolicy(input.aiPolicy);
    const maxMarks = parseMaxMarks(input.maxMarks);

    // Starter code: one of the teacher's own projects, or the class's starter files
    let stack = classroom.stack;
    let starterFiles = classroom.starterFiles;
    if (typeof input.templateProjectId === "string" && input.templateProjectId) {
        assertId(input.templateProjectId, "template project");
        const template = await Project.findOne({ _id: input.templateProjectId, owner: teacherId })
            .select("files stack")
            .lean();
        if (!template) throw new AppError("Template project not found", 404);
        stack = template.stack;
        starterFiles = toStoredFiles(fromStoredFiles(template.files));
    }

    const assignment = await Assignment.create({
        classroom: classroom._id,
        title,
        instructions,
        stack,
        starterFiles,
        dueAt,
        aiPolicy,
        maxMarks,
        createdBy: teacherId,
    });

    if (classroom.students.length) {
        void notify({
            users: classroom.students.map((s) => s.user),
            type: "assignment",
            title: `New assignment in “${classroom.name}”: ${title}`,
            body: dueAt ? `Due ${dueAt.toUTCString().replace(/:\d\d GMT$/, " UTC")}` : "",
            link: `/classes/${classroom._id}/assignments/${assignment._id}`,
            actorId: teacherId,
        });
    }

    return summary(assignment.toObject());
};

/* -------------------------------------------------------------------------- */
/* LIST (teacher: how many started; student: their own work)                  */
/* -------------------------------------------------------------------------- */
export const listAssignments = async ({ classroomId, userId }: { classroomId: string; userId: Id }) => {
    const classroom = await loadClassroom(classroomId);
    const role = roleIn(classroom, userId);

    const assignments = await Assignment.find({ classroom: classroom._id })
        .select("-starterFiles")
        .sort({ createdAt: -1 })
        .lean();
    const ids = assignments.map((a) => a._id);
    const mineOnly = role === "student" ? { owner: userId } : {};
    const [work, submissions] = await Promise.all([
        Project.find({ assignment: { $in: ids }, classroom: classroom._id, ...mineOnly })
            .select("assignment owner updatedAt")
            .lean(),
        Submission.find({ assignment: { $in: ids }, ...(role === "student" ? { student: userId } : {}) })
            .select("assignment student version status")
            .lean(),
    ]);

    return assignments.map((a) => {
        const mine = work.filter((p) => String(p.assignment) === String(a._id));
        const latest = latestByStudent(submissions.filter((x) => String(x.assignment) === String(a._id)));
        return {
            ...summary(a),
            ...(role === "teacher"
                ? {
                    started: new Set(mine.map((p) => String(p.owner))).size,
                    studentCount: classroom.students.length,
                    submitted: latest.size,
                    toReview: [...latest.values()].filter((x) => x.status === "submitted").length,
                }
                : {
                    projectId: mine[0]?._id ?? null,
                    lastActive: mine[0]?.updatedAt ?? null,
                    submission: latest.get(String(userId)) ?? null,
                }),
        };
    });
};

/* -------------------------------------------------------------------------- */
/* DETAILS (teacher: every student's work, with who is online)                */
/* -------------------------------------------------------------------------- */
export const getAssignment = async ({ assignmentId, userId }: { assignmentId: string; userId: Id }) => {
    const { assignment, classroom, role } = await loadAssignment(assignmentId, userId);
    const base = { ...summary(assignment), role, classroomName: classroom.name };

    if (role === "student") {
        const [mine, submissions] = await Promise.all([
            Project.findOne({ assignment: assignment._id, owner: userId, classroom: classroom._id }).select("updatedAt").lean(),
            Submission.find({ assignment: assignment._id, student: userId }).select("-files").sort({ version: -1 }).lean(),
        ]);
        return {
            ...base,
            projectId: mine?._id ?? null,
            lastActive: mine?.updatedAt ?? null,
            submissions: submissions.map((x) => ({
                _id: x._id, version: x.version, status: x.status, note: x.note,
                feedback: x.feedback, marks: x.marks, reviewedAt: x.reviewedAt, createdAt: x.createdAt,
            })),
        };
    }

    const [projects, students, submissions] = await Promise.all([
        Project.find({ assignment: assignment._id, classroom: classroom._id }).select("owner updatedAt").lean(),
        userModel.find({ _id: { $in: classroom.students.map((s) => s.user) } }).select("name username").lean(),
        Submission.find({ assignment: assignment._id }).select("student version status marks createdAt").lean(),
    ]);
    const latest = latestByStudent(submissions);
    const projectByOwner = new Map(projects.map((p) => [String(p.owner), p]));
    const online = await onlineUsersByProject(projects.map((p) => String(p._id)));

    return {
        ...base,
        students: students.map((u) => {
            const project = projectByOwner.get(String(u._id));
            return {
                userId: u._id,
                name: u.name,
                username: u.username,
                projectId: project?._id ?? null,
                lastActive: project?.updatedAt ?? null,
                online: project ? online.get(String(project._id))?.has(String(u._id)) ?? false : false,
                submission: (() => {
                    const x = latest.get(String(u._id));
                    return x ? { _id: x._id, version: x.version, status: x.status, marks: x.marks, createdAt: x.createdAt } : null;
                })(),
            };
        }),
    };
};

/* -------------------------------------------------------------------------- */
/* START (a student's own project for the assignment)                         */
/* -------------------------------------------------------------------------- */
export const startAssignment = async ({ assignmentId, userId }: { assignmentId: string; userId: Id }) => {
    const { assignment, classroom, role } = await loadAssignment(assignmentId, userId);
    if (role !== "student") throw new AppError("Only students start assignments", 400);

    const mine = { assignment: assignment._id, owner: userId, classroom: classroom._id };
    const existing = await Project.findOne(mine).select("_id").lean();
    if (existing) return { projectId: existing._id, created: false };

    const student = await userModel.findById(userId).select("username").lean();
    if (!student) throw new AppError("User not found", 404);

    // Project names are unique site-wide
    const baseName = `${assignment.title} · ${student.username}`.slice(0, 120);
    let created = null;
    for (let attempt = 0; attempt < 3 && !created; attempt++) {
        try {
            created = await Project.create({
                name: attempt === 0 ? baseName : `${baseName} ${Math.random().toString(36).slice(2, 6)}`,
                owner: userId,
                users: [userId, classroom.teacher],
                stack: assignment.stack,
                files: toStoredFiles(fromStoredFiles(assignment.starterFiles)),
                classroom: classroom._id,
                assignment: assignment._id,
            });
        } catch (err) {
            if (!isDuplicateKey(err)) throw err;
        }
    }
    if (!created) throw new AppError("Could not start the assignment, please try again", 500);

    // A double click may have started it twice: keep the first
    const all = await Project.find(mine).select("_id createdAt").sort({ createdAt: 1, _id: 1 }).lean();
    const keep = all[0]?._id ?? created._id;
    const extras = all.filter((p) => String(p._id) !== String(keep)).map((p) => p._id);
    if (extras.length) await Project.deleteMany({ _id: { $in: extras } });

    return { projectId: keep, created: String(keep) === String(created._id) };
};

/* -------------------------------------------------------------------------- */
/* UPDATE / DELETE (teacher)                                                  */
/* -------------------------------------------------------------------------- */
export const updateAssignment = async ({ assignmentId, userId, input }: {
    assignmentId: string;
    userId: Id;
    input: Record<string, unknown>;
}) => {
    const { assignment, role } = await loadAssignment(assignmentId, userId);
    teacherOnly(role, "edit assignments");

    const changes: Partial<{ title: string; instructions: string; dueAt: Date | null; aiPolicy: AiPolicy; maxMarks: number | null }> = {};
    if (input.title !== undefined) changes.title = parseTitle(input.title);
    if (input.instructions !== undefined) changes.instructions = parseInstructions(input.instructions);
    if (input.dueAt !== undefined) changes.dueAt = parseDueAt(input.dueAt);
    if (input.aiPolicy !== undefined) changes.aiPolicy = parseAiPolicy(input.aiPolicy);
    if (input.maxMarks !== undefined) changes.maxMarks = parseMaxMarks(input.maxMarks);
    if (Object.keys(changes).length === 0) throw new AppError("Nothing to update", 400);

    await Assignment.updateOne({ _id: assignment._id }, { $set: changes });

    // Open student projects show the new instructions and AI rule right away
    const projects = await Project.find({ assignment: assignment._id }).select("_id").lean();
    for (const p of projects) notifyProjectUpdated(String(p._id), "assignment");

    return summary({ ...assignment, ...changes });
};

/** Students keep their work as personal projects; the teacher loses access to it. */
export const deleteAssignment = async ({ assignmentId, userId }: { assignmentId: string; userId: Id }) => {
    const { assignment, classroom, role } = await loadAssignment(assignmentId, userId);
    teacherOnly(role, "delete assignments");
    const projects = await Project.find({ assignment: assignment._id }).select("_id").lean();
    await detachStudentProjects(projects.map((p) => p._id), classroom.teacher);
    await Submission.deleteMany({ assignment: assignment._id });
    await deleteJourneys({ assignment: assignment._id });
    await Assignment.deleteOne({ _id: assignment._id });
};
