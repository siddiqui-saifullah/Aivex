import { Router, type Router as ExpressRouter } from "express";
import * as runnerController from "../controllers/runner.controller.js";
import { authUser } from "../middleware/auth.middleware.js";
import { rateLimit } from "../middleware/rateLimit.middleware.js";
import { runLimiter } from "../services/runner.service.js";

const router: ExpressRouter = Router();

router.use(authUser);

router.get("/languages", runnerController.getLanguagesController);

router.post("/", rateLimit(runLimiter), runnerController.runCodeController);

export default router;
