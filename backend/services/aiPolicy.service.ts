import type { Types } from "mongoose";
import Classroom from "../models/classroom.model.js";
import Project from "../models/project.model.js";
import Assignment, { type AiPolicy } from "../models/assignment.model.js";

type Id = Types.ObjectId | string;

/**
 * How much a user may use Vex AI in a project. Outside classes it's always
 * "allowed". In a student's class work:
 * - the teacher can always use it
 * - a class with AI turned off is "disabled" for students
 * - otherwise an assignment's own rule applies ("allowed", "hints" or "disabled")
 */
export const aiPolicyFor = async (
    project: { classroom?: Id | null; assignment?: Id | null } | null | undefined,
    userId: Id,
): Promise<AiPolicy> => {
    if (!project?.classroom) return "allowed";
    const classroom = await Classroom.findById(project.classroom).select("teacher aiEnabled").lean();
    if (!classroom || String(classroom.teacher) === String(userId)) return "allowed";
    if (classroom.aiEnabled === false) return "disabled";
    if (!project.assignment) return "allowed";
    const assignment = await Assignment.findById(project.assignment).select("aiPolicy").lean();
    return assignment?.aiPolicy ?? "allowed";
};

export const aiPolicyInProject = async (projectId: Id, userId: Id) =>
    aiPolicyFor(await Project.findById(projectId).select("classroom assignment").lean(), userId);

export const isAiDisabledInProject = async (projectId: Id, userId: Id) =>
    (await aiPolicyInProject(projectId, userId)) === "disabled";

export const AI_DISABLED_MESSAGE = "Your teacher has turned off Vex AI here";
