import type { NextFunction, Request, Response } from "express";
import { body, validationResult } from "express-validator";

export const updateProjectFilesValidator = [
    body("fileTree")
        .exists().withMessage("fileTree is required")
        .isObject().withMessage("fileTree must be an object")
        .custom(v => Object.keys(v).length > 0)
        .withMessage("fileTree cannot be empty"),
];




export const validate = (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};
