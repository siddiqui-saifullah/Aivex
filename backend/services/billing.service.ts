import crypto from "node:crypto";
import type { Types } from "mongoose";
import AppError from "../errors/AppError.js";
import userModel from "../models/user.model.js";
import Payment from "../models/payment.model.js";
import { isAdminEmail } from "../middleware/admin.middleware.js";
import { PERIOD_DAYS, PLANS, isPaidPlan, isPeriod, type PlanId } from "../config/plans.js";

type Id = Types.ObjectId | string;
const DAY = 86_400_000;

/**
 * Payments through Razorpay Payment Links: the user pays on Razorpay's page
 * and comes back to /settings/billing. (The in-page checkout can't load here:
 * the app sends cross-origin isolation headers for the code runners.) Each
 * payment buys 30 or 365 days of a plan, no auto-renew. Needs
 * RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET, and RAZORPAY_WEBHOOK_SECRET for
 * the webhook (a backup for payments whose browser never came back).
 */
const keyId = () => process.env.RAZORPAY_KEY_ID ?? "";
const keySecret = () => process.env.RAZORPAY_KEY_SECRET ?? "";
const apiBase = () => process.env.RAZORPAY_API_BASE || "https://api.razorpay.com";

export const billingEnabled = () => Boolean(keyId() && keySecret());

export interface ActivePlan {
    plan: PlanId;
    expiresAt: Date | null;
    admin: boolean;
}

/** The plan in force right now (an expired plan is Free). */
export const activePlan = async (userId: Id): Promise<ActivePlan> => {
    const user = await userModel.findById(userId).select("email plan planExpiresAt").lean();
    if (!user) return { plan: "free", expiresAt: null, admin: false };
    const admin = isAdminEmail(user.email);
    const paid = isPaidPlan(user.plan) && user.planExpiresAt && user.planExpiresAt.getTime() > Date.now();
    return paid ? { plan: user.plan, expiresAt: user.planExpiresAt, admin } : { plan: "free", expiresAt: null, admin };
};

const rank = (plan: PlanId) => ["free", "student", "pro", "premium"].indexOf(plan);

const razorpay = async <T>(path: string, body: object): Promise<T> => {
    const res = await fetch(`${apiBase()}${path}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Basic ${Buffer.from(`${keyId()}:${keySecret()}`).toString("base64")}`,
        },
        body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        console.error("Razorpay error:", res.status, JSON.stringify(data));
        throw new AppError("Payments are unavailable right now. Please try again later.", 502);
    }
    return data as T;
};

const frontendUrl = () => (process.env.FRONTEND_URL || "https://aivex.vercel.app").split(",")[0].trim().replace(/\/$/, "");

/** Start a payment: creates a Razorpay payment link and returns its URL. */
export const createCheckout = async (userId: Id, planId: unknown, period: unknown) => {
    if (!billingEnabled()) throw new AppError("Payments aren't open yet. Please check back soon.", 503);
    if (!isPaidPlan(planId)) throw new AppError("Choose a plan", 400);
    if (!isPeriod(period)) throw new AppError("Choose monthly or yearly", 400);

    const current = await activePlan(userId);
    if (current.expiresAt && rank(current.plan) > rank(planId)) {
        throw new AppError(`You're on ${PLANS[current.plan].name} until ${current.expiresAt.toDateString()}. You can switch to a smaller plan after that.`, 400);
    }

    const plan = PLANS[planId];
    const amount = plan.price[period] * 100;
    const reference = `aivex_${crypto.randomBytes(9).toString("hex")}`;
    const user = await userModel.findById(userId).select("name email").lean();
    const link = await razorpay<{ id: string; short_url: string }>("/v1/payment_links", {
        amount,
        currency: "INR",
        reference_id: reference,
        description: `Aivex ${plan.name} (${period === "yearly" ? "1 year" : "1 month"})`,
        customer: { name: user?.name ?? "", email: user?.email ?? "" },
        notify: { sms: false, email: false },
        reminder_enable: false,
        expire_by: Math.floor(Date.now() / 1000) + 24 * 3600,
        callback_url: `${frontendUrl()}/settings/billing`,
        callback_method: "get",
        notes: { userId: String(userId), plan: planId, period },
    });
    await Payment.create({ user: userId, plan: planId, period, amount, currency: "INR", linkId: link.id, reference });
    return { url: link.short_url };
};

