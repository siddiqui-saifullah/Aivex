import crypto from "node:crypto";
import AppError from "../errors/AppError.js";
import userModel, { type UserDocument } from "../models/user.model.js";
import redisClient from "./redis.service.js";
import { createUser } from "./user.service.js";
import { assertNameAllowed, assertUsernameAllowed, canonicalEmail } from "../utils/spamFilter.js";

/**
 * "Continue with Google / GitHub" (OAuth 2.0 authorization code flow).
 * Configure GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET and/or GITHUB_CLIENT_ID +
 * GITHUB_CLIENT_SECRET; the redirect URI to register with each provider is
 * <backend URL>/auth/<provider>/callback.
 */

export type Provider = "google" | "github";

interface ProviderProfile {
    id: string;
    email: string | null;
    emailVerified: boolean;
    name: string;
    /** Suggested username (GitHub login, or the email's local part). */
    handle: string;
}

const env = (provider: Provider) => ({
    clientId: process.env[`${provider.toUpperCase()}_CLIENT_ID`],
    clientSecret: process.env[`${provider.toUpperCase()}_CLIENT_SECRET`],
});

export const isProvider = (value: string): value is Provider => value === "google" || value === "github";
export const isConfigured = (provider: Provider) => Boolean(env(provider).clientId && env(provider).clientSecret);

export const authorizationUrl = (provider: Provider, redirectUri: string, state: string) => {
    const { clientId } = env(provider);
    const params = new URLSearchParams({ client_id: clientId!, redirect_uri: redirectUri, state, response_type: "code" });
    if (provider === "google") {
        params.set("scope", "openid email profile");
        params.set("prompt", "select_account");
        return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    }
    params.set("scope", "read:user user:email");
    params.set("allow_signup", "true");
    return `https://github.com/login/oauth/authorize?${params}`;
};

const getJson = async <T>(url: string, init: RequestInit) => {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new AppError(`Sign-in provider error (${res.status})`, 502);
    return (await res.json()) as T;
};

/** Trade the callback's code for the user's identity at the provider. */
const fetchProfile = async (provider: Provider, code: string, redirectUri: string): Promise<ProviderProfile> => {
    const { clientId, clientSecret } = env(provider);
    if (provider === "google") {
        const token = await getJson<{ access_token?: string }>("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                code,
                client_id: clientId!,
                client_secret: clientSecret!,
                redirect_uri: redirectUri,
                grant_type: "authorization_code",
            }),
        });
        if (!token.access_token) throw new AppError("Google sign-in failed", 401);
        const info = await getJson<{ sub: string; email?: string; email_verified?: boolean; name?: string }>(
            "https://openidconnect.googleapis.com/v1/userinfo",
            { headers: { Authorization: `Bearer ${token.access_token}` } },
        );
        return {
            id: info.sub,
            email: info.email ?? null,
            emailVerified: info.email_verified === true,
            name: info.name ?? "",
            handle: (info.email ?? "").split("@")[0],
        };
    }

    const token = await getJson<{ access_token?: string }>("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri }),
    });
    if (!token.access_token) throw new AppError("GitHub sign-in failed", 401);
    const headers = { Authorization: `Bearer ${token.access_token}`, "User-Agent": "aivex" };
    const [user, emails] = await Promise.all([
        getJson<{ id: number; login: string; name?: string | null }>("https://api.github.com/user", { headers }),
        getJson<{ email: string; primary: boolean; verified: boolean }[]>("https://api.github.com/user/emails", { headers }),
    ]);
    const primary = emails.find((e) => e.primary && e.verified) ?? emails.find((e) => e.verified);
    return {
        id: String(user.id),
        email: primary?.email ?? null,
        emailVerified: Boolean(primary),
        name: user.name || user.login,
        handle: user.login,
    };
};

