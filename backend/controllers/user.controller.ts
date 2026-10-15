import catchAsync from "../utils/catchAsync.js";
import AppError from "../errors/AppError.js";
import * as userService from "../services/user.service.js";

/* -------------------------------------------------------------------------- */
/* REGISTER                                                                   */
/* -------------------------------------------------------------------------- */
export const createUserController = catchAsync(async (req, res) => {
    const user = await userService.createUser(req.body);
    const token = user.generateJWT();

    res.status(201).json({
        token,
        user: {
            _id: user._id,
            name: user.name,
            username: user.username,
        },
    });
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

    const user = await userService.userProfiler({
        userID: req.user!._id,
    });

    res.status(200).json({ user });
});

/* -------------------------------------------------------------------------- */
/* UPDATE PROFILE                                                             */
/* -------------------------------------------------------------------------- */
export const updateProfileController = catchAsync(async (req, res) => {
    const { name, username } = req.body;

    const user = await userService.updateProfile({
        userID: req.user!._id,
        name,
        username,
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
