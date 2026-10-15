import type { Request } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import type { Types } from "mongoose";
import userModel from "../models/user.model.js";
import Project from "../models/project.model.js";
import * as chatService from "../services/chats.service.js";
import AppError from "../errors/AppError.js";
import redisClient from "../services/redis.service.js";

interface MongoDuplicateKeyError {
    code?: number;
    keyPattern?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/* CREATE USER                                                                */
/* -------------------------------------------------------------------------- */
export const createUser = async ({ name, username, email, password }: {
    name?: string;
    username?: string;
    email?: string;
    password?: string;
}) => {
    if (!name || !username || !email || !password) {
        throw new AppError("All fields are required", 400);
    }

    try {
        const hashedPassword = await userModel.hashPassword(password);

        return await userModel.create({
            name,
            username,
            email,
            password: hashedPassword,
        });

    } catch (error) {
        const dupError = error as MongoDuplicateKeyError;
        if (dupError.code === 11000) {
            if (dupError.keyPattern?.email) {
                throw new AppError("Email is already registered", 400);
            }
            if (dupError.keyPattern?.username) {
                throw new AppError("Username is already taken", 400);
            }
        }
        // Throw other errors as they are
        throw error;
    }
};

/* -------------------------------------------------------------------------- */
/* LOGIN USER                                                                 */
/* -------------------------------------------------------------------------- */
export const loginUser = async ({ email, password }: { email: string; password: string }) => {
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
export const userProfiler = async ({ userID }: { userID: Types.ObjectId | string }) => {
    return userModel.findById(userID)
        .select("name username email createdAt updatedAt")
        .lean();
};

/* -------------------------------------------------------------------------- */
/* UPDATE PROFILE                                                             */
/* -------------------------------------------------------------------------- */
export const updateProfile = async ({ userID, name, username }: {
    userID: Types.ObjectId | string;
    name?: string;
    username?: string;
}) => {
    const updates: { name?: string; username?: string } = {};
    if (name !== undefined) updates.name = name;
    if (username !== undefined) updates.username = username;

    if (Object.keys(updates).length === 0) {
        throw new AppError("Nothing to update", 400);
    }

    try {
        const user = await userModel.findByIdAndUpdate(userID, updates, {
            new: true,
            runValidators: true,
        })
            .select("name username email createdAt updatedAt")
            .lean();

        if (!user) throw new AppError("User not found", 404);
        return user;
    } catch (error) {
        if ((error as MongoDuplicateKeyError).code === 11000) {
            throw new AppError("Username is already taken", 400);
        }
        throw error;
    }
};

/* -------------------------------------------------------------------------- */
/* CHANGE PASSWORD                                                            */
/* -------------------------------------------------------------------------- */
export const changePassword = async ({ userID, currentPassword, newPassword }: {
    userID: Types.ObjectId | string;
    currentPassword: string;
    newPassword: string;
}) => {
    const user = await userModel.findById(userID).select("+password");
    if (!user) throw new AppError("User not found", 404);

    if (!(await user.isValidPassword(currentPassword))) {
        throw new AppError("Current password is incorrect", 400);
    }

    if (currentPassword === newPassword) {
        throw new AppError("New password must be different", 400);
    }

    user.password = await userModel.hashPassword(newPassword);
    await user.save();
};

/* -------------------------------------------------------------------------- */
/* DELETE ACCOUNT                                                             */
/* -------------------------------------------------------------------------- */
/**
 * Deletes the user, every project they own (with its chats) and removes
 * them from projects they were invited to.
 */
export const deleteAccount = async ({ userID, password }: {
    userID: Types.ObjectId | string;
    password: string;
}) => {
    const user = await userModel.findById(userID).select("+password");
    if (!user) throw new AppError("User not found", 404);

    if (!(await user.isValidPassword(password))) {
        throw new AppError("Password is incorrect", 400);
    }

    const ownedProjects = await Project.find({ owner: user._id }).select("_id").lean();
    for (const project of ownedProjects) {
        await chatService.deleteChatsByProjectId({ projectId: project._id });
    }
    await Project.deleteMany({ owner: user._id });
    await Project.updateMany({ users: user._id }, { $pull: { users: user._id } });

    await user.deleteOne();

    return { deletedProjects: ownedProjects.map(p => String(p._id)) };
};

/* -------------------------------------------------------------------------- */
/* TOKEN HELPERS                                                              */
/* -------------------------------------------------------------------------- */
export const getRequestToken = (req: Request): string | null => {
    const authHeader = req.headers.authorization;
    const tokenFromHeader =
        authHeader && authHeader.startsWith("Bearer ")
            ? authHeader.split(" ")[1]
            : null;

    return req.cookies?.token || tokenFromHeader;
};

/** Blacklist a token in Redis until it would have expired anyway. */
export const revokeToken = async (token: string) => {
    const decoded = jwt.decode(token) as JwtPayload | null;
    const ttl = decoded?.exp
        ? decoded.exp - Math.floor(Date.now() / 1000)
        : 24 * 60 * 60;

    if (ttl > 0) {
        // ioredis takes the expiry as positional args ("EX", seconds)
        await redisClient.set(token, "logout", "EX", ttl);
    }
};

/* -------------------------------------------------------------------------- */
/* LOGOUT                                                                     */
/* -------------------------------------------------------------------------- */
export const logoutUser = async (req: Request) => {
    const token = getRequestToken(req);

    if (!token) {
        throw new AppError("Token not provided", 401);
    }

    await revokeToken(token);
};

/* -------------------------------------------------------------------------- */
/* SEARCH USERS                                                               */
/* -------------------------------------------------------------------------- */
export const searchUser = async ({ q, loggedInUserId }: {
    q: string;
    loggedInUserId: Types.ObjectId | string;
}) => {
    if (!q) return [];

    const sanitizedQuery = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return userModel
        .find({
            _id: { $ne: loggedInUserId },
            $or: [
                { username: { $regex: sanitizedQuery, $options: "i" } },
                { name: { $regex: sanitizedQuery, $options: "i" } },
            ],
        })
        .limit(20)
        .select("_id name username")
        .lean();
};
