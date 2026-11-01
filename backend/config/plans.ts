import type { ModelGroup } from "../services/ai.service.js";

/**
 * Subscription plans. Prices are in rupees; yearly is about two months free.
 * Paying for a plan buys 30 or 365 days of it (no auto-renew), then the
 * account goes back to Free.
 */
export const PLAN_IDS = ["free", "student", "pro", "premium"] as const;
export type PlanId = (typeof PLAN_IDS)[number];
export type PaidPlanId = Exclude<PlanId, "free">;
export type BillingPeriod = "monthly" | "yearly";

export interface Plan {
    id: PlanId;
    name: string;
    tagline: string;
    price: { monthly: number; yearly: number };
    /** Questions to Vex per day (null = unlimited). */
    vexPerDay: number | null;
    /** Fair use: questions to Vex per calendar month (null = only the daily limit). */
    vexPerMonth: number | null;
    /** Questions a day answered by the "pro" model group (it costs the most). */
    proPerDay: number;
    /** "Improve my prompt" uses per day. */
    enhancePerDay: number | null;
    /** Model groups to try, best first (see ai.service: free, lite, flash, pro). */
    route: ModelGroup[];
    /** How much the model may think before answering (2.5 models). */
    thinkingBudget: number;
    features: string[];
}

export const PLANS: Record<PlanId, Plan> = {
    free: {
        id: "free",
        name: "Free",
        tagline: "Try Vex and learn the basics",
        price: { monthly: 0, yearly: 0 },
        vexPerDay: 3,
        vexPerMonth: null,
        proPerDay: 0,
        enhancePerDay: 5,
        route: ["free", "lite"],
        thinkingBudget: 512,
        features: ["3 Vex questions a day", "Full IDE, live preview, Node.js and C/C++", "Classrooms and collaboration"],
    },
    student: {
        id: "student",
        name: "Student",
        tagline: "For daily practice and assignments",
        price: { monthly: 99, yearly: 990 },
        vexPerDay: 30,
        vexPerMonth: null,
        proPerDay: 0,
        enhancePerDay: 30,
        route: ["free", "lite"],
        thinkingBudget: 512,
        features: ["30 Vex questions a day", "Code, fixes and explanations", "Everything in Free"],
    },
    pro: {
        id: "pro",
        name: "Pro",
        tagline: "For building real projects",
        price: { monthly: 299, yearly: 2990 },
        vexPerDay: 60,
        vexPerMonth: 1200,
        proPerDay: 0,
        enhancePerDay: 60,
        route: ["flash", "lite", "free"],
        thinkingBudget: 2048,
        features: ["60 Vex questions a day (1,200 a month)", "Gemini 2.5 Flash with deeper thinking", "Everything in Student"],
    },
    premium: {
        id: "premium",
        name: "Premium",
        tagline: "For power users and teachers",
        price: { monthly: 799, yearly: 7990 },
        vexPerDay: 200,
        vexPerMonth: 4000,
        proPerDay: 30,
        enhancePerDay: 200,
        route: ["pro", "flash", "lite", "free"],
        thinkingBudget: 2048,
        features: ["200 Vex questions a day (4,000 a month)", "30 a day answered by Gemini 2.5 Pro, our best model", "Everything in Pro"],
    },
};

export const PERIOD_DAYS: Record<BillingPeriod, number> = { monthly: 30, yearly: 365 };

export const isPaidPlan = (id: unknown): id is PaidPlanId => id === "student" || id === "pro" || id === "premium";
export const isPeriod = (p: unknown): p is BillingPeriod => p === "monthly" || p === "yearly";
