import { Router } from "express";
import * as userController from "../controllers/user.controller.js";
import * as authMiddleware from "../middleware/auth.middleware.js";
import * as authvalidator from "../validators/auth.validator.js";
import { validate } from "../middleware/validate.middleware.js";

const router = Router();


router.post("/register", authvalidator.registerValidator, validate, userController.createUserController);

router.post("/login", authvalidator.loginValidator, validate, userController.loginController);

router.get("/profile", authMiddleware.authUser, userController.profileController);

router.post("/logout", userController.logoutController);

router.get("/search", authMiddleware.authUser, userController.searchUserController)

// router.get("/all", authMiddleware.authUser, userController.getAllUsersController);  //will be used in dev/admin panel to moniter whole site

export default router;