import type { Request } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import type { Types } from "mongoose";
import userModel from "../models/user.model.js";
import Project from "../models/project.model.js";
import * as chatService from "../services/chats.service.js";
import ChatMessage from "../models/chat.model.js";
import AppError from "../errors/AppError.js";
import redisClient from "../services/redis.service.js";
import crypto from "node:crypto";
import { assertNameAllowed, assertUsernameAllowed, canonicalEmail } from "../utils/spamFilter.js";

interface MongoDuplicateKeyError {
    code?: number;
    keyPattern?: Record<string, unknown>;
}

/* -------------------------------------------------------------------------- */
/* CREATE USER                                                                */
/* -------------------------------------------------------------------------- */
/** 400 if the email (or another alias of the same mailbox) or username is taken. */
export const assertAccountAvailable = async ({ email, username }: { email: string; username?: string }) => {
    const address = email.trim().toLowerCase();
    const canonical = canonicalEmail(address);
    if (await userModel.exists({ $or: [{ email: address }, { email: canonical }, { emailCanonical: canonical }] })) {
        throw new AppError("Email is already registered", 400);
    }
    if (username && (await userModel.exists({ username: username.trim().toLowerCase() }))) {
        throw new AppError("Username is already taken", 400);
    }
};

/**
 * Create an account. Pass `password` (plain) or `passwordHash` (an email
 * sign-up hashes it before sending the code); OAuth accounts pass neither.
 */
export const createUser = async ({ name, username, email, password, passwordHash, googleId, githubId }: {
    name?: string;
    username?: string;
    email?: string;
    password?: string;
    passwordHash?: string;
    googleId?: string;
    githubId?: string;
}) => {
    const oauth = Boolean(googleId || githubId);
    if (!name || !username || !email || (!password && !passwordHash && !oauth)) {
        throw new AppError("All fields are required", 400);
    }

    try {
        const hasPassword = Boolean(password || passwordHash);
        // OAuth accounts get an unusable random password until they set one
        const hashed = passwordHash ?? (await userModel.hashPassword(password ?? crypto.randomBytes(32).toString("hex")));

        return await userModel.create({
            name,
            username,
            email,
            emailCanonical: canonicalEmail(email),
            password: hashed,
            hasPassword,
            googleId,
            githubId,
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

/** Accounts created before emailCanonical existed get it filled in once (at startup). */
export const backfillCanonicalEmails = async () => {
    const users = await userModel.find({ emailCanonical: { $exists: false } }).select("_id email").lean();
    if (users.length === 0) return;
    await userModel.bulkWrite(
        users.map((u) => ({
            updateOne: { filter: { _id: u._id }, update: { $set: { emailCanonical: canonicalEmail(u.email) } } },
        })),
    );
    console.log(`Filled in emailCanonical for ${users.length} accounts`);
};

/* -------------------------------------------------------------------------- */
/* LOGIN USER                                                                 */
/* -------------------------------------------------------------------------- */
export const loginUser = async ({ email, password }: { email: string; password: string }) => {
    const user = await userModel.findOne({ email }).select("+password");

    if (!user) {
        throw new AppError("Invalid credentials", 401);
    }
    if (user.suspendedAt) {
        throw new AppError("This account has been suspended. Contact support if you think this is a mistake", 403);
    }
    if (user.hasPassword === false) {
        throw new AppError("This account signs in with Google or GitHub. Use that button, or set a password from your profile", 401);
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
        .select("name username email bio teachingMode hasPassword createdAt updatedAt")
        .lean();
};

/** Activity numbers and recent projects shown on the profile page. */
export const userProfileStats = async ({ userID }: { userID: Types.ObjectId | string }) => {
    const id = String(userID);

    const [projects, messagesSent] = await Promise.all([
        Project.find({ users: userID })
            .select("_id name stack owner users updatedAt")
            .sort({ updatedAt: -1 })
            .lean(),
        ChatMessage.countDocuments({ sender: userID }),
    ]);

    const collaborators = new Set<string>();
    let projectsOwned = 0;

    for (const project of projects) {
        if (String(project.owner) === id) projectsOwned++;
        for (const member of project.users) {
            if (String(member) !== id) collaborators.add(String(member));
        }
    }

    return {
        stats: {
            projectsOwned,
            projectsJoined: projects.length - projectsOwned,
            collaborators: collaborators.size,
            messagesSent,
        },
        recentProjects: projects.slice(0, 5).map(p => ({
            _id: p._id,
            name: p.name,
            stack: p.stack,
            updatedAt: p.updatedAt,
            usersCount: p.users.length,
            isOwner: String(p.owner) === id,
        })),
    };
};

/* -------------------------------------------------------------------------- */
/* UPDATE PROFILE                                                             */
/* -------------------------------------------------------------------------- */
export const updateProfile = async ({ userID, name, username, bio, teachingMode }: {
    userID: Types.ObjectId | string;
    name?: string;
    username?: string;
    bio?: string;
    teachingMode?: unknown;
}) => {
    const updates: { name?: string; username?: string; bio?: string; teachingMode?: boolean } = {};
    if (name !== undefined) updates.name = name;
    if (username !== undefined) updates.username = username;
    if (bio !== undefined) updates.bio = bio;
    if (teachingMode !== undefined) {
        if (typeof teachingMode !== "boolean") throw new AppError("teachingMode must be true or false", 400);
        updates.teachingMode = teachingMode;
    }

    if (Object.keys(updates).length === 0) {
        throw new AppError("Nothing to update", 400);
    }

    // Spam checks only for what actually changes (old accounts keep their names)
    const current = await userModel.findById(userID).select("name username").lean();
    if (updates.username !== undefined && updates.username !== current?.username) assertUsernameAllowed(updates.username);
    if (updates.name !== undefined && updates.name !== current?.name) assertNameAllowed(updates.name);

    try {
        // Update, then read back (FerretDB, used locally, can't project in findAndModify)
        await userModel.updateOne({ _id: userID }, updates, { runValidators: true });
        const user = await userModel.findById(userID)
            .select("name username email bio teachingMode hasPassword createdAt updatedAt")
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
    currentPassword?: string;
    newPassword: string;
}) => {
    const user = await userModel.findById(userID).select("+password");
    if (!user) throw new AppError("User not found", 404);

    // Google/GitHub accounts set their first password without a current one
    if (user.hasPassword !== false) {
        if (!currentPassword || !(await user.isValidPassword(currentPassword))) {
            throw new AppError("Current password is incorrect", 400);
        }
        if (currentPassword === newPassword) {
            throw new AppError("New password must be different", 400);
        }
    }

    user.password = await userModel.hashPassword(newPassword);
    user.hasPassword = true;
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
    password?: string;
}) => {
    const user = await userModel.findById(userID).select("+password");
    if (!user) throw new AppError("User not found", 404);

    // Accounts without a password (Google/GitHub) confirm with their session
    if (user.hasPassword !== false && (!password || !(await user.isValidPassword(password)))) {
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
