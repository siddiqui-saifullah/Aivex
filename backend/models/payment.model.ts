import mongoose, { type Types } from "mongoose";
import { PLAN_IDS, type BillingPeriod, type PaidPlanId } from "../config/plans.js";

/** One Razorpay payment link for a plan, and whether it was paid. */
export interface IPayment {
    user: Types.ObjectId;
    plan: PaidPlanId;
    period: BillingPeriod;
    /** In paise. */
    amount: number;
    currency: string;
    /** Razorpay payment link id (plink_...). */
    linkId: string;
    /** Our reference on the link (unique). */
    reference: string;
    paymentId: string;
    status: "created" | "paid" | "failed";
    paidAt: Date | null;
    /** The plan's new end date once this payment was applied. */
    validUntil: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

const paymentSchema = new mongoose.Schema<IPayment>(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
        plan: { type: String, enum: PLAN_IDS.filter((p) => p !== "free"), required: true },
        period: { type: String, enum: ["monthly", "yearly"], required: true },
        amount: { type: Number, required: true },
        currency: { type: String, default: "INR" },
        linkId: { type: String, required: true, unique: true },
        reference: { type: String, required: true },
        paymentId: { type: String, default: "" },
        status: { type: String, enum: ["created", "paid", "failed"], default: "created" },
        paidAt: { type: Date, default: null },
        validUntil: { type: Date, default: null },
    },
    { timestamps: true },
);

const Payment = mongoose.model<IPayment>("Payment", paymentSchema);
export default Payment;
