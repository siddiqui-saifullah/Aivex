import { Router, type Router as ExpressRouter } from "express";
import * as adminController from "../controllers/admin.controller.js";
import * as authMiddleware from "../middleware/auth.middleware.js";
import { requireAdmin } from "../middleware/admin.middleware.js";
import * as reportController from "../controllers/report.controller.js";

const router: ExpressRouter = Router();

router.use(authMiddleware.authUser, requireAdmin);

router.get("/me", adminController.me);
router.get("/overview", adminController.overview);
router.get("/users", adminController.users);
router.get("/projects", adminController.projects);

// Bug reports and feedback
router.get("/issues", reportController.listIssues);
router.patch("/issues/:issueId", reportController.updateIssue);

// Abuse reports and moderation
router.get("/reports", reportController.listReports);
router.patch("/reports/:reportId", reportController.resolveReport);
router.patch("/users/:userId/suspension", reportController.setSuspension);

export default router;
