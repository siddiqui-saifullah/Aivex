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
  kind?: "plan" | "seats";
  seats?: number;
  institute?: string;
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
  /** Set when the plan comes from a teacher's institute seats. */
  institute: { institute: string; teacher: string; expiresAt: string } | null;
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
  const { data } = await axios.post<Omit<BillingSummary, "usage" | "enabled"> & {
    paid: { kind: "plan" | "seats"; seats: number; validUntil: string | null } | null;
  }>("/billing/verify", params);
  return data;
};

export const formatInr = (rupees: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(rupees);

/* -------------------------------------------------------------------------- */
/* INSTITUTE                                                                  */
/* -------------------------------------------------------------------------- */
export interface InstituteSummary {
  price: { monthly: number; yearly: number };
  minSeats: number;
  maxSeats: number;
  enabled: boolean;
  /** Seats valid right now. */
  capacity: number;
  packs: { _id: string; institute: string; seats: number; validUntil: string; active: boolean; source: "payment" | "admin" }[];
  /** Students holding seats, in order; the first `capacity` are covered. */
  students: { _id: string; name: string; username: string; covered: boolean }[];
}

/** The public institute price (shown before signing in). */
export const INSTITUTE_PRICE = { monthly: 49, yearly: 399, minSeats: 20 };

export const getInstitute = async () => {
  const { data } = await axios.get<InstituteSummary>("/billing/institute");
  return data;
};

export const startSeatCheckout = async (body: { seats: number; period: BillingPeriod; institute: string }) => {
  const { data } = await axios.post<{ url: string }>("/billing/institute/checkout", body);
  window.location.assign(data.url);
};

export const sendInstituteInquiry = async (body: { name: string; email: string; institute: string; students: number; message: string }) => {
  await axios.post("/billing/institute/inquiry", body);
};
