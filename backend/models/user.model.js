import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Name is required"],
            trim: true,
            minlength: [2, "Name must be at least 2 characters"],
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
            maxlength: [20, "Username must be at most 20 characters"],
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
        password: {
            type: String,
            select: false,
            required: true,
            minlength: [3, "Password must be at least 3 characters"],
        }

    },
    { timestamps: true }

);

userSchema.statics.hashPassword = async function (password) {
    return await bcrypt.hash(password, 10);
}

userSchema.methods.isValidPassword = async function (password) {
    return await bcrypt.compare(password, this.password);
}

userSchema.methods.generateJWT = function () {
    return jwt.sign(
        { userId: this._id },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
    );
}

const User = mongoose.model('User', userSchema);

export default User;