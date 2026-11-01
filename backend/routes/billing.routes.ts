import { Router, type Router as ExpressRouter } from "express";
import * as billingController from "../controllers/billing.controller.js";
import * as authMiddleware from "../middleware/auth.middleware.js";
import { rateLimit } from "../middleware/rateLimit.middleware.js";

const router: ExpressRouter = Router();

router.get("/plans", billingController.getPlans);

router.use(authMiddleware.authUser);
router.get("/me", billingController.getMine);
router.post("/checkout", rateLimit({ windowMs: 60_000, max: 10, message: "Too many attempts, please wait a moment" }), billingController.createCheckout);
router.post("/verify", rateLimit({ windowMs: 60_000, max: 20, message: "Too many attempts, please wait a moment" }), billingController.verifyPayment);

export default router;
