import userModel from "../models/user.model.js";

/**
 * One-time admin password reset for when the owner is locked out and there's
 * no email-based reset: set ADMIN_RESET_PASSWORD (8+ characters) next to
 * ADMIN_EMAILS, deploy once, sign in, then delete the variable.
 * Only someone with access to the server's settings can use it.
 */
export const resetAdminPasswords = async () => {
    const password = process.env.ADMIN_RESET_PASSWORD;
    if (!password) return;
    if (password.length < 8) {
        console.warn("ADMIN_RESET_PASSWORD ignored: it must be at least 8 characters");
        return;
    }

    const emails = (process.env.ADMIN_EMAILS ?? "")
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
    if (emails.length === 0) {
        console.warn("ADMIN_RESET_PASSWORD ignored: ADMIN_EMAILS is empty");
        return;
    }

    const hash = await userModel.hashPassword(password);
    for (const email of emails) {
        const result = await userModel.updateOne({ email }, { $set: { password: hash } });
        console.warn(
            result.matchedCount
                ? `Admin password reset for ${email}. Remove ADMIN_RESET_PASSWORD from the environment now.`
                : `ADMIN_RESET_PASSWORD: no account with email ${email} (register it first).`,
        );
    }
};
