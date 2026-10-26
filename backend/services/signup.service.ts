import crypto from "node:crypto";
import AppError from "../errors/AppError.js";
import userModel from "../models/user.model.js";
import redisClient from "./redis.service.js";
import { isMailConfigured, sendSignupCode } from "./mail.service.js";
import { assertAccountAvailable, createUser } from "./user.service.js";
import { assertEmailAllowed, assertNameAllowed, assertUsernameAllowed } from "../utils/spamFilter.js";

/**
 * Email sign-up in two steps: the details are checked and kept in Redis
 * while a 6-digit code goes to the email; the account is only created once
 * the code comes back. Without SMTP settings the account is created at once.
 */

const CODE_TTL_SECONDS = 10 * 60;
const MAX_ATTEMPTS = 5;
const MAX_SENDS = 5;
const RESEND_AFTER_MS = 60_000;

interface PendingSignup {
    name: string;
    username: string;
    email: string;
    passwordHash: string;
    codeHash: string;
    attempts: number;
    sends: number;
    sentAt: number;
}

const key = (email: string) => `signup:${email.trim().toLowerCase()}`;
const hashCode = (email: string, code: string) =>
    crypto.createHash("sha256").update(`${email.trim().toLowerCase()}:${code}`).digest("hex");
const newCode = () => crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");

const load = async (email: string) => {
    const raw = await redisClient.get(key(email));
    return raw ? (JSON.parse(raw) as PendingSignup) : null;
};
/** Save without extending the code's expiry. */
const save = (pending: PendingSignup) => redisClient.set(key(pending.email), JSON.stringify(pending), "KEEPTTL");

export type SignupResult =
    | { verificationRequired: true; email: string }
    | { verificationRequired: false; user: Awaited<ReturnType<typeof createUser>> };

export const startSignup = async ({ name, username, email, password, website }: {
    name: string;
    username: string;
    email: string;
    password: string;
    /** Honeypot: hidden in the form, so only bots fill it in. */
    website?: string;
}): Promise<SignupResult> => {
    if (website) throw new AppError("Registration failed", 400);
    assertNameAllowed(name);
    assertUsernameAllowed(username);
    await assertEmailAllowed(email);
    await assertAccountAvailable({ email, username });

    if (!isMailConfigured()) {
        return { verificationRequired: false, user: await createUser({ name, username, email, password }) };
    }

    const address = email.trim().toLowerCase();
    const code = newCode();
    const pending: PendingSignup = {
        name,
        username,
        email: address,
        passwordHash: await userModel.hashPassword(password),
        codeHash: hashCode(address, code),
        attempts: 0,
        sends: 1,
        sentAt: Date.now(),
    };
    await redisClient.set(key(address), JSON.stringify(pending), "EX", CODE_TTL_SECONDS);
    try {
        await sendSignupCode({ to: address, name, code });
    } catch (err) {
        await redisClient.del(key(address));
        console.error("Sign-up email failed:", (err as Error).message);
        throw new AppError("Couldn't send the verification email. Check the address and try again", 502);
    }
    return { verificationRequired: true, email: address };
};

export const verifySignup = async ({ email, code }: { email: string; code: string }) => {
    const pending = await load(email);
    if (!pending) throw new AppError("This code has expired. Sign up again to get a new one", 400);

    const given = Buffer.from(hashCode(pending.email, String(code).trim()));
    if (!crypto.timingSafeEqual(given, Buffer.from(pending.codeHash))) {
        pending.attempts++;
        if (pending.attempts >= MAX_ATTEMPTS) {
            await redisClient.del(key(pending.email));
            throw new AppError("Too many wrong codes. Sign up again to get a new one", 429);
        }
        await save(pending);
        const left = MAX_ATTEMPTS - pending.attempts;
        throw new AppError(`Wrong code. ${left} ${left === 1 ? "try" : "tries"} left`, 400);
    }

    await redisClient.del(key(pending.email));
    return createUser({
        name: pending.name,
        username: pending.username,
        email: pending.email,
        passwordHash: pending.passwordHash,
    });
};

export const resendSignupCode = async ({ email }: { email: string }) => {
    const pending = await load(email);
    if (!pending) throw new AppError("This sign-up has expired. Sign up again", 400);

    const wait = pending.sentAt + RESEND_AFTER_MS - Date.now();
    if (wait > 0) throw new AppError(`Wait ${Math.ceil(wait / 1000)} s before asking for a new code`, 429);
    if (pending.sends >= MAX_SENDS) throw new AppError("Too many codes sent. Sign up again later", 429);

    const code = newCode();
    pending.codeHash = hashCode(pending.email, code);
    pending.attempts = 0;
    pending.sends++;
    pending.sentAt = Date.now();
    // A fresh code gets a fresh 10 minutes
    await redisClient.set(key(pending.email), JSON.stringify(pending), "EX", CODE_TTL_SECONDS);
    await sendSignupCode({ to: pending.email, name: pending.name, code });
};
