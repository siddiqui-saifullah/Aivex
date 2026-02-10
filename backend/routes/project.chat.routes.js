import { Router } from "express";
import * as chatController from "../controllers/project.chat.controller.js";
import * as authMiddelWare from "../middleware/auth.middleware.js"

const router = Router({ mergeParams: true });

router.use(authMiddelWare.authUser);

router.get("/", chatController.getProjectChatsController);

export default router;