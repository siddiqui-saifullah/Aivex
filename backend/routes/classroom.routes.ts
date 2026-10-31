import { Router, type Router as ExpressRouter } from "express";
import * as classroomController from "../controllers/classroom.controller.js";
import * as assignmentController from "../controllers/assignment.controller.js";
import * as authMiddleware from "../middleware/auth.middleware.js";
import { rateLimit } from "../middleware/rateLimit.middleware.js";

const router: ExpressRouter = Router();

router.use(authMiddleware.authUser);

router.post("/", rateLimit({ windowMs: 60_000, max: 10 }), classroomController.createClassroom);
router.get("/", classroomController.listClassrooms);
// Join codes are short: limit guessing
router.post("/join", rateLimit({ windowMs: 60_000, max: 15 }), classroomController.joinClassroom);
router.post("/help", rateLimit({ windowMs: 60 * 60_000, max: 20 }), classroomController.requestHelp);
router.patch("/help/:requestId/resolve", classroomController.resolveHelpRequest);
router.get("/:classroomId", classroomController.getClassroom);
router.patch("/:classroomId", rateLimit({ windowMs: 60_000, max: 30 }), classroomController.updateClassroom);
router.delete("/:classroomId", classroomController.deleteClassroom);
router.post("/:classroomId/leave", classroomController.leaveClassroom);
router.delete("/:classroomId/students/:studentId", classroomController.removeStudent);
router.get("/:classroomId/assignments", assignmentController.listAssignments);
router.get("/:classroomId/help", classroomController.listHelpRequests);
router.post("/:classroomId/assignments", rateLimit({ windowMs: 60_000, max: 20 }), assignmentController.createAssignment);

export default router;
