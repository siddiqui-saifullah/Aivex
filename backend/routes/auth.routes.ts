import { Router, type Router as ExpressRouter } from "express";
import * as authController from "../controllers/auth.controller.js";
import { rateLimit } from "../middleware/rateLimit.middleware.js";

const router: ExpressRouter = Router();

const limit = rateLimit({ windowMs: 15 * 60_000, max: 30, key: (req) => `oauth:${req.ip}`, message: "Too many sign-in attempts, try again later" });

router.get("/providers", authController.providers);
router.post("/exchange", limit, authController.exchange);
// Connecting GitHub for pushes (before the generic provider routes)
router.get("/github/connect", limit, authController.githubConnectStart);
router.get("/github/callback/connect", authController.githubConnectCallback);
router.get("/:provider", limit, authController.start);
router.get("/:provider/callback", authController.callback);

export default router;
