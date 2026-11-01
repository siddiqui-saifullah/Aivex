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
router.post("/:assignmentId/submit", rateLimit({ windowMs: 60_000, max: 10 }), assignmentController.submitAssignment);
router.get("/:assignmentId/submissions", assignmentController.listSubmissions);
router.get("/:assignmentId/similarity", rateLimit({ windowMs: 60_000, max: 10 }), assignmentController.getSimilarity);
router.get("/:assignmentId/similarity/compare", assignmentController.compareSubmissions);
router.get("/:assignmentId/journey/:studentId", assignmentController.getJourney);
router.get("/:assignmentId/journey/:studentId/snapshots/:eventId", assignmentController.getJourneySnapshot);

export default router;
