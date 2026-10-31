import mongoose, { type Types } from "mongoose";
import Assignment, { AI_POLICIES, type AiPolicy } from "../models/assignment.model.js";
import Classroom from "../models/classroom.model.js";
import Project from "../models/project.model.js";
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
    createdAt: Date;
}) => ({
    _id: a._id,
    classroom: a.classroom,
    title: a.title,
    instructions: a.instructions,
    stack: a.stack,
    dueAt: a.dueAt,
    aiPolicy: a.aiPolicy,
    createdAt: a.createdAt,
});

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
    const work = await Project.find({
        assignment: { $in: assignments.map((a) => a._id) },
        classroom: classroom._id,
        ...(role === "student" ? { owner: userId } : {}),
    })
        .select("assignment owner updatedAt")
        .lean();

    return assignments.map((a) => {
        const mine = work.filter((p) => String(p.assignment) === String(a._id));
        return {
            ...summary(a),
            ...(role === "teacher"
                ? { started: new Set(mine.map((p) => String(p.owner))).size, studentCount: classroom.students.length }
                : { projectId: mine[0]?._id ?? null, lastActive: mine[0]?.updatedAt ?? null }),
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
        const mine = await Project.findOne({ assignment: assignment._id, owner: userId, classroom: classroom._id })
            .select("updatedAt")
            .lean();
        return { ...base, projectId: mine?._id ?? null, lastActive: mine?.updatedAt ?? null };
    }

    const [projects, students] = await Promise.all([
        Project.find({ assignment: assignment._id, classroom: classroom._id }).select("owner updatedAt").lean(),
        userModel.find({ _id: { $in: classroom.students.map((s) => s.user) } }).select("name username").lean(),
    ]);
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

    const changes: Partial<{ title: string; instructions: string; dueAt: Date | null; aiPolicy: AiPolicy }> = {};
    if (input.title !== undefined) changes.title = parseTitle(input.title);
    if (input.instructions !== undefined) changes.instructions = parseInstructions(input.instructions);
    if (input.dueAt !== undefined) changes.dueAt = parseDueAt(input.dueAt);
    if (input.aiPolicy !== undefined) changes.aiPolicy = parseAiPolicy(input.aiPolicy);
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
    await Assignment.deleteOne({ _id: assignment._id });
};
