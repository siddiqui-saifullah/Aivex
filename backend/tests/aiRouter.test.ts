import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { ADMIN_EMAIL, canRun, createUser, setup, teardown } from "./helpers.js";

/**
 * Stand-ins for Gemini and the OpenAI-style providers. Each records which
 * model was asked; `behaviour` decides how a model answers.
 */
type Behaviour = "ok" | "429" | "badjson" | "500";
const asked: string[] = [];
const behaviour = new Map<string, Behaviour>();
const ANSWER = JSON.stringify({ text: "Here you go" });

const serve = (handler: (req: http.IncomingMessage, body: string, res: http.ServerResponse) => void) =>
    new Promise<http.Server>((resolve) => {
        const server = http.createServer((req, res) => {
            let body = "";
            req.on("data", (c) => (body += c));
            req.on("end", () => handler(req, body, res));
        }).listen(0, () => resolve(server));
    });
const url = (s: http.Server) => `http://127.0.0.1:${(s.address() as AddressInfo).port}`;

const reply = (res: http.ServerResponse, model: string, ok: (text: string) => object) => {
    asked.push(model);
    const b = behaviour.get(model) ?? "ok";
    if (b === "429" || b === "500") {
        res.writeHead(Number(b), { "Content-Type": "application/json" }).end(JSON.stringify({ error: { code: Number(b), message: "nope", status: "UNAVAILABLE" } }));
        return;
    }
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(ok(b === "badjson" ? "Sure! Here is some code" : ANSWER)));
};

let servers: http.Server[] = [];
let ai: typeof import("../services/ai.service.js");

before(async () => {
    const gemini = await serve((req, _body, res) => {
        const model = decodeURIComponent(req.url!.match(/models\/([^:]+):/)?.[1] ?? "?");
        reply(res, model, (text) => ({ candidates: [{ content: { role: "model", parts: [{ text }] }, finishReason: "STOP" }] }));
    });
    const compat = (name: string) => serve((req, body, res) => {
        assert.equal(req.headers.authorization, `Bearer ${name}-key`);
        const model = `${name}:${JSON.parse(body).model}`;
        reply(res, model, (text) => ({ choices: [{ message: { role: "assistant", content: text } }] }));
    });
    const [openrouter, groq] = await Promise.all([compat("openrouter"), compat("groq")]);
    servers = [gemini, openrouter, groq];
    Object.assign(process.env, {
        GEMINI_API_KEY: "test", GEMINI_BASE_URL: url(gemini),
        OPENROUTER_API_KEY: "openrouter-key", OPENROUTER_BASE_URL: url(openrouter), OPENROUTER_FREE_MODELS: "or-a:free,or-b:free",
        GROQ_API_KEY: "groq-key", GROQ_BASE_URL: url(groq), GROQ_MODELS: "groq-a",
    });
    delete process.env.GEMINI_MODEL;
    ai = await import("../services/ai.service.js");
});
after(() => servers.forEach((s) => s.close()));
beforeEach(() => {
    asked.length = 0;
    behaviour.clear();
});

