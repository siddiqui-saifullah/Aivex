import type { ErrorRequestHandler } from "express";
import mongoose from "mongoose";

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
    if (err.isOperational) {
        res.status(err.statusCode).json({
            message: err.message,
        });
        return;
    }

    // Malformed ObjectIds in params/body (e.g. /projects/not-an-id)
    if (err instanceof mongoose.Error.CastError) {
        res.status(400).json({ message: `Invalid ${err.path}` });
        return;
    }

    // Client errors raised by body-parser (invalid JSON, payload too large, ...)
    const status = err.status ?? err.statusCode;
    if (typeof status === "number" && status >= 400 && status < 500) {
        res.status(status).json({ message: err.message });
        return;
    }

    console.error(err);
    res.status(500).json({
        message: "Internal Server Error",
    });
};
