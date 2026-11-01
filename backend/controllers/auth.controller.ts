import * as github from "../services/github.service.js";
import type { Request, Response } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import catchAsync from "../utils/catchAsync.js";
import AppError from "../errors/AppError.js";
import * as oauth from "../services/oauth.service.js";
import { recordLogin } from "../services/activity.service.js";
import userModel from "../models/user.model.js";
import { allowedOrigins } from "../config/cors.js";

const STATE_COOKIE = "oauth_state";

const isProduction = process.env.NODE_ENV === "production" || Boolean(process.env.RENDER);

/** Where to send the browser back when we don't know which site it came from. */
const frontendUrl = () =>
    (process.env.FRONTEND_URL || (isProduction ? "https://aivex.in" : "http://localhost:5173")).replace(/\/$/, "");

/** The site (one of ours) that sent the browser to sign in, so it comes back there. */
const siteOf = (req: Request) => {
    try {
        const origin = new URL(String(req.get("referer") ?? "")).origin;
        return allowedOrigins.includes(origin) ? origin : undefined;
    } catch {
        return undefined;
    }
};

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
    const state = await oauth.createState(provider, safeNext(req.query.next), siteOf(req));
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
    let site = frontendUrl();
    const back = (params: Record<string, string>) =>
        res.redirect(`${site}/auth/callback?${new URLSearchParams(params)}`);
    try {
        const provider = providerParam(req);
        if (req.query.error) return back({ error: "Sign-in was cancelled" });
        const state = String(req.query.state ?? "");
        const code = String(req.query.code ?? "");
        if (!state || !code || req.cookies?.[STATE_COOKIE] !== state) {
            throw new AppError("Sign-in expired. Try again", 400);
        }
        res.clearCookie(STATE_COOKIE, { path: "/auth" });
        const { next, site: from } = await oauth.consumeState(state, provider);
        if (from && allowedOrigins.includes(from)) site = from;
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

/* -------------------------------------------------------------------------- */
/* CONNECT GITHUB (push projects): same OAuth app, with the `repo` scope       */
/* -------------------------------------------------------------------------- */
const CONNECT_COOKIE = "gh_connect";
/** A subpath of the registered callback, which GitHub accepts. */
const connectRedirectUri = (req: Request) => `${redirectUri(req, "github")}/connect`;

/** The browser arrives with a one-time ticket from /integrations/github/ticket. */
export const githubConnectStart = catchAsync(async (req, res) => {
    const { state, url } = await github.startConnect(String(req.query.ticket ?? ""), connectRedirectUri(req));
    res.cookie(CONNECT_COOKIE, state, { httpOnly: true, secure: req.secure, sameSite: "lax", maxAge: 10 * 60_000, path: "/auth" });
    res.redirect(url);
});

export const githubConnectCallback = async (req: Request, res: Response) => {
    const site = frontendUrl();
    try {
        const state = String(req.query.state ?? "");
        if (req.query.error) return res.redirect(`${site}/settings/account?github=cancelled`);
        // Only the browser that started connecting can finish it
        if (!state || req.cookies?.[CONNECT_COOKIE] !== state) throw new AppError("Connecting expired. Try again.", 400);
        res.clearCookie(CONNECT_COOKIE, { path: "/auth" });
        const { next } = await github.finishConnect(state, String(req.query.code ?? ""), connectRedirectUri(req));
        res.redirect(`${site}${next}${next.includes("?") ? "&" : "?"}github=connected`);
    } catch (err) {
        if (!(err instanceof AppError)) console.error("GitHub connect failed:", err);
        const message = err instanceof AppError ? err.message : "GitHub didn't connect. Try again.";
        res.redirect(`${site}/settings/account?${new URLSearchParams({ github: "error", message })}`);
    }
};
