import type { NextFunction, Request, Response } from "express";
import type { Types } from "mongoose";
import userModel from "../models/user.model.js";

/** Admins are listed by email in ADMIN_EMAILS (comma separated). */
const adminEmails = () =>
    new Set(
        (process.env.ADMIN_EMAILS ?? "")
            .split(",")
            .map((e) => e.trim().toLowerCase())
            .filter(Boolean),
    );

export const isAdminEmail = (email: string) => adminEmails().has(email.toLowerCase());

export const isAdminUser = async (userId: Types.ObjectId | string) => {
    const emails = adminEmails();
    if (emails.size === 0) return false;
    const user = await userModel.findById(userId).select("email").lean();
    return !!user && emails.has(user.email.toLowerCase());
};

/** Use after authUser. Non-admins get a 404 so the area isn't advertised. */
export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (req.user && await isAdminUser(req.user._id)) return next();
    } catch {
        /* fall through */
    }
    res.status(404).json({ message: "Not found" });
};
