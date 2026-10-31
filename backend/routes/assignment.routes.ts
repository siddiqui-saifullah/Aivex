import { Router, type Router as ExpressRouter } from "express";
import * as assignmentController from "../controllers/assignment.controller.js";
import * as authMiddleware from "../middleware/auth.middleware.js";
import { rateLimit } from "../middleware/rateLimit.middleware.js";

const router: ExpressRouter = Router();

router.use(authMiddleware.authUser);

router.get("/:assignmentId", assignmentController.getAssignment);
router.post("/:assignmentId/start", rateLimit({ windowMs: 60_000, max: 20 }), assignmentController.startAssignment);
router.patch("/:assignmentId", rateLimit({ windowMs: 60_000, max: 30 }), assignmentController.updateAssignment);
router.delete("/:assignmentId", assignmentController.deleteAssignment);

export default router;
