import { Router, type Router as ExpressRouter } from "express";
import * as assignmentController from "../controllers/assignment.controller.js";
import * as authMiddleware from "../middleware/auth.middleware.js";
import { rateLimit } from "../middleware/rateLimit.middleware.js";

const router: ExpressRouter = Router();

router.use(authMiddleware.authUser);

router.get("/:submissionId", assignmentController.getSubmission);
router.patch("/:submissionId/review", rateLimit({ windowMs: 60_000, max: 60 }), assignmentController.reviewSubmission);

export default router;
