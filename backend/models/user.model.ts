import mongoose, { type HydratedDocument, type Model, type Types } from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

export interface IUser {
    name: string;
    username: string;
    email: string;
    password: string;
    /** False for accounts created with Google/GitHub until they set a password. */
    hasPassword: boolean;
    /** Email with Gmail dots and +tags removed: one account per real mailbox. */
    emailCanonical: string;
    googleId?: string;
    githubId?: string;
    /** Set by an admin after abuse reports: the account can't sign in. */
    suspendedAt: Date | null;
    suspendedReason: string;
    bio: string;
    /** Shows teaching tools (create classes, assignments) on the dashboard. */
    teachingMode: boolean;
    /** Usage tracking (admin dashboard). */
    lastActiveAt: Date | null;
    lastLoginAt: Date | null;
    loginCount: number;
    lastProject: { project: Types.ObjectId; name: string; at: Date } | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface IUserMethods {
    isValidPassword(password: string): Promise<boolean>;
    generateJWT(): string;
}

export interface UserModel extends Model<IUser, object, IUserMethods> {
    hashPassword(password: string): Promise<string>;
}

export type UserDocument = HydratedDocument<IUser, IUserMethods>;

const userSchema = new mongoose.Schema<IUser, UserModel, IUserMethods>(
    {
        name: {
            type: String,
            required: [true, "Name is required"],
            trim: true,
            minlength: [3, "Name must be at least 3 characters"],
            maxlength: [50, "Name must be less than 50 characters"],
            match: [/^[a-zA-Z ]+$/, "Name can contain only letters and spaces"]
        },
        username: {
            type: String,
            required: [true, "Username is required"],
            unique: true,
            lowercase: true,
            trim: true,
            minlength: [3, "Username must be at least 3 characters"],
            maxlength: [30, "Username must be at most 30 characters"],
            match: [/^[a-z0-9_]+$/, "Username can contain lowercase letters, numbers, and underscores"],
            index: true
        },
        email: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
            minlength: [6, "Email must be at least 6 characters long"],
            maxlength: [254, "Email must be less than 254 characters"],
        },
        emailCanonical: { type: String, lowercase: true, trim: true, index: true },
        hasPassword: { type: Boolean, default: true },
        googleId: { type: String, index: { unique: true, sparse: true } },
        suspendedAt: { type: Date, default: null },
        suspendedReason: { type: String, default: "", maxlength: 300 },
        githubId: { type: String, index: { unique: true, sparse: true } },
        teachingMode: { type: Boolean, default: false },
        bio: {
            type: String,
            trim: true,
            default: "",
            maxlength: [160, "Bio must be at most 160 characters"],
        },
        password: {
            type: String,
            select: false,
            required: true,
            minlength: [8, "Password must be at least 8 characters"],
        },

        lastActiveAt: { type: Date, default: null },
        lastLoginAt: { type: Date, default: null },
        loginCount: { type: Number, default: 0 },
        lastProject: {
            type: {
                project: { type: mongoose.Schema.Types.ObjectId, ref: "Project" },
                name: String,
                at: Date,
            },
            default: null,
            _id: false,
        },

    },
    { timestamps: true }

);

userSchema.static("hashPassword", async function (password: string) {
    return await bcrypt.hash(password, 10);
});

userSchema.method("isValidPassword", async function (password: string) {
    return await bcrypt.compare(password, this.password);
});

userSchema.method("generateJWT", function () {
    return jwt.sign(
        { userId: this._id },
        process.env.JWT_SECRET as string,
        { expiresIn: "7d" }
    );
});

userSchema.index({ lastActiveAt: -1 });

const User = mongoose.model<IUser, UserModel>('User', userSchema);

export default User;
