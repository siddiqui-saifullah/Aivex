import axios from "../config/axios";
import type { AiUsage } from "./ai.service";

export type PlanId = "free" | "student" | "pro" | "premium";
export type BillingPeriod = "monthly" | "yearly";

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  /** In rupees. */
  price: { monthly: number; yearly: number };
  vexPerDay: number | null;
  enhancePerDay: number | null;
  features: string[];
}

export interface PaymentRecord {
  _id: string;
  plan: PlanId;
  period: BillingPeriod;
  /** In paise. */
  amount: number;
  currency: string;
  paymentId: string;
  paidAt: string;
  validUntil: string | null;
}

export interface BillingSummary {
  plan: PlanId;
  expiresAt: string | null;
  admin: boolean;
  enabled: boolean;
  usage: AiUsage;
  payments: PaymentRecord[];
}

export const getPlans = async () => {
  const { data } = await axios.get<{ enabled: boolean; plans: Plan[] }>("/billing/plans");
  return data;
};

export const getBilling = async () => {
  const { data } = await axios.get<BillingSummary>("/billing/me");
  return data;
};

/** Sends the browser to Razorpay's payment page; it comes back to /settings/billing. */
export const startCheckout = async (plan: PlanId, period: BillingPeriod) => {
  const { data } = await axios.post<{ url: string }>("/billing/checkout", { plan, period });
  window.location.assign(data.url);
};

/** Confirms the payment Razorpay redirected back with (its query parameters). */
export const verifyPayment = async (params: Record<string, string>) => {
  const { data } = await axios.post<Omit<BillingSummary, "usage" | "enabled">>("/billing/verify", params);
  return data;
};

export const formatInr = (rupees: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(rupees);
