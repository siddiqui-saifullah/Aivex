import type { Types } from "mongoose";
import redisClient from "./redis.service.js";
import { activePlan } from "./billing.service.js";
import { PLANS, type PlanId } from "../config/plans.js";
import type { ModelGroup } from "./ai.service.js";

type Id = Types.ObjectId | string;

/**
 * Vex AI allowance per user, set by their plan (config/plans.ts): a daily
 * limit, and on bigger plans a monthly fair-use limit too. Days run midnight
 * to midnight in AI_LIMIT_TZ, months are calendar months. Admins are not
 * limited. The Free plan's numbers can be changed without a deploy:
 * - VEX_DAILY_LIMIT: questions to Vex per day (default 3, 0 = unlimited)
 * - ENHANCE_DAILY_LIMIT: "improve my prompt" uses per day (default 5)
 */
export type QuotaKind = "vex" | "enhance";

const DAY = 86_400_000;

/** 0 = unlimited. */
const limitOf = (kind: QuotaKind, plan: PlanId) => {
    const fromPlan = (kind === "vex" ? PLANS[plan].vexPerDay : PLANS[plan].enhancePerDay) ?? 0;
    if (plan !== "free") return fromPlan;
    const raw = kind === "vex" ? process.env.VEX_DAILY_LIMIT : process.env.ENHANCE_DAILY_LIMIT;
    const n = Number(raw ?? fromPlan);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fromPlan;
};

/** The user's limits (null = unlimited) and their plan. */
const allowance = async (userId: Id, kind: QuotaKind) => {
    const { plan, admin } = await activePlan(userId);
    const limit = limitOf(kind, plan);
    const monthly = kind === "vex" ? PLANS[plan].vexPerMonth : null;
    return {
        plan,
        admin,
        limit: admin || limit === 0 ? null : limit,
        monthLimit: admin ? null : monthly,
    };
};

const timeZone = () => process.env.AI_LIMIT_TZ || "Asia/Kolkata";

/** Today's date (YYYY-MM-DD), this month (YYYY-MM), and when each ends, in the limit's time zone. */
const today = (now = new Date()) => {
    const parts = Object.fromEntries(
        new Intl.DateTimeFormat("en-CA", {
            timeZone: timeZone(),
            year: "numeric", month: "2-digit", day: "2-digit",
            hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
        }).formatToParts(now).map((p) => [p.type, p.value]),
    );
    const elapsed = (Number(parts.hour) * 3600 + Number(parts.minute) * 60 + Number(parts.second)) * 1000 + now.getMilliseconds();
    const resetsAt = new Date(now.getTime() - elapsed + DAY);
    const year = Number(parts.year);
    const month = Number(parts.month);
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const monthResetsAt = new Date(resetsAt.getTime() + (daysInMonth - Number(parts.day)) * DAY);
    return { date: `${parts.year}-${parts.month}-${parts.day}`, month: `${parts.year}-${parts.month}`, resetsAt, monthResetsAt };
};

const key = (kind: string, userId: Id, date: string) => `ai:quota:${kind}:${userId}:${date}`;
const monthKey = (userId: Id, month: string) => key("vex-month", userId, month);

export interface QuotaStatus {
    plan: PlanId;
    /** The limit that applies now: today's, or the month's when that runs out first. */
    limit: number | null;
    used: number;
    remaining: number | null;
    resetsAt: string;
    /** Which limit the numbers above are. */
    period: "day" | "month";
    /** Fair-use limit for the month (bigger plans), and its use so far. */
    monthLimit: number | null;
    monthUsed: number;
}

