import { Router, type Router as ExpressRouter } from "express";
import * as runnerController from "../controllers/runner.controller.js";
import { authUser } from "../middleware/auth.middleware.js";
import { rateLimit } from "../middleware/rateLimit.middleware.js";

const router: ExpressRouter = Router();

router.use(authUser);

router.get("/languages", runnerController.getLanguagesController);

// 20 runs per user per minute
router.post("/", rateLimit({ windowMs: 60_000, max: 20 }), runnerController.runCodeController);

export default router;
