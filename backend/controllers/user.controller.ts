import catchAsync from "../utils/catchAsync.js";
import AppError from "../errors/AppError.js";
import * as userService from "../services/user.service.js";
import * as signupService from "../services/signup.service.js";
import { recordLogin } from "../services/activity.service.js";

/* -------------------------------------------------------------------------- */
/* REGISTER                                                                   */
/* -------------------------------------------------------------------------- */
const authResponse = (user: { _id: unknown; name: string; username: string; generateJWT(): string }) => ({
    token: user.generateJWT(),
    user: { _id: user._id, name: user.name, username: user.username },
});

/** Step 1: check the details and email a code (or create the account if email isn't set up). */
export const createUserController = catchAsync(async (req, res) => {
    const { name, username, email, password, website } = req.body;
    const result = await signupService.startSignup({ name, username, email, password, website });
    if (result.verificationRequired) {
        res.status(202).json({ verificationRequired: true, email: result.email });
        return;
    }
    recordLogin(result.user._id);
    res.status(201).json(authResponse(result.user));
});

/** Step 2: the emailed code creates the account. */
export const verifySignupController = catchAsync(async (req, res) => {
    const user = await signupService.verifySignup({ email: req.body.email, code: req.body.code });
    recordLogin(user._id);
    res.status(201).json(authResponse(user));
});

export const resendSignupCodeController = catchAsync(async (req, res) => {
    await signupService.resendSignupCode({ email: req.body.email });
    res.status(200).json({ message: "A new code is on its way" });
});

/* -------------------------------------------------------------------------- */
/* LOGIN                                                                      */
/* -------------------------------------------------------------------------- */
export const loginController = catchAsync(async (req, res) => {

    const { email, password } = req.body;

    const { user, token } = await userService.loginUser({
        email,
        password,
    });
    recordLogin(user._id);

    res.status(200).json({
        token,
        user: {
            _id: user._id,
            name: user.name,
            username: user.username,
        },
    });
});

/* -------------------------------------------------------------------------- */
/* PROFILE                                                                    */
/* -------------------------------------------------------------------------- */
export const profileController = catchAsync(async (req, res) => {
    if (!req.user?._id) {
        throw new AppError("Unauthorized", 401);
    }

    const [user, activity] = await Promise.all([
        userService.userProfiler({ userID: req.user!._id }),
        userService.userProfileStats({ userID: req.user!._id }),
    ]);

    res.status(200).json({ user, ...activity });
});

/* -------------------------------------------------------------------------- */
/* UPDATE PROFILE                                                             */
/* -------------------------------------------------------------------------- */
export const updateProfileController = catchAsync(async (req, res) => {
    const { name, username, bio, teachingMode } = req.body;

    const user = await userService.updateProfile({
        userID: req.user!._id,
        name,
        username,
        bio,
        teachingMode,
    });

    res.status(200).json({ user });
});

/* -------------------------------------------------------------------------- */
/* CHANGE PASSWORD                                                            */
/* -------------------------------------------------------------------------- */
export const changePasswordController = catchAsync(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    await userService.changePassword({
        userID: req.user!._id,
        currentPassword,
        newPassword,
    });

    res.status(200).json({ message: "Password updated successfully" });
});

/* -------------------------------------------------------------------------- */
/* DELETE ACCOUNT                                                             */
/* -------------------------------------------------------------------------- */
export const deleteAccountController = catchAsync(async (req, res) => {
    await userService.deleteAccount({
        userID: req.user!._id,
        password: req.body.password,
    });

    const token = userService.getRequestToken(req);
    if (token) await userService.revokeToken(token);
    res.clearCookie("token");

    res.status(200).json({ message: "Account deleted" });
});

/* -------------------------------------------------------------------------- */
/* LOGOUT                                                                     */
/* -------------------------------------------------------------------------- */
export const logoutController = catchAsync(async (req, res) => {
    await userService.logoutUser(req);
    res.clearCookie("token");

    res.status(200).json({
        message: "Logged out successfully",
    });
});

/* -------------------------------------------------------------------------- */
/* SEARCH USERS                                                               */
/* -------------------------------------------------------------------------- */
export const searchUserController = catchAsync(async (req, res) => {
    if (!req.user?._id) {
        throw new AppError("Unauthorized", 401);
    }

    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

    if (q.length < 2) {
        return res.status(200).json({
            success: true,
            users: [],
        });
    }

    const users = await userService.searchUser({
        q,
        loggedInUserId: req.user!._id,
    });

    res.status(200).json({
        success: true,
        count: users.length,
        users,
    });
});
