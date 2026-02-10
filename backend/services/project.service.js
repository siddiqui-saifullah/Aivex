import mongoose from "mongoose";
import Project from "../models/project.model.js";
import userModel from "../models/user.model.js";
import AppError from "../errors/AppError.js";
import * as chatService from "../services/chats.service.js";
import issueModel from "../models/issue.model.js";

/* -------------------------------------------------------------------------- */
/* CREATE PROJECT                                                             */
/* -------------------------------------------------------------------------- */
export const createProject = async ({ name, userId, stack }) => {
    if (!name) throw new AppError("Project name required", 400);
    if (!userId) throw new AppError("UserId required", 400);

    const normalizedStack = stack
        ? String(stack).toLowerCase().replace(/[.\-\s]/g, "")
        : "nodejs";

    try {
        return await Project.create({
            name,
            owner: userId,
            users: [userId],
            stack: normalizedStack,
        });
    } catch (err) {
        if (err.code === 11000) {
            throw new AppError("Project with this name already exists", 409);
        }
        throw err;
    }
};

/* -------------------------------------------------------------------------- */
/* USER PROJECTS                                                              */
/* -------------------------------------------------------------------------- */
export const userAllProjects = async ({ userId }) => {
    if (!userId) throw new AppError("UserId required", 400);

    return Project.find({ users: userId })
        .sort({ createdAt: -1 })
        .lean();
};

/* -------------------------------------------------------------------------- */
/* GET PROJECT BY ID                                                          */
/* -------------------------------------------------------------------------- */
export const getProjectById = async ({ projectId, userId }) => {
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
        throw new AppError("Invalid projectId", 400);
    }

    const project = await Project.findOne({
        _id: projectId,
        users: userId,
    })
        .populate("users", "name username")
        .lean();

    if (!project) {
        throw new AppError("Project not found or access denied", 404);
    }

    return {
        ...project,
        isOwner: project.owner.toString() === userId.toString(),
    };
};

/* -------------------------------------------------------------------------- */
/* DELETE PROJECT                                                             */
/* -------------------------------------------------------------------------- */
export const deleteProject = async ({ projectId, userId }) => {
    const project = await Project.findById(projectId);

    if (!project) {
        throw new AppError("Project not found", 404);
    }

    if (!project.owner.equals(userId)) {
        throw new AppError("Only owner can delete project", 403);
    }

    await chatService.deleteChatsByProjectId({ projectId });

    await project.deleteOne();
};

/* -------------------------------------------------------------------------- */
/* UPDATE FILES                                                               */
/* -------------------------------------------------------------------------- */
export const updateProjectFiles = async ({ projectId, userId, fileTree }) => {
    if (!fileTree) throw new AppError("File tree required", 400);

    const project = await Project.findOne({
        _id: projectId,
        users: userId,
    });

    if (!project) {
        throw new AppError("Access denied or project not found", 403);
    }

    project.files = fileTree;
    await project.save();
};

/* -------------------------------------------------------------------------- */
/* UPDATE PROJECT NAME                                                        */
/* -------------------------------------------------------------------------- */
export const updateProjectName = async ({
    projectId,
    userId,
    newName,
}) => {

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
        throw new AppError("Invalid projectId", 400);
    }

    if (!newName || !newName.trim()) {
        throw new AppError("Project name cannot be empty", 400);
    }

    const trimmedName = newName.trim();

    const project = await Project.findById(projectId);

    if (!project) {
        throw new AppError("Project not found", 404);
    }

    if (!project.owner.equals(userId)) {
        throw new AppError("Only project owner can rename the project", 403);
    }

    if (project.name === trimmedName) {
        throw new AppError("New project name must be different", 400);
    }

    if (project.lastRenamedAt) {
        const diffMs = Date.now() - project.lastRenamedAt.getTime();
        const hoursPassed = diffMs / (1000 * 60 * 60);

        if (hoursPassed < 24) {
            const remainingMs = 24 * 60 * 60 * 1000 - diffMs;
            const remainingHours = Math.ceil(
                remainingMs / (1000 * 60 * 60)
            );

            throw new AppError(
                `You can rename this project again in ${remainingHours} hour(s)`,
                400
            );
        }
    }

    project.name = trimmedName;
    project.lastRenamedAt = new Date();
    await project.save();

    return {
        success: true,
        projectId,
        name: trimmedName,
    };
};


/* -------------------------------------------------------------------------- */
/* INVITE USERS                                                               */
/* -------------------------------------------------------------------------- */
export const inviteUsersToProject = async ({ ownerId, projectId, users }) => {
    if (!Array.isArray(users) || users.length === 0) {
        throw new AppError("Users array required", 400);
    }

    const project = await Project.findById(projectId);

    if (!project) throw new AppError("Project not found", 404);
    if (!project.owner.equals(ownerId)) {
        throw new AppError("Only owner can invite users", 403);
    }

    const validUsers = await userModel.find({ _id: { $in: users } });

    if (validUsers.length !== users.length) {
        throw new AppError("Invalid users in list", 400);
    }

    const usersToAdd = users.filter(
        id => !project.users.some(u => u.equals(id))
    );

    if (usersToAdd.length === 0) {
        throw new AppError("All users already in project", 400);
    }

    project.users.push(...usersToAdd);
    await project.save();

    return {
        addedCount: usersToAdd.length,
        usersCount: project.users.length,
    };
};

/* -------------------------------------------------------------------------- */
/* LEAVE PROJECT                                                              */
/* -------------------------------------------------------------------------- */
export const leaveProject = async ({ projectId, userId }) => {
    const project = await Project.findById(projectId);

    if (!project) throw new AppError("Project not found", 404);

    if (project.owner.equals(userId)) {
        throw new AppError("Owner cannot leave project", 403);
    }

    if (!project.users.some(id => id.equals(userId))) {
        throw new AppError("User not in project", 400);
    }

    project.users = project.users.filter(id => !id.equals(userId));
    await project.save();

    return { success: true };
};

/* -------------------------------------------------------------------------- */
/* REPORT ISSUE                                                               */
/* -------------------------------------------------------------------------- */
export const reportIssueInProject = async ({
    projectId,
    report,
    userId,
}) => {
    const {
        type = "bug",
        title,
        description,
        severity = "medium",
        context = {},
    } = report;

    if (!projectId) {
        throw new Error("Project ID is required");
    }

    if (!title || !description) {
        throw new Error("Title and description are required");
    }

    const issue = await issueModel.create({
        type,
        title,
        description,
        severity,
        projectId,
        reportedBy: userId,
        context,
    });

    return issue;
};

