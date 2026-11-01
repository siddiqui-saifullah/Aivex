import crypto from "node:crypto";
import mongoose, { type Types } from "mongoose";
import Classroom from "../models/classroom.model.js";
import Project from "../models/project.model.js";
import Assignment from "../models/assignment.model.js";
import Submission from "../models/submission.model.js";
import HelpRequest from "../models/helpRequest.model.js";
import { deleteJourneys } from "./journey.service.js";
import userModel from "../models/user.model.js";
import AppError from "../errors/AppError.js";
import { fromStoredFiles, toStoredFiles } from "../utils/fileStore.js";
import { normalizeStack, starterFilesFor } from "./project.service.js";
import { disconnectUserFromProject, notifyProjectUpdated, onlineUsersByProject } from "../socket/io.js";
import { notify } from "./notification.service.js";
import { onStudentJoined, onStudentLeft } from "./institute.service.js";

type Id = Types.ObjectId | string;

// No 0/O/1/I/L: codes get read out loud and written on boards
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_LENGTH = 6;

const generateCode = () =>
    Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)]).join("");

const isDuplicateKey = (err: unknown) => (err as { code?: number }).code === 11000;

const assertId = (id: string, label: string) => {
    if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError(`Invalid ${label}`, 400);
};

/* -------------------------------------------------------------------------- */
/* CREATE                                                                     */
/* -------------------------------------------------------------------------- */
export const createClassroom = async ({ teacherId, name, stack, templateProjectId, aiEnabled = true }: {
    teacherId: Id;
    name: string;
    stack?: unknown;
    aiEnabled?: boolean;
    /** Copy the starter files from one of the teacher's projects. */
    templateProjectId?: string;
}) => {
    const trimmed = name?.trim();
    if (!trimmed) throw new AppError("Class name is required", 400);
    if (trimmed.length > 60) throw new AppError("Class name is too long", 400);

    let normalizedStack = normalizeStack(stack ?? "c");
    let starter = starterFilesFor(normalizedStack);

    if (templateProjectId) {
        assertId(templateProjectId, "template project");
        const template = await Project.findOne({ _id: templateProjectId, users: teacherId })
            .select("files stack")
            .lean();
        if (!template) throw new AppError("Template project not found", 404);
        starter = fromStoredFiles(template.files);
        normalizedStack = template.stack;
    }

    // Retry on the (rare) code collision
    for (let attempt = 0; attempt < 5; attempt++) {
        try {
            const classroom = await Classroom.create({
                name: trimmed,
                teacher: teacherId,
                code: generateCode(),
                stack: normalizedStack,
                aiEnabled,
                starterFiles: toStoredFiles(starter),
                students: [],
            });
            return {
                _id: classroom._id,
                name: classroom.name,
                code: classroom.code,
                stack: classroom.stack,
                aiEnabled: classroom.aiEnabled,
            };
        } catch (err) {
            if (!isDuplicateKey(err)) throw err;
        }
    }
    throw new AppError("Could not create the class, please try again", 500);
};

/* -------------------------------------------------------------------------- */
/* LIST                                                                       */
/* -------------------------------------------------------------------------- */
export const listClassrooms = async ({ userId }: { userId: Id }) => {
    const classes = await Classroom.find({ $or: [{ teacher: userId }, { "students.user": userId }] })
        .select("name code stack aiEnabled teacher students createdAt")
        .populate("teacher", "name username")
        .sort({ createdAt: -1 })
        .lean();

    return classes.map((c) => {
        const teacher = c.teacher as unknown as { _id: Types.ObjectId; name?: string; username?: string };
        const isTeacher = String(teacher._id) === String(userId);
        const mine = c.students.find((s) => String(s.user) === String(userId));
        return {
            _id: c._id,
            name: c.name,
            stack: c.stack,
            aiEnabled: c.aiEnabled !== false,
            role: isTeacher ? "teacher" : "student",
            // Only the teacher hands out the code
            code: isTeacher ? c.code : undefined,
            teacher: { name: teacher.name, username: teacher.username },
            studentCount: c.students.length,
            projectId: mine?.project,
            createdAt: c.createdAt,
        };
    });
};

