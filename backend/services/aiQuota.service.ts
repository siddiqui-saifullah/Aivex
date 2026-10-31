import type { Types } from "mongoose";
import redisClient from "./redis.service.js";
import { isAdminUser } from "../middleware/admin.middleware.js";

type Id = Types.ObjectId | string;

/**
 * Daily Vex AI allowance per user (the Gemini free tier is small). The day
 * runs midnight to midnight in AI_LIMIT_TZ. Admins are not limited.
 * - VEX_DAILY_LIMIT: questions to Vex per day (default 3, 0 = unlimited)
 * - ENHANCE_DAILY_LIMIT: "improve my prompt" uses per day (default 5)
 */
export type QuotaKind = "vex" | "enhance";

const limitOf = (kind: QuotaKind) => {
    const raw = kind === "vex" ? process.env.VEX_DAILY_LIMIT : process.env.ENHANCE_DAILY_LIMIT;
    const n = Number(raw ?? (kind === "vex" ? 3 : 5));
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 3;
};

const timeZone = () => process.env.AI_LIMIT_TZ || "Asia/Kolkata";

/** Today's date (YYYY-MM-DD) and the next midnight, in the limit's time zone. */
const today = (now = new Date()) => {
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat("en-CA", {
            timeZone: timeZone(),
            year: "numeric", month: "2-digit", day: "2-digit",
            hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
        }).formatToParts(now).map((p) => [p.type, p.value]),
    );
    const elapsed = (Number(parts.hour) * 3600 + Number(parts.minute) * 60 + Number(parts.second)) * 1000 + now.getMilliseconds();
    return { date: `${parts.year}-${parts.month}-${parts.day}`, resetsAt: new Date(now.getTime() - elapsed + 86_400_000) };
};

const key = (kind: QuotaKind, userId: Id, date: string) => `ai:quota:${kind}:${userId}:${date}`;

export interface QuotaStatus {
    limit: number | null;
    used: number;
    remaining: number | null;
    resetsAt: string;
}

export const quotaStatus = async (userId: Id, kind: QuotaKind = "vex"): Promise<QuotaStatus> => {
    const { date, resetsAt } = today();
    const limit = limitOf(kind);
    if (limit === 0 || await isAdminUser(userId)) return { limit: null, used: 0, remaining: null, resetsAt: resetsAt.toISOString() };
    const used = Number(await redisClient.get(key(kind, userId, date))) || 0;
    return { limit, used, remaining: Math.max(0, limit - used), resetsAt: resetsAt.toISOString() };
};

/**
 * Takes one use. Returns a refund function (call it if the AI request
 * failed, so errors don't cost the user), or null when the allowance is used up.
 */
export const takeQuota = async (userId: Id, kind: QuotaKind = "vex") => {
    const limit = limitOf(kind);
    if (limit === 0 || await isAdminUser(userId)) return () => undefined;
    const k = key(kind, userId, today().date);
    const used = await redisClient.incr(k);
    if (used === 1) await redisClient.expire(k, 2 * 86_400);
    if (used > limit) {
        await redisClient.decr(k);
        return null;
    }
    let refunded = false;
    return () => {
        if (refunded) return;
        refunded = true;
        void redisClient.decr(k).catch(() => undefined);
    };
};

export const quotaMessage = (kind: QuotaKind, status: QuotaStatus) => {
    const time = new Date(status.resetsAt).toLocaleTimeString("en-IN", { timeZone: timeZone(), hour: "numeric", minute: "2-digit" });
    return kind === "vex"
        ? `You've used all ${status.limit} Vex AI questions for today. They reset at ${time}.`
        : `You've used all ${status.limit} prompt improvements for today. They reset at ${time}.`;
};