describe("AI router", () => {
    it("free route asks the free providers first", async () => {
        const res = await ai.generate({ prompt: "hi", route: ["free", "lite"] });
        assert.equal(res.text, "Here you go");
        assert.equal(res.model, "or-a:free");
        assert.deepEqual(asked, ["openrouter:or-a:free"]);
    });

    it("falls through rate limits and broken JSON to the next model", async () => {
        behaviour.set("openrouter:or-a:free", "429");
        behaviour.set("openrouter:or-b:free", "badjson");
        const res = await ai.generate({ prompt: "hi", route: ["free", "lite"] });
        assert.equal(res.model, "groq-a");
        assert.deepEqual(asked, ["openrouter:or-a:free", "openrouter:or-b:free", "groq:groq-a"]);
    });

    it("a rate-limited model is skipped for a minute", async () => {
        // or-a got a 429 in the previous test
        await ai.generate({ prompt: "hi", route: ["free"] });
        assert.equal(asked[0], "openrouter:or-b:free");
    });

    it("when every free model fails, paid Gemini answers", async () => {
        for (const m of ["openrouter:or-b:free", "groq:groq-a"]) behaviour.set(m, "500");
        const res = await ai.generate({ prompt: "hi", route: ["free", "lite"] });
        assert.equal(res.model, "gemini-2.5-flash-lite");
        assert.equal(res.text, "Here you go");
    });

    it("premium route starts with Gemini 2.5 Pro", async () => {
        const res = await ai.generate({ prompt: "hi", route: ["pro", "flash", "lite", "free"] });
        assert.equal(res.model, "gemini-2.5-pro");
    });

    it("tells the user when nothing could answer", async () => {
        for (const m of ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"]) behaviour.set(m, "500");
        const res = await ai.generate({ prompt: "hi", route: ["flash", "lite"] });
        assert.match(res.text!, /Vex AI is busy/);
        assert.equal(res.model, undefined);
    });

    it("prompt improvement uses the cheap route", async () => {
        behaviour.set("openrouter:or-b:free", "ok");
        assert.equal(await ai.enhancePrompt("make a todo app", ["free", "lite"]), ANSWER);
        assert.equal(asked[0], "openrouter:or-b:free");
    });
});

describe("plan limits and models", { skip: !canRun && "set TEST_MONGO_URL to run API tests" }, () => {
    let quota: typeof import("../services/aiQuota.service.js");
    let User: typeof import("../models/user.model.js").default;
    const onPlan = async (plan: string) => {
        const u = await createUser();
        await User.updateOne({ _id: u.id }, { plan, planExpiresAt: new Date(Date.now() + 86_400_000) });
        return u;
    };

    before(async () => {
        await setup();
        quota = await import("../services/aiQuota.service.js");
        User = (await import("../models/user.model.js")).default;
    });
    after(teardown);

    it("Free and Student get free models first, with cheap Gemini as backup", async () => {
        const free = await createUser();
        assert.deepEqual((await quota.aiOptionsFor(free.id)).route, ["free", "lite"]);
        assert.deepEqual((await quota.aiOptionsFor((await onPlan("student")).id)).route, ["free", "lite"]);
    });

    it("Pro gets Gemini Flash first with deeper thinking", async () => {
        const opts = await quota.aiOptionsFor((await onPlan("pro")).id);
        assert.deepEqual(opts.route, ["flash", "lite", "free"]);
        assert.equal(opts.thinkingBudget, 2048);
    });

    it("Premium gets 30 Gemini 2.5 Pro answers a day, then Flash", async () => {
        const u = await onPlan("premium");
        assert.equal((await quota.aiOptionsFor(u.id)).route[0], "pro");
        for (let i = 0; i < 30; i++) await quota.recordModelUse(u.id, "gemini-2.5-pro");
        await quota.recordModelUse(u.id, "gemini-2.5-flash"); // not counted
        assert.deepEqual((await quota.aiOptionsFor(u.id)).route, ["flash", "lite", "free"]);
    });

    it("Pro has a monthly fair-use limit on top of the daily one", async () => {
        const u = await onPlan("pro");
        const redis = (await import("../services/redis.service.js")).default;
        let s = await quota.quotaStatus(u.id);
        assert.equal(s.limit, 60);
        assert.equal(s.monthLimit, 1200);
        // 1,195 used earlier this month: the month runs out before the day does
        const month = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit" }).format(new Date());
        await redis.set(`ai:quota:vex-month:${u.id}:${month}`, 1195);
        s = await quota.quotaStatus(u.id);
        assert.equal(s.period, "month");
        assert.equal(s.remaining, 5);
        for (let i = 0; i < 5; i++) assert.ok(await quota.takeQuota(u.id));
        assert.equal(await quota.takeQuota(u.id), null);
        s = await quota.quotaStatus(u.id);
        assert.match(quota.quotaMessage("vex", s), /all 1200 Vex AI questions for this month/);
        // A refunded answer gives back both
        await redis.set(`ai:quota:vex-month:${u.id}:${month}`, 10);
        const refund = await quota.takeQuota(u.id);
        refund!();
        assert.equal((await quota.quotaStatus(u.id)).monthUsed, 10);
    });

    it("admins keep every model and no limit", async () => {
        const admin = await createUser(ADMIN_EMAIL);
        await User.updateOne({ email: ADMIN_EMAIL }, { plan: "premium", planExpiresAt: new Date(Date.now() + 86_400_000) });
        for (let i = 0; i < 40; i++) await quota.recordModelUse(admin.id, "gemini-2.5-pro");
        assert.equal((await quota.aiOptionsFor(admin.id)).route[0], "pro");
        assert.equal((await quota.quotaStatus(admin.id)).limit, null);
    });
});