/* -------------------------------------------------------------------------- */
/* DETAILS (teacher: every student's project and who is online)               */
/* -------------------------------------------------------------------------- */
export const getClassroom = async ({ classroomId, userId }: { classroomId: string; userId: Id }) => {
    assertId(classroomId, "class id");
    const classroom = await Classroom.findById(classroomId)
        .select("-starterFiles")
        .populate("teacher", "name username")
        .populate("students.user", "name username")
        .lean();
    if (!classroom) throw new AppError("Class not found", 404);

    const teacher = classroom.teacher as unknown as { _id: Types.ObjectId; name?: string; username?: string };
    const isTeacher = String(teacher._id) === String(userId);
    const mine = classroom.students.find((s) => {
        const u = s.user as unknown as { _id: Types.ObjectId };
        return String(u._id) === String(userId);
    });
    if (!isTeacher && !mine) throw new AppError("You are not in this class", 403);

    const base = {
        _id: classroom._id,
        name: classroom.name,
        stack: classroom.stack,
        aiEnabled: classroom.aiEnabled !== false,
        role: isTeacher ? "teacher" : "student",
        teacher: { name: teacher.name, username: teacher.username },
        studentCount: classroom.students.length,
    };

    if (!isTeacher) {
        return { ...base, projectId: mine!.project };
    }

    const projectIds = classroom.students.map((s) => s.project);
    const [projects, online] = await Promise.all([
        Project.find({ _id: { $in: projectIds } }).select("updatedAt name").lean(),
        onlineUsersByProject(projectIds.map(String)),
    ]);
    const projectById = new Map(projects.map((p) => [String(p._id), p]));

    return {
        ...base,
        code: classroom.code,
        students: classroom.students.map((s) => {
            const u = s.user as unknown as { _id: Types.ObjectId; name?: string; username?: string };
            const project = projectById.get(String(s.project));
            return {
                userId: u._id,
                name: u.name,
                username: u.username,
                projectId: s.project,
                joinedAt: s.joinedAt,
                lastActive: project?.updatedAt ?? s.joinedAt,
                online: online.get(String(s.project))?.has(String(u._id)) ?? false,
            };
        }),
    };
};

