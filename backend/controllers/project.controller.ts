import { validationResult } from "express-validator";
import catchAsync from "../utils/catchAsync.js";
import * as projectService from "../services/project.service.js";
import AppError from "../errors/AppError.js";
import { disconnectUserFromProject, notifyProjectUpdated } from "../socket/io.js";

/* -------------------------------------------------------------------------- */
/* CREATE PROJECT                                                             */
/* -------------------------------------------------------------------------- */
export const createProject = catchAsync(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw new AppError("Invalid input data", 400);
    }

    const { name, stack } = req.body;
    const userId = req.user!._id;

    const project = await projectService.createProject({
        name,
        userId,
        stack,
    });

    res.status(201).json(project);
});

/* -------------------------------------------------------------------------- */
/* GET USER PROJECTS                                                          */
/* -------------------------------------------------------------------------- */
export const getUserProjects = catchAsync(async (req, res) => {
    const userId = req.user!._id;

    const projects = await projectService.userAllProjects({ userId });

    res.status(200).json(projects);
});

/* -------------------------------------------------------------------------- */
/* GET PROJECT BY ID                                                          */
/* -------------------------------------------------------------------------- */
export const getProjectById = catchAsync(async (req, res) => {
    const projectId = req.params.projectId as string;
    const userId = req.user!._id;

    const project = await projectService.getProjectById({
        projectId,
        userId,
    });

    res.status(200).json({
        success: true,
        project,
    });
});

/* -------------------------------------------------------------------------- */
/* DELETE PROJECT                                                             */
/* -------------------------------------------------------------------------- */
export const deleteProject = catchAsync(async (req, res) => {
    const projectId = req.params.projectId as string;
    const userId = req.user!._id;

    await projectService.deleteProject({ projectId, userId });
    notifyProjectUpdated(projectId, "deleted");

    res.status(204).end();
});

/* -------------------------------------------------------------------------- */
/* UPDATE PROJECT FILES                                                       */
/* -------------------------------------------------------------------------- */
export const updateProjectFiles = catchAsync(async (req, res) => {
    const projectId = req.params.projectId as string;
    const { fileTree } = req.body;
    const userId = req.user!._id;

    await projectService.updateProjectFiles({
        projectId,
        userId,
        fileTree,
    });

    res.status(204).end();
});

/* -------------------------------------------------------------------------- */
/* UPDATE PROJECT NAME                                                        */
/* -------------------------------------------------------------------------- */
export const updateProjectName = catchAsync(async (req, res) => {
    const projectId = req.params.projectId as string;
    const { newName } = req.body;
    const userId = req.user!._id;

    await projectService.updateProjectName({
        projectId,
        userId,
        newName,
    });
    notifyProjectUpdated(projectId, "renamed");

    res.status(204).end();
});


/* -------------------------------------------------------------------------- */
/* INVITE USERS                                                               */
/* -------------------------------------------------------------------------- */
export const inviteUsersToProject = catchAsync(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        throw new AppError("Invalid input data", 400);
    }

    const projectId = req.params.projectId as string;
    const { users } = req.body;
    const ownerId = req.user!._id;

    const result = await projectService.inviteUsersToProject({
        ownerId,
        projectId,
        users,
    });
    notifyProjectUpdated(projectId, "members");

    res.status(200).json({
        message: "Users added successfully",
        ...result,
    });
});

/* -------------------------------------------------------------------------- */
/* LEAVE PROJECT                                                              */
/* -------------------------------------------------------------------------- */
export const leaveProjectController = catchAsync(async (req, res) => {
    const projectId = req.params.projectId as string;
    const userId = req.user!._id;

    const result = await projectService.leaveProject({ projectId, userId });
    await disconnectUserFromProject(projectId, String(userId));
    notifyProjectUpdated(projectId, "members");

    res.status(200).json(result);
});

/* -------------------------------------------------------------------------- */
/* TRANSFER OWNERSHIP                                                         */
/* -------------------------------------------------------------------------- */
export const transferOwnershipController = catchAsync(async (req, res) => {
    const projectId = req.params.projectId as string;

    const result = await projectService.transferOwnership({
        projectId,
        ownerId: req.user!._id,
        newOwnerId: req.body.newOwnerId,
    });
    notifyProjectUpdated(projectId, "owner");

    res.status(200).json(result);
});

/* -------------------------------------------------------------------------- */
/* REMOVE MEMBER                                                              */
/* -------------------------------------------------------------------------- */
export const removeMemberController = catchAsync(async (req, res) => {
    const projectId = req.params.projectId as string;

    const result = await projectService.removeMember({
        projectId,
        ownerId: req.user!._id,
        memberId: req.params.memberId as string,
    });
    await disconnectUserFromProject(projectId, req.params.memberId as string);
    notifyProjectUpdated(projectId, "members");

    res.status(200).json(result);
});

/* -------------------------------------------------------------------------- */
/* REPORT ISSUE                                                               */
/* -------------------------------------------------------------------------- */
export const reportIssueController = catchAsync(async (req, res) => {
    const projectId = req.params.projectId as string;
    const report = req.body;

    if (!report) {
        throw new AppError("Report data is required", 400);
    }

    if (!projectId) {
        throw new AppError("Project ID is required", 400);
    }

    const userId = req.user!._id;

    const issue = await projectService.reportIssueInProject({
        projectId,
        report,
        userId,
    });

    res.status(201).json({
        message: "Report sent successfully",
        issueId: issue._id,
    });
});


