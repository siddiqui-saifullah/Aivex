import userModel from "../models/user.model.js";
import AppError from "../errors/AppError.js";
import redisClient from "../services/redis.service.js";
import jwt from "jsonwebtoken";

/* -------------------------------------------------------------------------- */
/* CREATE USER                                                                */
/* -------------------------------------------------------------------------- */
export const createUser = async ({ name, username, email, password }) => {
    if (!name || !username || !email || !password) {
        throw new AppError("All fields are required", 400);
    }

    const hashedPassword = await userModel.hashPassword(password);

    return userModel.create({
        name,
        username,
        email,
        password: hashedPassword,
    });
};

/* -------------------------------------------------------------------------- */
/* LOGIN USER                                                                 */
/* -------------------------------------------------------------------------- */
export const loginUser = async ({ email, password }) => {
    const user = await userModel.findOne({ email }).select("+password");

    if (!user) {
        throw new AppError("Invalid credentials", 401);
    }

    const isMatch = await user.isValidPassword(password);

    if (!isMatch) {
        throw new AppError("Invalid credentials", 401);
    }

    const token = user.generateJWT();

    return { user, token };
};

/* -------------------------------------------------------------------------- */
/* PROFILE                                                                    */
/* -------------------------------------------------------------------------- */
export const userProfiler = async ({ userID }) => {
    return userModel
        .findById(userID)
        .select("name username email createdAt updatedAt")
        .lean();
};

/* -------------------------------------------------------------------------- */
/* LOGOUT                                                                     */
/* -------------------------------------------------------------------------- */
export const logoutUser = async (req) => {
    const authHeader = req.headers.authorization;
    const tokenFromHeader =
        authHeader && authHeader.startsWith("Bearer ")
            ? authHeader.split(" ")[1]
            : null;

    const token = req.cookies?.token || tokenFromHeader;

    if (!token) {
        throw new AppError("Token not provided", 401);
    }

    const decoded = jwt.decode(token);
    const ttl = decoded?.exp
        ? decoded.exp - Math.floor(Date.now() / 1000)
        : 24 * 60 * 60;

    if (ttl > 0) {
        await redisClient.set(token, "logout", { EX: ttl });
    }
};

/* -------------------------------------------------------------------------- */
/* SEARCH USERS                                                               */
/* -------------------------------------------------------------------------- */
export const searchUser = async ({ q, loggedInUserId }) => {
    if (!q) return [];

    return userModel
        .find({
            _id: { $ne: loggedInUserId },
            $or: [
                { username: { $regex: q, $options: "i" } },
                { name: { $regex: q, $options: "i" } },
            ],
        })
        .limit(20)
        .select("_id name username")
        .lean();
};
