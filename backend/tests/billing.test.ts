import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import request from "supertest";
import { ADMIN_EMAIL, as, canRun, createUser, setup, teardown, type TestUser } from "./helpers.js";

const SECRET = "rzp_test_secret";
const WEBHOOK_SECRET = "whsec_test";
const sign = (data: string, secret = SECRET) => crypto.createHmac("sha256", secret).update(data).digest("hex");

describe("subscriptions", { skip: !canRun && "set TEST_MONGO_URL to run API tests" }, () => {
    let app: Awaited<ReturnType<typeof setup>>;
    let user: TestUser;
    let mock: http.Server;
    const links: { amount: number; reference_id: string; callback_url: string; notes: Record<string, string> }[] = [];
    let n = 0;

    before(async () => {
        delete process.env.VEX_DAILY_LIMIT;
        process.env.FRONTEND_URL = "http://app.test";
        // A stand-in for Razorpay's Payment Links API
        mock = http.createServer((req, res) => {
            let body = "";
            req.on("data", (c) => (body += c));
            req.on("end", () => {
                const auth = Buffer.from(String(req.headers.authorization).split(" ")[1], "base64").toString();
                if (auth !== `rzp_test_key:${SECRET}`) { res.writeHead(401).end("{}"); return; }
                if (req.url !== "/v1/payment_links") { res.writeHead(404).end("{}"); return; }
                const data = JSON.parse(body);
                links.push(data);
                res.writeHead(200, { "Content-Type": "application/json" });
                const id = `plink_${++n}`;
                res.end(JSON.stringify({ id, short_url: `https://rzp.io/i/${id}` }));
            });
        }).listen(0);
        process.env.RAZORPAY_API_BASE = `http://127.0.0.1:${(mock.address() as AddressInfo).port}`;
        process.env.RAZORPAY_KEY_ID = "rzp_test_key";
        process.env.RAZORPAY_KEY_SECRET = SECRET;
        process.env.RAZORPAY_WEBHOOK_SECRET = WEBHOOK_SECRET;
        app = await setup();
        user = await createUser();
    });
    after(async () => {
        mock.close();
        await teardown();
    });

    /** What Razorpay adds to the callback URL after a payment. */
    const callback = (linkId: string, reference: string, status = "paid", secret = SECRET) => {
        const paymentId = `pay_${linkId}`;
        return {
            razorpay_payment_id: paymentId,
            razorpay_payment_link_id: linkId,
            razorpay_payment_link_reference_id: reference,
            razorpay_payment_link_status: status,
            razorpay_signature: sign(`${linkId}|${reference}|${status}|${paymentId}`, secret),
        };
    };

    const checkout = async (who: TestUser, plan: string, period: string) => {
        const res = await as(who).post("/billing/checkout", { plan, period });
        assert.equal(res.status, 201, JSON.stringify(res.body));
        const linkId = res.body.url.split("/").pop();
        return { res, linkId, link: links.at(-1)! };
    };

    const buy = async (who: TestUser, plan: string, period: string) => {
        const { linkId, link } = await checkout(who, plan, period);
        const res = await as(who).post("/billing/verify", callback(linkId, link.reference_id));
        return { link, res };
    };

    it("lists the four plans publicly", async () => {
        const res = await request(app).get("/billing/plans");
        assert.equal(res.status, 200);
        assert.equal(res.body.enabled, true);
        assert.deepEqual(res.body.plans.map((p: { id: string }) => p.id), ["free", "student", "pro", "premium"]);
        assert.equal(res.body.plans[1].price.monthly, 99);
        assert.equal(res.body.plans[0].models, undefined);
    });

    it("everyone starts on Free with 3 questions a day", async () => {
        const res = await as(user).get("/billing/me");
        assert.equal(res.body.plan, "free");
        assert.equal(res.body.usage.limit, 3);
    });

    it("checks plan and period", async () => {
        assert.equal((await as(user).post("/billing/checkout", { plan: "gold", period: "monthly" })).status, 400);
        assert.equal((await as(user).post("/billing/checkout", { plan: "pro", period: "weekly" })).status, 400);
    });

    it("a forged signature doesn't activate a plan", async () => {
        const { linkId, link } = await checkout(user, "pro", "monthly");
        assert.equal((await as(user).post("/billing/verify", callback(linkId, link.reference_id, "paid", "wrong"))).status, 400);
        // Not paid (signed correctly, but the status says so)
        const unpaid = await as(user).post("/billing/verify", callback(linkId, link.reference_id, "partially_paid"));
        assert.equal(unpaid.status, 400);
        assert.equal((await as(user).get("/billing/me")).body.plan, "free");
    });

    it("someone else's order can't be confirmed", async () => {
        const other = await createUser();
        const { linkId, link } = await checkout(user, "pro", "monthly");
        const res = await as(other).post("/billing/verify", callback(linkId, link.reference_id));
        assert.equal(res.status, 404);
    });

    it("paying for Student raises the limit to 30 a day for 30 days", async () => {
        const { link, res } = await buy(user, "student", "monthly");
        assert.equal(link.amount, 9900);
        assert.equal(link.notes.plan, "student");
        assert.equal(link.callback_url, "http://app.test/settings/billing");
        assert.equal(res.status, 200);
        assert.equal(res.body.plan, "student");
        const days = (new Date(res.body.expiresAt).getTime() - Date.now()) / 86_400_000;
        assert.ok(days > 29.9 && days <= 30);
        assert.equal(res.body.payments.length, 1);
        assert.equal((await as(user).get("/ai/usage")).body.limit, 30);
    });

    it("confirming the same payment twice only counts once", async () => {
        const me = (await as(user).get("/billing/me")).body;
        const link = links.at(-1)!;
        const again = await as(user).post("/billing/verify", callback(`plink_${n}`, link.reference_id));
        assert.equal(again.status, 200);
        assert.equal(again.body.expiresAt, me.expiresAt);
        assert.equal(again.body.payments.length, 1);
    });

    it("upgrading keeps the value of the unused days", async () => {
        const { res } = await buy(user, "pro", "yearly");
        assert.equal(res.body.plan, "pro");
        // 365 days + ~30 Student days worth 99/299 of Pro (~9.9 days)
        const days = (new Date(res.body.expiresAt).getTime() - Date.now()) / 86_400_000;
        assert.ok(days > 374 && days < 375.5, String(days));
        assert.equal((await as(user).get("/ai/usage")).body.limit, 100);
    });

    it("can't buy a smaller plan while a bigger one is active", async () => {
        const res = await as(user).post("/billing/checkout", { plan: "student", period: "monthly" });
        assert.equal(res.status, 400);
        assert.match(res.body.message, /You're on Pro/);
    });

    it("the webhook applies a payment whose browser closed", async () => {
        const buyer = await createUser();
        const { linkId } = await checkout(buyer, "premium", "monthly");
        const body = JSON.stringify({ event: "payment_link.paid", payload: { payment_link: { entity: { id: linkId } }, payment: { entity: { id: "pay_hook" } } } });
        const bad = await request(app).post("/billing/webhook").set("Content-Type", "application/json").set("X-Razorpay-Signature", sign(body, "nope")).send(body);
        assert.equal(bad.status, 400);
        assert.equal((await as(buyer).get("/billing/me")).body.plan, "free");
        const ok = await request(app).post("/billing/webhook").set("Content-Type", "application/json").set("X-Razorpay-Signature", sign(body, WEBHOOK_SECRET)).send(body);
        assert.equal(ok.status, 200);
        const me = (await as(buyer).get("/billing/me")).body;
        assert.equal(me.plan, "premium");
        assert.equal(me.usage.limit, 400);
    });

    it("an expired plan falls back to Free", async () => {
        const User = (await import("../models/user.model.js")).default;
        await User.updateOne({ _id: user.id }, { planExpiresAt: new Date(Date.now() - 1000) });
        const me = (await as(user).get("/billing/me")).body;
        assert.equal(me.plan, "free");
        assert.equal(me.usage.limit, 3);
    });

    it("the limit message suggests upgrading", async () => {
        const quota = await import("../services/aiQuota.service.js");
        const status = await quota.quotaStatus(user.id, "vex");
        assert.match(quota.quotaMessage("vex", status), /Upgrade your plan/);
    });

    it("admins stay unlimited", async () => {
        const admin = await createUser(ADMIN_EMAIL);
        assert.equal((await as(admin).get("/ai/usage")).body.limit, null);
    });
});