/** Display names must be letters and spaces (user model), and not spam or "admin". */
const cleanName = (...candidates: string[]) => {
    for (const candidate of candidates) {
        const cleaned = candidate.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z ]/g, " ").replace(/\s+/g, " ").trim().slice(0, 50);
        if (cleaned.length < 3) continue;
        try {
            assertNameAllowed(cleaned);
            assertUsernameAllowed(cleaned.toLowerCase().replace(/ /g, "_"));
            return cleaned;
        } catch {
            /* try the next one */
        }
    }
    return "Aivex User";
};

const allowed = (username: string) => {
    try {
        assertUsernameAllowed(username);
        return true;
    } catch {
        return false;
    }
};

const usernameOk = async (candidate: string) => allowed(candidate) && !(await userModel.exists({ username: candidate }));

/** A free, allowed username close to the provider's handle. */
const pickUsername = async (handle: string) => {
    let base = handle.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "").slice(0, 15);
    if (base.length < 3 || !allowed(base)) base = "coder";
    if (await usernameOk(base)) return base;
    const letters = "abcdefghijkmnpqrstuvwxyz";
    for (let i = 0; i < 20; i++) {
        const suffix = i < 10
            ? String(crypto.randomInt(10, 100))
            : Array.from({ length: 3 }, () => letters[crypto.randomInt(letters.length)]).join("");
        const candidate = `${base}_${suffix}`;
        if (await usernameOk(candidate)) return candidate;
    }
    return `coder_${crypto.randomBytes(3).toString("hex")}`;
};

/** Sign in (or sign up) with the provider's verified email, linking accounts by email. */
export const signInWithProvider = async (provider: Provider, code: string, redirectUri: string): Promise<UserDocument> => {
    const profile = await fetchProfile(provider, code, redirectUri);
    if (!profile.email || !profile.emailVerified) {
        throw new AppError(`Your ${provider === "google" ? "Google" : "GitHub"} account has no verified email`, 400);
    }
    const idField = provider === "google" ? "googleId" : "githubId";
    const email = profile.email.toLowerCase();

    const existing =
        (await userModel.findOne({ [idField]: profile.id })) ??
        (await userModel.findOne({ $or: [{ email }, { email: canonicalEmail(email) }, { emailCanonical: canonicalEmail(email) }] }));
    if (existing) {
        if (!existing[idField]) {
            existing[idField] = profile.id;
            await existing.save();
        }
        return existing;
    }

    return createUser({
        name: cleanName(profile.name, profile.handle, email.split("@")[0]),
        username: await pickUsername(profile.handle),
        email,
        [idField]: profile.id,
    });
};

/* ---- short-lived state, kept in Redis ---- */

const STATE_TTL = 10 * 60;

/** Remember where to go after sign-in; the state also guards against forged callbacks. */
export const createState = async (provider: Provider, next: string, site?: string) => {
    const state = crypto.randomBytes(24).toString("base64url");
    await redisClient.set(`oauth:state:${state}`, JSON.stringify({ provider, next, site }), "EX", STATE_TTL);
    return state;
};

export const consumeState = async (state: string, provider: Provider) => {
    const raw = await redisClient.getdel(`oauth:state:${state}`);
    const data = raw ? (JSON.parse(raw) as { provider: Provider; next: string; site?: string }) : null;
    if (!data || data.provider !== provider) throw new AppError("Sign-in expired. Try again", 400);
    return data;
};

/**
 * The browser comes back to the site with a one-time code (valid 60 s) and
 * trades it for the session token, so the token never appears in a URL.
 */
export const createLoginCode = async (token: string) => {
    const code = crypto.randomBytes(24).toString("base64url");
    await redisClient.set(`oauth:code:${code}`, token, "EX", 60);
    return code;
};

export const redeemLoginCode = async (code: string) => {
    const token = await redisClient.getdel(`oauth:code:${code}`);
    if (!token) throw new AppError("Sign-in expired. Try again", 400);
    return token;
};
