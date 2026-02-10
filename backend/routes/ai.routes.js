import { Router } from "express";
import * as aiController from "../controllers/ai.controller.js";
import * as authMiddelWare from "../middleware/auth.middleware.js"

const router = Router();

router.use(authMiddelWare.authUser);

router.get("/result", aiController.getResultPoint);

export default router;