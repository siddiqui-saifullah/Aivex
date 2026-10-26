import { Router, type Router as ExpressRouter } from "express";
import * as userController from "../controllers/user.controller.js";
import * as authMiddleware from "../middleware/auth.middleware.js";
import * as authvalidator from "../validators/auth.validator.js";
import { validate } from "../middleware/validate.middleware.js";
import { rateLimit } from "../middleware/rateLimit.middleware.js";

const router: ExpressRouter = Router();


// Password guessing: a few tries per account, and per IP across accounts
const loginLimits = [
    rateLimit({
        windowMs: 15 * 60_000,
        max: 10,
        key: (req) => `email:${String(req.body?.email ?? "").trim().toLowerCase()}`,
        message: "Too many login attempts for this account, try again in 15 minutes",
    }),
    rateLimit({ windowMs: 15 * 60_000, max: 50, key: (req) => `ip:${req.ip}`, message: "Too many login attempts, try again later" }),
];

router.post(
    "/register",
    rateLimit({ windowMs: 60 * 60_000, max: 10, key: (req) => `ip:${req.ip}`, message: "Too many sign-ups from this network, try again later" }),
    authvalidator.registerValidator,
    validate,
    userController.createUserController,
);

// Code checks are limited per email inside the service (5 wrong codes)
router.post(
    "/register/verify",
    rateLimit({ windowMs: 15 * 60_000, max: 30, key: (req) => `verify:${req.ip}`, message: "Too many attempts, try again later" }),
    authvalidator.verifySignupValidator,
    validate,
    userController.verifySignupController,
);

router.post(
    "/register/resend",
    rateLimit({ windowMs: 60 * 60_000, max: 10, key: (req) => `resend:${req.ip}`, message: "Too many codes requested, try again later" }),
    authvalidator.resendSignupValidator,
    validate,
    userController.resendSignupCodeController,
);

router.post("/login", ...loginLimits, authvalidator.loginValidator, validate, userController.loginController);

router.get("/profile", authMiddleware.authUser, userController.profileController);

router.patch("/profile", authMiddleware.authUser, authvalidator.updateProfileValidator, validate, userController.updateProfileController);

router.delete("/profile", authMiddleware.authUser, authvalidator.deleteAccountValidator, validate, userController.deleteAccountController);

router.patch(
    "/password",
    authMiddleware.authUser,
    rateLimit({ windowMs: 15 * 60_000, max: 10, message: "Too many attempts, try again in 15 minutes" }),
    authvalidator.changePasswordValidator,
    validate,
    userController.changePasswordController,
);

router.post("/logout", userController.logoutController);

router.get("/search", authMiddleware.authUser, userController.searchUserController)

// router.get("/all", authMiddleware.authUser, userController.getAllUsersController);  //will be used in dev/admin panel to moniter whole site

export default router;