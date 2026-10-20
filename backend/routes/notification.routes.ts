import { Router, type Router as ExpressRouter } from "express";
import * as notificationController from "../controllers/notification.controller.js";
import * as authMiddleware from "../middleware/auth.middleware.js";

const router: ExpressRouter = Router();

router.use(authMiddleware.authUser);

router.get("/", notificationController.listNotifications);
// Without ids: mark everything as read
router.patch("/read", notificationController.markRead);
router.delete("/", notificationController.clearNotifications);

export default router;
