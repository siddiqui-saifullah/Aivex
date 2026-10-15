import mongoose, { type Types } from "mongoose";
import Project, { PROJECT_STACKS, type ProjectStack } from "../models/project.model.js";
import userModel from "../models/user.model.js";
import AppError from "../errors/AppError.js";
import * as chatService from "../services/chats.service.js";
import issueModel from "../models/issue.model.js";
import type { IssueReport } from "../types/index.js";
import { fromStoredFiles, toStoredFiles } from "../utils/fileStore.js";

type Id = Types.ObjectId | string;

/* -------------------------------------------------------------------------- */
/* CREATE PROJECT                                                             */
/* -------------------------------------------------------------------------- */
export const createProject = async ({ name, userId, stack }: { name: string; userId: Id; stack?: unknown }) => {
    if (!name) throw new AppError("Project name required", 400);
    if (!userId) throw new AppError("UserId required", 400);

    // "Next.js" -> "nextjs", "Node.js" -> "nodejs"
    const normalizedStack = typeof stack === "string"
        ? stack.toLowerCase().replace(/[.\-\s]/g, "")
        : "nodejs";

    if (!PROJECT_STACKS.includes(normalizedStack as ProjectStack)) {
        throw new AppError(`Stack must be one of: ${PROJECT_STACKS.join(", ")}`, 400);
    }

    try {
        const project = await Project.create({
            name,
            owner: userId,
            users: [userId],
            stack: normalizedStack as ProjectStack,
            files: toStoredFiles({
                ".aivex": "//Aivex System File - Do not delete"
            })
        });
        const obj = project.toObject();
        return { ...obj, files: fromStoredFiles(obj.files) };
    } catch (err) {
        if ((err as { code?: number }).code === 11000) {
            throw new AppError("Project with this name already exists", 409);
        }
        throw err;
    }
};

/* -------------------------------------------------------------------------- */
/* USER PROJECTS                                                              */
/* -------------------------------------------------------------------------- */
export const userAllProjects = async ({ userId }: { userId: Id }) => {
    if (!userId) throw new AppError("UserId required", 400);

    // The dashboard never needs file contents; skipping them keeps the
    // response small no matter how big the projects are.
    return Project.find({ users: userId })
        .select("-files")
        .sort({ createdAt: -1 })
        .lean();
};

/* -------------------------------------------------------------------------- */
/* GET PROJECT BY ID                                                          */
/* -------------------------------------------------------------------------- */
export const getProjectById = async ({ projectId, userId }: { projectId: string; userId: Id }) => {
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
        files: fromStoredFiles(project.files),
        isOwner: project.owner.toString() === userId.toString(),
    };
};

