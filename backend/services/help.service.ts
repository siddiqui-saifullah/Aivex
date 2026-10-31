import mongoose, { type Types } from "mongoose";
import HelpRequest from "../models/helpRequest.model.js";
import Classroom from "../models/classroom.model.js";
import Project from "../models/project.model.js";
import Assignment from "../models/assignment.model.js";
import userModel from "../models/user.model.js";
import AppError from "../errors/AppError.js";
import { notifyProjectUpdated } from "../socket/io.js";
import { notify } from "./notification.service.js";

type Id = Types.ObjectId | string;

const assertId = (id: string, label: string) => {
    if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError(`Invalid ${label}`, 400);
};

/** A student's open request on one of their class projects, if any. */
export const openRequestFor = (projectId: Id) =>
    HelpRequest.findOne({ project: projectId, status: "open" }).select("message createdAt").lean();

/* -------------------------------------------------------------------------- */
/* ASK (student)                                                              */
/* -------------------------------------------------------------------------- */
export const requestHelp = async ({ projectId, userId, message }: { projectId: string; userId: Id; message?: unknown }) => {
    assertId(projectId, "project id");
    if (message !== undefined && typeof message !== "string") throw new AppError("Message must be text", 400);
    const text = (message ?? "").trim();
    if (text.length > 500) throw new AppError("Keep the message under 500 characters", 400);

    const project = await Project.findOne({ _id: projectId, owner: userId }).select("classroom assignment name").lean();
    if (!project) throw new AppError("Project not found", 404);
    if (!project.classroom) throw new AppError("Only class projects can ask a teacher for help", 400);
    const classroom = await Classroom.findById(project.classroom).select("name teacher students").lean();
    if (!classroom || !classroom.students.some((s) => String(s.user) === String(userId))) {
        throw new AppError("You are not in this class", 403);
    }

    // One open request per project: asking again just returns it
    const existing = await openRequestFor(project._id);
    if (existing) return { _id: existing._id, createdAt: existing.createdAt, alreadyOpen: true };

    const request = await HelpRequest.create({
        classroom: classroom._id,
        student: userId,
        project: project._id,
        assignment: project.assignment ?? null,
        message: text,
    });

    void notify({
        users: [classroom.teacher],
        type: "help-request",
        title: `{actor} needs help in “${classroom.name}”`,
        body: text.slice(0, 200),
        link: `/projects/${project._id}`,
        actorId: userId,
    });
    notifyProjectUpdated(String(project._id), "help");

    return { _id: request._id, createdAt: request.createdAt, alreadyOpen: false };
};

/* -------------------------------------------------------------------------- */
/* LIST (teacher): open requests in a class, oldest first                     */
/* -------------------------------------------------------------------------- */
export const listHelpRequests = async ({ classroomId, userId }: { classroomId: string; userId: Id }) => {
    assertId(classroomId, "class id");
    const classroom = await Classroom.findById(classroomId).select("teacher").lean();
    if (!classroom) throw new AppError("Class not found", 404);
    if (String(classroom.teacher) !== String(userId)) throw new AppError("Only the teacher sees help requests", 403);

    const requests = await HelpRequest.find({ classroom: classroomId, status: "open" }).sort({ createdAt: 1 }).lean();
    const [students, assignments] = await Promise.all([
        userModel.find({ _id: { $in: requests.map((r) => r.student) } }).select("name username").lean(),
        Assignment.find({ _id: { $in: requests.map((r) => r.assignment).filter(Boolean) } }).select("title").lean(),
    ]);
    const studentById = new Map(students.map((u) => [String(u._id), u]));
    const titleById = new Map(assignments.map((a) => [String(a._id), a.title]));

    return requests.map((r) => ({
        _id: r._id,
        projectId: r.project,
        message: r.message,
        createdAt: r.createdAt,
        student: { _id: r.student, name: studentById.get(String(r.student))?.name, username: studentById.get(String(r.student))?.username },
        assignmentTitle: r.assignment ? titleById.get(String(r.assignment)) ?? null : null,
    }));
};

/* -------------------------------------------------------------------------- */
/* RESOLVE: the teacher after helping, or the student withdrawing it          */
/* -------------------------------------------------------------------------- */
export const resolveHelpRequest = async ({ requestId, userId }: { requestId: string; userId: Id }) => {
    assertId(requestId, "request id");
    const request = await HelpRequest.findById(requestId).lean();
    if (!request) throw new AppError("Help request not found", 404);
    const classroom = await Classroom.findById(request.classroom).select("teacher").lean();
    const isTeacher = classroom && String(classroom.teacher) === String(userId);
    if (!isTeacher && String(request.student) !== String(userId)) throw new AppError("Help request not found", 404);
    if (request.status === "resolved") return { status: "resolved" as const };

    await HelpRequest.updateOne({ _id: request._id }, { $set: { status: "resolved", resolvedAt: new Date() } });
    notifyProjectUpdated(String(request.project), "help");
    return { status: "resolved" as const };
};
