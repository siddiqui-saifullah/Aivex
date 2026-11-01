import { Router, type Router as ExpressRouter } from "express";
import * as githubController from "../controllers/github.controller.js";
import * as authMiddleware from "../middleware/auth.middleware.js";
import { rateLimit } from "../middleware/rateLimit.middleware.js";

const router: ExpressRouter = Router();

router.use(authMiddleware.authUser);

router.get("/github", githubController.status);
router.post("/github/ticket", rateLimit({ windowMs: 60_000, max: 10 }), githubController.ticket);
router.delete("/github", githubController.disconnect);
router.get("/github/repos", rateLimit({ windowMs: 60_000, max: 30 }), githubController.repos);
router.post("/github/import", rateLimit({ windowMs: 60_000, max: 5, message: "Too many imports, please wait a moment" }), githubController.importRepo);

export default router;