/* -------------------------------------------------------------------------- */
/* JOIN (creates the student's own project from the starter files)            */
/* -------------------------------------------------------------------------- */
export const joinClassroom = async ({ code, userId }: { code: string; userId: Id }) => {
    const normalized = String(code ?? "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (normalized.length !== CODE_LENGTH) throw new AppError("Enter the 6-character class code", 400);

    const classroom = await Classroom.findOne({ code: normalized }).lean();
    if (!classroom) throw new AppError("No class found with this code", 404);
    if (String(classroom.teacher) === String(userId)) {
        throw new AppError("You are the teacher of this class", 400);
    }

    const existing = classroom.students.find((s) => String(s.user) === String(userId));
    if (existing) return { classroomId: classroom._id, projectId: existing.project, alreadyJoined: true };

    const student = await userModel.findById(userId).select("username name").lean();
    if (!student) throw new AppError("User not found", 404);

    // Project names are unique site-wide; usernames are too
    const baseName = `${classroom.name} · ${student.username}`;
    let project = null;
    for (let attempt = 0; attempt < 3 && !project; attempt++) {
        try {
            project = await Project.create({
                name: attempt === 0 ? baseName : `${baseName} ${Math.random().toString(36).slice(2, 6)}`,
                owner: userId,
                users: [userId, classroom.teacher],
                stack: classroom.stack,
                files: toStoredFiles(fromStoredFiles(classroom.starterFiles)),
                classroom: classroom._id,
            });
        } catch (err) {
            if (!isDuplicateKey(err)) throw err;
        }
    }
    if (!project) throw new AppError("Could not create your project, please try again", 500);

    // Atomic: a double click must not enrol the student twice
    const result = await Classroom.updateOne(
        { _id: classroom._id, "students.user": { $ne: userId } },
        { $push: { students: { user: userId, project: project._id, joinedAt: new Date() } } },
    );
    if (result.modifiedCount === 0) {
        await project.deleteOne();
        const fresh = await Classroom.findById(classroom._id).select("students").lean();
        const mine = fresh?.students.find((s) => String(s.user) === String(userId));
        if (!mine) throw new AppError("Could not join the class, please try again", 500);
        return { classroomId: classroom._id, projectId: mine.project, alreadyJoined: true };
    }

    void onStudentJoined(classroom.teacher, userId).catch((err) => console.error("Seat failed:", err));
    void notify({
        users: [classroom.teacher],
        type: "class-join",
        title: `{actor} joined your class “${classroom.name}”`,
        link: `/classes/${classroom._id}`,
        actorId: userId,
    });

    return { classroomId: classroom._id, projectId: project._id, alreadyJoined: false };
};

/* -------------------------------------------------------------------------- */
/* SETTINGS (teacher: allow or block Vex AI for students)                     */
/* -------------------------------------------------------------------------- */
export const updateClassroomSettings = async ({ classroomId, userId, aiEnabled }: {
    classroomId: string;
    userId: Id;
    aiEnabled: unknown;
}) => {
    assertId(classroomId, "class id");
    if (typeof aiEnabled !== "boolean") throw new AppError("aiEnabled must be true or false", 400);

    const classroom = await Classroom.findById(classroomId).select("name teacher aiEnabled students").lean();
    if (!classroom) throw new AppError("Class not found", 404);
    if (String(classroom.teacher) !== String(userId)) {
        throw new AppError("Only the teacher can change class settings", 403);
    }

    await Classroom.updateOne({ _id: classroomId }, { $set: { aiEnabled } });
    // Open student projects pick up the change right away
    for (const s of classroom.students) notifyProjectUpdated(String(s.project), "ai-policy");
    if ((classroom.aiEnabled !== false) !== aiEnabled) {
        for (const s of classroom.students) {
            void notify({
                users: [s.user],
                type: "class-ai",
                title: aiEnabled
                    ? `Vex AI is now on in “${classroom.name}”`
                    : `Vex AI was turned off in “${classroom.name}”`,
                body: aiEnabled ? "You can ask @Vex for help again." : "Your teacher turned off the AI for this class.",
                link: `/projects/${s.project}`,
                actorId: userId,
            });
        }
    }
    return { aiEnabled };
};

/* -------------------------------------------------------------------------- */
/* MEMBERSHIP: leaving, removing students, deleting the class                 */
/* -------------------------------------------------------------------------- */
/** Take a student (by user or by project) off the class roster. */
export const pullStudent = async (classroomId: Id, match: { user?: Id; project?: Id }) => {
    const [field, id] = match.user ? ["user", match.user] : ["project", match.project];
    await Classroom.updateOne({ _id: classroomId }, { $pull: { students: { [field as string]: id } } });
    // FerretDB (local development) accepts $pull with a condition but doesn't apply it
    const classroom = await Classroom.findById(classroomId).select("students").lean();
    const remaining = classroom?.students.filter((s) => String(s[field as "user" | "project"]) !== String(id));
    if (classroom && remaining && remaining.length !== classroom.students.length) {
        await Classroom.updateOne({ _id: classroomId }, { $set: { students: remaining } });
    }
};

/**
 * A student who is no longer in the class keeps their class work as personal
 * projects, and the teacher loses access to it.
 */
export const detachStudentProjects = async (projectIds: Id[], teacherId: Id) => {
    if (projectIds.length === 0) return;
    await HelpRequest.deleteMany({ project: { $in: projectIds }, status: "open" });
    // The teacher's view of how the work was done goes with it
    await deleteJourneys({ project: { $in: projectIds } });
    await Project.updateMany(
        { _id: { $in: projectIds } },
        { $set: { classroom: null, assignment: null }, $pull: { users: teacherId, invites: { user: teacherId } } },
    );
    for (const id of projectIds) {
        notifyProjectUpdated(String(id), "members");
        void disconnectUserFromProject(String(id), String(teacherId));
    }
};

/** A student's class project and their work on every assignment of the class. */
const classProjectsOf = async (classroomId: Id, studentId: Id, classProject: Id) => {
    const work = await Project.find({ classroom: classroomId, owner: studentId }).select("_id").lean();
    return [...new Set([String(classProject), ...work.map((p) => String(p._id))])];
};

/** A student leaves a class. */
export const leaveClassroom = async ({ classroomId, userId }: { classroomId: string; userId: Id }) => {
    assertId(classroomId, "class id");
    const classroom = await Classroom.findById(classroomId).select("name teacher students").lean();
    if (!classroom) throw new AppError("Class not found", 404);
    const mine = classroom.students.find((s) => String(s.user) === String(userId));
    if (!mine) throw new AppError("You are not a student in this class", 400);

    await pullStudent(classroomId, { user: mine.user });
    await detachStudentProjects(await classProjectsOf(classroomId, mine.user, mine.project), classroom.teacher);
    await onStudentLeft(classroom.teacher, mine.user);
    void notify({
        users: [classroom.teacher],
        type: "class-leave",
        title: `{actor} left your class “${classroom.name}”`,
        link: `/classes/${classroom._id}`,
        actorId: userId,
    });
};

/** The teacher removes a student from the class. */
export const removeStudent = async ({ classroomId, teacherId, studentId }: {
    classroomId: string;
    teacherId: Id;
    studentId: string;
}) => {
    assertId(classroomId, "class id");
    assertId(studentId, "student id");
    const classroom = await Classroom.findById(classroomId).select("name teacher students").lean();
    if (!classroom) throw new AppError("Class not found", 404);
    if (String(classroom.teacher) !== String(teacherId)) {
        throw new AppError("Only the teacher can remove students", 403);
    }
    const student = classroom.students.find((s) => String(s.user) === studentId);
    if (!student) throw new AppError("This student is not in the class", 404);

    await pullStudent(classroomId, { user: student.user });
    await detachStudentProjects(await classProjectsOf(classroomId, student.user, student.project), classroom.teacher);
    await onStudentLeft(classroom.teacher, student.user);
    void notify({
        users: [studentId],
        type: "class-removed",
        title: `{actor} removed you from the class “${classroom.name}”`,
        body: "Your project is still yours, as a personal project.",
        link: `/projects/${student.project}`,
        actorId: teacherId,
    });
};

/** Students keep their projects (as personal ones); the teacher loses access to them. */
export const deleteClassroom = async ({ classroomId, userId }: { classroomId: string; userId: Id }) => {
    assertId(classroomId, "class id");
    const classroom = await Classroom.findById(classroomId).select("teacher students").lean();
    if (!classroom) throw new AppError("Class not found", 404);
    if (String(classroom.teacher) !== String(userId)) throw new AppError("Only the teacher can delete the class", 403);
    const projects = await Project.find({ classroom: classroomId }).select("_id").lean();
    await detachStudentProjects(projects.map((p) => p._id), classroom.teacher);
    await Submission.deleteMany({ classroom: classroomId });
    await HelpRequest.deleteMany({ classroom: classroomId });
    await Assignment.deleteMany({ classroom: classroomId });
    await Classroom.deleteOne({ _id: classroomId });
    // Students not in another of this teacher's classes give their seats back
    for (const s of classroom.students) await onStudentLeft(classroom.teacher, s.user);
};
