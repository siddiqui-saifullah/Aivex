import { validationResult } from "express-validator";
import AppError from "../errors/AppError.js";

export const validate = (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        const message = errors.array().map(err => err.msg).join(", ");
        return next(new AppError(message, 400));
    }

    next();
};
