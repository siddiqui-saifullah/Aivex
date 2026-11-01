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
    /** "Improve my prompt" uses per day. */
    enhancePerDay: number | null;
    /** Gemini models to try, best first (falls back down the list). */
    models: string[] | null;
    /** How much the model may think before answering (2.5 models). */
    thinkingBudget: number;
    features: string[];
}

const DEFAULT_MODELS = null; // ai.service's own order (or GEMINI_MODEL)

export const PLANS: Record<PlanId, Plan> = {
    free: {
        id: "free",
        name: "Free",
        tagline: "Try Vex and learn the basics",
        price: { monthly: 0, yearly: 0 },
        vexPerDay: 3,
        enhancePerDay: 5,
        models: DEFAULT_MODELS,
        thinkingBudget: 512,
        features: ["3 Vex questions a day", "Full IDE, live preview, Node.js and C/C++", "Classrooms and collaboration"],
    },
    student: {
        id: "student",
        name: "Student",
        tagline: "For daily practice and assignments",
        price: { monthly: 99, yearly: 990 },
        vexPerDay: 30,
        enhancePerDay: 30,
        models: DEFAULT_MODELS,
        thinkingBudget: 512,
        features: ["30 Vex questions a day", "Code, fixes and explanations", "Everything in Free"],
    },
    pro: {
        id: "pro",
        name: "Pro",
        tagline: "For building real projects",
        price: { monthly: 299, yearly: 2990 },
        vexPerDay: 100,
        enhancePerDay: 100,
        models: DEFAULT_MODELS,
        thinkingBudget: 2048,
        features: ["100 Vex questions a day", "Deeper thinking on hard tasks", "Everything in Student"],
    },
    premium: {
        id: "premium",
        name: "Premium",
        tagline: "For power users and teachers",
        price: { monthly: 799, yearly: 7990 },
        vexPerDay: 400,
        enhancePerDay: 400,
        models: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"],
        thinkingBudget: 2048,
        features: ["400 Vex questions a day", "Gemini 2.5 Pro, our best model", "Everything in Pro"],
    },
};

export const PERIOD_DAYS: Record<BillingPeriod, number> = { monthly: 30, yearly: 365 };

export const isPaidPlan = (id: unknown): id is PaidPlanId => id === "student" || id === "pro" || id === "premium";
export const isPeriod = (p: unknown): p is BillingPeriod => p === "monthly" || p === "yearly";
