import type { Request, Response } from "express";
import catchAsync from "../utils/catchAsync.js";
import * as billing from "../services/billing.service.js";
import { quotaStatus } from "../services/aiQuota.service.js";

export const getPlans = (_req: Request, res: Response) => {
    res.status(200).json(billing.publicPlans());
};

export const getMine = catchAsync(async (req, res) => {
    const [summary, usage] = await Promise.all([
        billing.billingSummary(req.user!._id),
        quotaStatus(req.user!._id, "vex"),
    ]);
    res.status(200).json({ ...summary, usage, enabled: billing.billingEnabled() });
});

export const createCheckout = catchAsync(async (req, res) => {
    res.status(201).json(await billing.createCheckout(req.user!._id, req.body?.plan, req.body?.period));
});

export const verifyPayment = catchAsync(async (req, res) => {
    res.status(200).json(await billing.verifyPayment(req.user!._id, req.body ?? {}));
});

/** Mounted with express.raw: the signature covers the exact bytes. */
export const webhook = catchAsync(async (req, res) => {
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from("");
    await billing.handleWebhook(body, req.get("x-razorpay-signature"));
    res.status(200).json({ ok: true });
});
