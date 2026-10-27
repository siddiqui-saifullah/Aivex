import { body } from "express-validator";

export const registerValidator = [
    body("name")
        .trim()
        .notEmpty()
        .withMessage("Name is required")
        .bail()
        .isLength({ min: 3, max: 50 })
        .withMessage("Name must be between 3 and 50 characters")
        .bail()
        .matches(/^[A-Za-z ]+$/)
        .withMessage("Name must contain only letters and spaces"),

    body("username")
        .trim()
        .notEmpty()
        .withMessage("Username is required")
        .bail()
        .isLength({ min: 3, max: 20 })
        .withMessage("Username must be between 3 and 20 characters")
        .bail()
        .toLowerCase()
        .matches(/^[a-z0-9_]+$/)
        .withMessage("Invalid Username"),

    body("email")
        .trim()
        .notEmpty()
        .withMessage("Email is required")
        .bail()
        .isEmail()
        .withMessage("Invalid email format")
        .bail()
        .isLength({ max: 254 })
        .withMessage("Email is too long"),

    body("password")
        .notEmpty()
        .withMessage("Password is required")
        .bail()
        .isLength({ min: 8, max: 128 })
        .withMessage("Password must be between 8 and 128 characters"),
];


export const verifySignupValidator = [
    body("email").trim().isEmail().withMessage("Email must be a valid address"),
    body("code").trim().matches(/^\d{6}$/).withMessage("Enter the 6-digit code from the email"),
];

export const resendSignupValidator = [
    body("email").trim().isEmail().withMessage("Email must be a valid address"),
];

export const loginValidator = [
    body("email").isEmail().withMessage("Email must be valid address"),
    body("password").isString().withMessage("Password is required").bail().notEmpty().withMessage("Password is required"),
]


export const updateProfileValidator = [
    body("name")
        .optional()
        .trim()
        .isLength({ min: 3, max: 50 })
        .withMessage("Name must be between 3 and 50 characters")
        .bail()
        .matches(/^[A-Za-z ]+$/)
        .withMessage("Name must contain only letters and spaces"),

    body("username")
        .optional()
        .trim()
        .isLength({ min: 3, max: 20 })
        .withMessage("Username must be between 3 and 20 characters")
        .bail()
        .toLowerCase()
        .matches(/^[a-z0-9_]+$/)
        .withMessage("Invalid Username"),

    body("bio")
        .optional()
        .isString().withMessage("Bio must be text")
        .bail()
        .trim()
        .isLength({ max: 160 })
        .withMessage("Bio must be at most 160 characters"),
];


export const changePasswordValidator = [
    // Optional for accounts created with Google/GitHub (no password yet)
    body("currentPassword")
        .optional()
        .isString().withMessage("Current password is required"),

    body("newPassword")
        .isString().withMessage("New password is required")
        .bail()
        .isLength({ min: 8 })
        .withMessage("New password must be at least 8 characters long"),
];


// The service requires it unless the account has no password (Google/GitHub)
export const deleteAccountValidator = [
    body("password")
        .optional()
        .isString().withMessage("Password is required to delete your account"),
];
