import { Router, type Router as ExpressRouter } from "express";
import * as aiController from "../controllers/ai.controller.js";
import * as authMiddelWare from "../middleware/auth.middleware.js"
import { rateLimit } from "../middleware/rateLimit.middleware.js";

const router: ExpressRouter = Router();

router.use(authMiddelWare.authUser);

router.get("/result", aiController.getResultPoint);
router.get("/usage", aiController.usageController);

router.post("/enhance", rateLimit({ windowMs: 60_000, max: 20 }), aiController.enhancePromptController);

export default router;