export const quotaStatus = async (userId: Id, kind: QuotaKind = "vex"): Promise<QuotaStatus> => {
    const { date, month, resetsAt, monthResetsAt } = today();
    const { plan, limit, monthLimit } = await allowance(userId, kind);
    const monthUsed = monthLimit ? Number(await redisClient.get(monthKey(userId, month))) || 0 : 0;
    const base = { plan, monthLimit, monthUsed: monthLimit ? Math.min(monthUsed, monthLimit) : 0 };
    if (limit === null) return { ...base, limit: null, used: 0, remaining: null, resetsAt: resetsAt.toISOString(), period: "day" };
    const used = Number(await redisClient.get(key(kind, userId, date))) || 0;
    const dayLeft = Math.max(0, limit - used);
    if (monthLimit && monthLimit - monthUsed < dayLeft) {
        return { ...base, limit: monthLimit, used: Math.min(monthUsed, monthLimit), remaining: Math.max(0, monthLimit - monthUsed), resetsAt: monthResetsAt.toISOString(), period: "month" };
    }
    return { ...base, limit, used: Math.min(used, limit), remaining: dayLeft, resetsAt: resetsAt.toISOString(), period: "day" };
};

/** Count one use against a limit; false (and nothing counted) when it's full. */
const take = async (k: string, limit: number, ttlSeconds: number) => {
    const used = await redisClient.incr(k);
    if (used === 1) await redisClient.expire(k, ttlSeconds);
    if (used > limit) {
        await redisClient.decr(k);
        return false;
    }
    return true;
};

/**
 * Takes one use. Returns a refund function (call it if the AI request
 * failed, so errors don't cost the user), or null when the allowance is used up.
 */
export const takeQuota = async (userId: Id, kind: QuotaKind = "vex") => {
    const { limit, monthLimit } = await allowance(userId, kind);
    if (limit === null) return () => undefined;
    const { date, month } = today();
    const dayK = key(kind, userId, date);
    if (!await take(dayK, limit, 2 * 86_400)) return null;
    const monthK = monthLimit ? monthKey(userId, month) : null;
    if (monthK && !await take(monthK, monthLimit!, 33 * 86_400)) {
        await redisClient.decr(dayK);
        return null;
    }
    let refunded = false;
    return () => {
        if (refunded) return;
        refunded = true;
        void redisClient.decr(dayK).catch(() => undefined);
        if (monthK) void redisClient.decr(monthK).catch(() => undefined);
    };
};

export const quotaMessage = (kind: QuotaKind, status: QuotaStatus) => {
    const more = status.plan === "premium" ? "" : " Upgrade your plan for more.";
    if (status.period === "month") {
        const day = new Date(status.resetsAt).toLocaleDateString("en-IN", { timeZone: timeZone(), day: "numeric", month: "short" });
        return `You've used all ${status.limit} Vex AI questions for this month. They reset on ${day}.${more}`;
    }
    const time = new Date(status.resetsAt).toLocaleTimeString("en-IN", { timeZone: timeZone(), hour: "numeric", minute: "2-digit" });
    return kind === "vex"
        ? `You've used all ${status.limit} Vex AI questions for today. They reset at ${time}.${more}`
        : `You've used all ${status.limit} prompt improvements for today. They reset at ${time}.${more}`;
};

/* -------------------------------------------------------------------------- */
/* MODELS BY PLAN                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Which models answer this user: their plan's route, without the "pro"
 * group once today's best-model answers are used up.
 */
export const aiOptionsFor = async (userId: Id): Promise<{ route: ModelGroup[]; thinkingBudget: number }> => {
    const { plan, admin } = await activePlan(userId);
    const p = PLANS[plan];
    let route = p.route;
    if (route.includes("pro") && !admin) {
        const used = Number(await redisClient.get(key("pro", userId, today().date))) || 0;
        if (used >= p.proPerDay) route = route.filter((g) => g !== "pro");
    }
    return { route, thinkingBudget: p.thinkingBudget };
};

/** After an answer: count it when the expensive model gave it. */
export const recordModelUse = async (userId: Id, model: string | undefined) => {
    if (!model || !/2\.5-pro/.test(model)) return;
    const k = key("pro", userId, today().date);
    const used = await redisClient.incr(k);
    if (used === 1) await redisClient.expire(k, 2 * 86_400);
};

/** Cheap models only: prompt improvement doesn't need the best one. */
export const ENHANCE_ROUTE: ModelGroup[] = ["free", "lite"];
