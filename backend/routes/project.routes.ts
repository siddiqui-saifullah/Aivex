import { Router, type Router as ExpressRouter } from "express";
import { body } from "express-validator";

import * as projectController from "../controllers/project.controller.js";
import * as authMiddleware from "../middleware/auth.middleware.js";
import { rateLimit } from "../middleware/rateLimit.middleware.js";
import {
    updateProjectFilesValidator,
    validate,
} from "../middleware/project.middleware.js";

import chatRoutes from "./project.chat.routes.js";

const router: ExpressRouter = Router();

/* -------------------------------------------------------------------------- */
/* AUTH MIDDLEWARE (protect all routes)                                       */
/* -------------------------------------------------------------------------- */
router.use(authMiddleware.authUser);

/* -------------------------------------------------------------------------- */
/* COLLECTION ROUTES                                                          */
/* -------------------------------------------------------------------------- */

// Create project
router.post(
    "/",
    body("name").isString().withMessage("Name is required"),
    projectController.createProject
);

// Get all user projects
router.get("/", projectController.getUserProjects);

// Invitations waiting for the current user's answer
router.get("/invites", projectController.listMyInvitesController);

/* -------------------------------------------------------------------------- */
/* SINGLE PROJECT ROUTES                                                      */
/* -------------------------------------------------------------------------- */

// Get project by id
router.get("/:projectId", projectController.getProjectById);

// Delete project
router.delete("/:projectId", projectController.deleteProject);

// Update project files
router.patch(
    "/:projectId",
    updateProjectFilesValidator,
    validate,
    projectController.updateProjectFiles
);

/* -------------------------------------------------------------------------- */
/* PROJECT ACTIONS                                                            */
/* -------------------------------------------------------------------------- */

// Update project name
router.patch(
    "/:projectId/name",
    projectController.updateProjectName
);

// Invite users
router.patch(
    "/:projectId/invite",
    body("users")
        .isArray({ min: 1 })
        .withMessage("Users must be an array")
        .bail()
        .custom((users: unknown[]) => users.every((u) => typeof u === "string"))
        .withMessage("Each user must be a string"),
    projectController.inviteUsersToProject
);

// Answer an invitation (the invitee)
router.post("/:projectId/invites/accept", projectController.acceptInviteController);
router.post("/:projectId/invites/decline", projectController.declineInviteController);

// Withdraw a pending invitation (owner only)
router.delete("/:projectId/invites/:userId", projectController.cancelInviteController);

// Edit / clear the AI's long-term project memory (any member)
router.put(
    "/:projectId/memory",
    projectController.updateAiMemoryController
);

// Transfer ownership to another member
router.patch(
    "/:projectId/owner",
    body("newOwnerId").isString().withMessage("newOwnerId is required"),
    validate,
    projectController.transferOwnershipController
);

// Remove a member (owner only)
router.delete(
    "/:projectId/members/:memberId",
    projectController.removeMemberController
);

// Leave project
router.patch(
    "/:projectId/leave",
    projectController.leaveProjectController
);

/* -------------------------------------------------------------------------- */
/* NESTED ROUTES                                                              */
/* -------------------------------------------------------------------------- */

// Report a bug, idea or feedback ("general" when not in a project)
router.post(
    "/:projectId/issues",
    rateLimit({ windowMs: 60 * 60_000, max: 10, message: "Too many reports, try again later" }),
    projectController.reportIssueController,
);

// Project chats
router.use("/:projectId/chats", chatRoutes);

export default router;
