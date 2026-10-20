import type { Types } from "mongoose";
import Classroom from "../models/classroom.model.js";
import Project from "../models/project.model.js";

type Id = Types.ObjectId | string;

/**
 * Teachers can turn Vex AI off for a class. It then stays off for the
 * students in their class projects; the teacher can still use it there.
 */
export const isAiDisabledFor = async (classroomId: Id | null | undefined, userId: Id) => {
    if (!classroomId) return false;
    const classroom = await Classroom.findById(classroomId).select("teacher aiEnabled").lean();
    return !!classroom && classroom.aiEnabled === false && String(classroom.teacher) !== String(userId);
};

export const isAiDisabledInProject = async (projectId: Id, userId: Id) => {
    const project = await Project.findById(projectId).select("classroom").lean();
    return isAiDisabledFor(project?.classroom, userId);
};

export const AI_DISABLED_MESSAGE = "Your teacher has turned off Vex AI for this class";
