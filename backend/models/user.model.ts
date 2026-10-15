import mongoose, { type HydratedDocument, type Model } from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

export interface IUser {
    name: string;
    username: string;
    email: string;
    password: string;
    bio: string;
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
        }

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

const User = mongoose.model<IUser, UserModel>('User', userSchema);

export default User;
