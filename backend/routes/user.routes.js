import { Router } from "express";
import * as userController from "../controllers/user.controller.js";
import { body } from "express-validator";
import * as authMiddleware from "../middleware/auth.middleware.js";

const router = Router();


router.post("/register",
    body("email").isEmail().withMessage("Email must be a valid address"),
    body("password").isLength({ min: 3 }).withMessage("Password must be at least 3 charecters long"),
    userController.createUserController);

router.post("/login",
    body("email").isEmail().withMessage("EMail must be valid address"),
    body("password").isLength({ min: 3 }).withMessage("Password must be at least 3 charecters long"),
    userController.loginController);

router.get("/profile", authMiddleware.authUser, userController.profileController);

router.post("/logout", userController.logoutController);

// router.get("/all", authMiddleware.authUser, userController.getAllUsersController);  //will be used in dev/admin panel to moniter whole site

router.get("/search", authMiddleware.authUser, userController.searchUserController)

export default router;