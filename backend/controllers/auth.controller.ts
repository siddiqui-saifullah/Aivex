import type { Request, Response } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../errors/AppError.js";
import * as oauth from "../services/oauth.service.js";
import { recordLogin } from "../services/activity.service.js";
import userModel from "../models/user.model.js";

const STATE_COOKIE = "oauth_state";

const frontendUrl = () => (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");

/** Must match the redirect URI registered with the provider. */
const redirectUri = (req: Request, provider: oauth.Provider) =>
    `${(process.env.BACKEND_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "")}/auth/${provider}/callback`;

/** Only paths on this site (no "//evil.com"). */
const safeNext = (next: unknown) =>
    typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

const providerParam = (req: Request) => {
    const provider = String(req.params.provider);
    if (!oauth.isProvider(provider) || !oauth.isConfigured(provider)) {
        throw new AppError("This sign-in method isn't available", 404);
    }
    return provider;
};

/** Which "Continue with ..." buttons to show. */
export const providers = (_req: Request, res: Response) => {
    res.json({ google: oauth.isConfigured("google"), github: oauth.isConfigured("github") });
};

/** Step 1: send the browser to the provider's consent screen. */
export const start = catchAsync(async (req, res) => {
    const provider = providerParam(req);
    const state = await oauth.createState(provider, safeNext(req.query.next));
    // Ties the callback to this browser, so nobody can sign you into their account
    res.cookie(STATE_COOKIE, state, {
        httpOnly: true,
        secure: req.secure,
        sameSite: "lax",
        maxAge: 10 * 60_000,
        path: "/auth",
    });
    res.redirect(oauth.authorizationUrl(provider, redirectUri(req, provider), state));
});

/** Step 2: the provider sends the browser back here with a code. */
export const callback = async (req: Request, res: Response) => {
    const back = (params: Record<string, string>) =>
        res.redirect(`${frontendUrl()}/auth/callback?${new URLSearchParams(params)}`);
    try {
        const provider = providerParam(req);
        if (req.query.error) return back({ error: "Sign-in was cancelled" });
        const state = String(req.query.state ?? "");
        const code = String(req.query.code ?? "");
        if (!state || !code || req.cookies?.[STATE_COOKIE] !== state) {
            throw new AppError("Sign-in expired. Try again", 400);
        }
        res.clearCookie(STATE_COOKIE, { path: "/auth" });
        const { next } = await oauth.consumeState(state, provider);
        const user = await oauth.signInWithProvider(provider, code, redirectUri(req, provider));
        if (user.suspendedAt) throw new AppError("This account has been suspended", 403);
        recordLogin(user._id);
        back({ code: await oauth.createLoginCode(user.generateJWT()), next });
    } catch (err) {
        if (!(err instanceof AppError)) console.error("OAuth sign-in failed:", err);
        back({ error: err instanceof AppError ? err.message : "Sign-in failed. Try again" });
    }
};

/** Step 3: the site trades the one-time code for the session token. */
export const exchange = catchAsync(async (req, res) => {
    const token = await oauth.redeemLoginCode(String(req.body?.code ?? ""));
    const { userId } = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
    const user = await userModel.findById(userId).select("_id name username").lean();
    if (!user) throw new AppError("Account not found", 404);
    res.json({ token, user });
});
