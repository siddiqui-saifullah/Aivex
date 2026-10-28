import { Router, type Router as ExpressRouter } from "express";
import * as reportController from "../controllers/report.controller.js";
import { authUser } from "../middleware/auth.middleware.js";
import { rateLimit } from "../middleware/rateLimit.middleware.js";

const router: ExpressRouter = Router();

router.use(authUser);

// Report a user, project or chat message for abuse
router.post(
    "/",
    rateLimit({ windowMs: 60 * 60_000, max: 20, message: "Too many reports, try again later" }),
    reportController.createReport,
);

export default router;