const safeEqual = (a: string, b: string) => {
    const x = Buffer.from(a);
    const y = Buffer.from(b);
    return x.length === y.length && crypto.timingSafeEqual(x, y);
};

const hmac = (secret: string, data: string | Buffer) => crypto.createHmac("sha256", secret).update(data).digest("hex");

/**
 * Apply a paid order once (the browser and the webhook may both report it).
 * Same plan: the days are added on. Upgrade: the unused days of the old plan
 * are converted at their value, so nothing paid for is lost.
 */
const applyPayment = async (linkId: string, paymentId: string) => {
    const payment = await Payment.findOneAndUpdate(
        { linkId, status: { $ne: "paid" } },
        { $set: { status: "paid", paymentId, paidAt: new Date() } },
        { new: true },
    );
    if (!payment) return null; // unknown, or already applied

    const user = await userModel.findById(payment.user).select("plan planExpiresAt");
    if (!user) return payment;
    const now = Date.now();
    const left = user.planExpiresAt && isPaidPlan(user.plan) ? Math.max(0, user.planExpiresAt.getTime() - now) : 0;
    let carried = 0;
    if (left > 0 && user.plan === payment.plan) carried = left;
    else if (left > 0 && isPaidPlan(user.plan)) {
        carried = Math.floor(left * PLANS[user.plan].price.monthly / PLANS[payment.plan].price.monthly);
    }
    const validUntil = new Date(now + carried + PERIOD_DAYS[payment.period] * DAY);
    user.plan = payment.plan;
    user.planExpiresAt = validUntil;
    await user.save();
    payment.validUntil = validUntil;
    await payment.save();
    return payment;
};

/**
 * The redirect back from Razorpay (its query parameters), checked with
 * Razorpay's signature.
 */
export const verifyPayment = async (userId: Id, body: Record<string, unknown>) => {
    const linkId = body.razorpay_payment_link_id;
    const reference = body.razorpay_payment_link_reference_id;
    const status = body.razorpay_payment_link_status;
    const paymentId = body.razorpay_payment_id;
    const signature = body.razorpay_signature;
    if ([linkId, reference, status, paymentId, signature].some((v) => typeof v !== "string")) {
        throw new AppError("Missing payment details", 400);
    }
    const payment = await Payment.findOne({ linkId, user: userId }).lean();
    if (!payment) throw new AppError("Payment not found", 404);
    const signed = `${linkId}|${reference}|${status}|${paymentId}`;
    if (reference !== payment.reference || !safeEqual(hmac(keySecret(), signed), signature as string)) {
        throw new AppError("We couldn't confirm this payment. If money was taken, it will be applied or refunded automatically.", 400);
    }
    if (status !== "paid") throw new AppError("The payment wasn't completed. You haven't been charged.", 400);
    await applyPayment(linkId as string, paymentId as string);
    return billingSummary(userId);
};

/** Razorpay webhook (raw body, signed with the webhook secret). */
export const handleWebhook = async (rawBody: Buffer, signature: string | undefined) => {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret || !signature || !safeEqual(hmac(secret, rawBody), signature)) {
        throw new AppError("Invalid signature", 400);
    }
    const event = JSON.parse(rawBody.toString("utf8")) as {
        event?: string;
        payload?: {
            payment_link?: { entity?: { id?: string } };
            payment?: { entity?: { id?: string } };
        };
    };
    const linkId = event.payload?.payment_link?.entity?.id;
    const paymentId = event.payload?.payment?.entity?.id;
    if (!linkId) return;
    if (event.event === "payment_link.paid" && paymentId) await applyPayment(linkId, paymentId);
    else if (event.event === "payment_link.expired" || event.event === "payment_link.cancelled") {
        await Payment.updateOne({ linkId, status: "created" }, { $set: { status: "failed" } });
    }
};

/** The user's plan and paid payments, for the Billing settings. */
export const billingSummary = async (userId: Id) => {
    const [current, payments] = await Promise.all([
        activePlan(userId),
        Payment.find({ user: userId, status: "paid" })
            .sort({ paidAt: -1 })
            .limit(50)
            .select("plan period amount currency paymentId paidAt validUntil")
            .lean(),
    ]);
    return { plan: current.plan, expiresAt: current.expiresAt, admin: current.admin, payments };
};

/** Public plan list for the pricing page. */
export const publicPlans = () => ({
    enabled: billingEnabled(),
    plans: Object.values(PLANS).map(({ route: _route, thinkingBudget: _budget, ...p }) => p),
});
