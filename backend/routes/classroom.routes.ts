import { Router, type Router as ExpressRouter } from "express";
import * as classroomController from "../controllers/classroom.controller.js";
import * as authMiddleware from "../middleware/auth.middleware.js";
import { rateLimit } from "../middleware/rateLimit.middleware.js";

const router: ExpressRouter = Router();

router.use(authMiddleware.authUser);

router.post("/", rateLimit({ windowMs: 60_000, max: 10 }), classroomController.createClassroom);
router.get("/", classroomController.listClassrooms);
// Join codes are short: limit guessing
router.post("/join", rateLimit({ windowMs: 60_000, max: 15 }), classroomController.joinClassroom);
router.get("/:classroomId", classroomController.getClassroom);
router.patch("/:classroomId", rateLimit({ windowMs: 60_000, max: 30 }), classroomController.updateClassroom);
router.delete("/:classroomId", classroomController.deleteClassroom);

export default router;
