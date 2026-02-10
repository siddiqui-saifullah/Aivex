import { Router } from "express";
import { body } from "express-validator";

import * as projectController from "../controllers/project.controller.js";
import * as authMiddleware from "../middleware/auth.middleware.js";
import {
    updateProjectFilesValidator,
    validate,
} from "../middleware/project.middleware.js";

import chatRoutes from "./project.chat.routes.js";

const router = Router();

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
        .custom((users) => users.every((u) => typeof u === "string"))
        .withMessage("Each user must be a string"),
    projectController.inviteUsersToProject
);

// Leave project
router.patch(
    "/:projectId/leave",
    projectController.leaveProjectController
);

/* -------------------------------------------------------------------------- */
/* NESTED ROUTES                                                              */
/* -------------------------------------------------------------------------- */

//Report Bug
router.post("/:projectId/issues", projectController.reportIssueController);

// Project chats
router.use("/:projectId/chats", chatRoutes);

export default router;