/* -------------------------------------------------------------------------- */
/* DELETE PROJECT                                                             */
/* -------------------------------------------------------------------------- */
export const deleteProject = async ({ projectId, userId }: { projectId: string; userId: Id }) => {
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
export const updateProjectFiles = async ({ projectId, userId, fileTree }: {
    projectId: string;
    userId: Id;
    fileTree: Record<string, string>;
}) => {
    if (!fileTree) throw new AppError("File tree required", 400);

    const project = await Project.findOne({
        _id: projectId,
        users: userId,
    });

    if (!project) {
        throw new AppError("Access denied or project not found", 403);
    }

    project.files = toStoredFiles(fileTree);
    await project.save();
};

/* -------------------------------------------------------------------------- */
/* UPDATE PROJECT NAME                                                        */
/* -------------------------------------------------------------------------- */
export const updateProjectName = async ({
    projectId,
    userId,
    newName,
}: {
    projectId: string;
    userId: Id;
    newName: unknown;
}) => {

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
        throw new AppError("Invalid projectId", 400);
    }

    if (typeof newName !== "string" || !newName.trim()) {
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

    try {
        await project.save();
    } catch (err) {
        if ((err as { code?: number }).code === 11000) {
            throw new AppError("Project with this name already exists", 409);
        }
        throw err;
    }

    return {
        success: true,
        projectId,
        name: trimmedName,
    };
};


/* -------------------------------------------------------------------------- */
/* INVITE USERS                                                               */
/* -------------------------------------------------------------------------- */
export const inviteUsersToProject = async ({ ownerId, projectId, users }: {
    ownerId: Id;
    projectId: string;
    users: string[];
}) => {
    if (!Array.isArray(users) || users.length === 0) {
        throw new AppError("Users array required", 400);
    }

    const uniqueUsers = [...new Set(users)];

    if (!uniqueUsers.every(id => mongoose.Types.ObjectId.isValid(id))) {
        throw new AppError("Invalid users in list", 400);
    }

    const project = await Project.findById(projectId);

    if (!project) throw new AppError("Project not found", 404);
    if (!project.owner.equals(ownerId)) {
        throw new AppError("Only owner can invite users", 403);
    }

    const validUsers = await userModel.find({ _id: { $in: uniqueUsers } }).select("_id");

    if (validUsers.length !== uniqueUsers.length) {
        throw new AppError("Invalid users in list", 400);
    }

    const usersToAdd = uniqueUsers.filter(
        id => !project.users.some(u => u.equals(id))
    );

    if (usersToAdd.length === 0) {
        throw new AppError("All users already in project", 400);
    }

    project.users.push(...usersToAdd.map(id => new mongoose.Types.ObjectId(id)));
    await project.save();

    return {
        addedCount: usersToAdd.length,
        usersCount: project.users.length,
    };
};

/* -------------------------------------------------------------------------- */
/* LEAVE PROJECT                                                              */
/* -------------------------------------------------------------------------- */
export const leaveProject = async ({ projectId, userId }: { projectId: string; userId: Id }) => {
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
/* AI MEMORY                                                                  */
/* -------------------------------------------------------------------------- */
export const MAX_AI_MEMORY_CHARS = 2000;

export const updateAiMemory = async ({ projectId, userId, memory }: {
    projectId: string;
    userId: Id;
    memory: unknown;
}) => {
    if (typeof memory !== "string") {
        throw new AppError("memory must be text", 400);
    }
    if (memory.length > MAX_AI_MEMORY_CHARS) {
        throw new AppError(`Memory must be at most ${MAX_AI_MEMORY_CHARS} characters`, 400);
    }

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
        throw new AppError("Invalid projectId", 400);
    }

    const result = await Project.updateOne(
        { _id: projectId, users: userId },
        { aiMemory: memory.trim() },
    );

    if (result.matchedCount === 0) throw new AppError("Project not found or access denied", 404);
    return { aiMemory: memory.trim() };
};

/**
 * Save the AI's changes straight to the project so they persist even if
 * nobody presses save. Merges into the stored files (unchanged files stay)
 * and applies deletions; the .aivex system file is never removed.
 */
export const applyAiChanges = async ({ projectId, changed, deleted = [], memory }: {
    projectId: Id;
    changed: Record<string, string>;
    deleted?: string[];
    memory?: string;
}) => {
    const project = await Project.findById(projectId).select("files aiMemory");
    if (!project) return false;

    const hasFileChanges = Object.keys(changed).length > 0 || deleted.length > 0;

    if (hasFileChanges) {
        const files = { ...fromStoredFiles(project.files), ...changed };
        for (const path of deleted) {
            if (path === ".aivex") continue;
            for (const key of Object.keys(files)) {
                if (key === path || key.startsWith(path + "/")) delete files[key];
            }
        }
        project.files = toStoredFiles(files);
    }

    if (typeof memory === "string" && memory.trim()) {
        project.aiMemory = memory.trim().slice(0, MAX_AI_MEMORY_CHARS);
    }

    await project.save();
    return hasFileChanges;
};

/* -------------------------------------------------------------------------- */
/* TRANSFER OWNERSHIP                                                         */
/* -------------------------------------------------------------------------- */
export const transferOwnership = async ({ projectId, ownerId, newOwnerId }: {
    projectId: string;
    ownerId: Id;
    newOwnerId: unknown;
}) => {
    if (typeof newOwnerId !== "string" || !mongoose.Types.ObjectId.isValid(newOwnerId)) {
        throw new AppError("A valid newOwnerId is required", 400);
    }

    const project = await Project.findById(projectId);
    if (!project) throw new AppError("Project not found", 404);

    if (!project.owner.equals(ownerId)) {
        throw new AppError("Only the owner can transfer ownership", 403);
    }

    if (project.owner.equals(newOwnerId)) {
        throw new AppError("You already own this project", 400);
    }

    if (!project.users.some(id => id.equals(newOwnerId))) {
        throw new AppError("New owner must be a member of the project", 400);
    }

    project.owner = new mongoose.Types.ObjectId(newOwnerId);
    await project.save();

    return { success: true, owner: newOwnerId };
};

/* -------------------------------------------------------------------------- */
/* REMOVE MEMBER                                                              */
/* -------------------------------------------------------------------------- */
export const removeMember = async ({ projectId, ownerId, memberId }: {
    projectId: string;
    ownerId: Id;
    memberId: string;
}) => {
    if (!mongoose.Types.ObjectId.isValid(memberId)) {
        throw new AppError("Invalid member id", 400);
    }

    const project = await Project.findById(projectId);
    if (!project) throw new AppError("Project not found", 404);

    if (!project.owner.equals(ownerId)) {
        throw new AppError("Only the owner can remove members", 403);
    }

    if (project.owner.equals(memberId)) {
        throw new AppError("The owner cannot be removed", 400);
    }

    if (!project.users.some(id => id.equals(memberId))) {
        throw new AppError("User is not a member of this project", 404);
    }

    project.users = project.users.filter(id => !id.equals(memberId));
    await project.save();

    return { success: true, usersCount: project.users.length };
};

/* -------------------------------------------------------------------------- */
/* REPORT ISSUE                                                               */
/* -------------------------------------------------------------------------- */
export const reportIssueInProject = async ({
    projectId,
    report,
    userId,
}: {
    projectId: string;
    report: IssueReport;
    userId: Id;
}) => {
    const {
        type = "bug",
        title,
        description,
        severity = "medium",
        context = {},
    } = report;

    if (!projectId) {
        throw new AppError("Project ID is required", 400);
    }

    if (!title || !description) {
        throw new AppError("Title and description are required", 400);
    }

    const issue = await issueModel.create({
        type,
        title,
        description,
        severity,
        reportedBy: userId,
        context,
    });

    return issue;
};
