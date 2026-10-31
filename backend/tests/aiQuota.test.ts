import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { ADMIN_EMAIL, as, canRun, createUser, setup, teardown, type TestUser } from "./helpers.js";

describe("daily Vex allowance", { skip: !canRun && "set TEST_MONGO_URL to run API tests" }, () => {
    let user: TestUser;
    let admin: TestUser;
    let quota: typeof import("../services/aiQuota.service.js");

    before(async () => {
        delete process.env.VEX_DAILY_LIMIT;
        await setup();
        quota = await import("../services/aiQuota.service.js");
        [user, admin] = await Promise.all([createUser(), createUser(ADMIN_EMAIL)]);
    });
    after(teardown);

    it("starts at 3 questions a day, resetting at the next midnight", async () => {
        const res = await as(user).get("/ai/usage");
        assert.equal(res.status, 200);
        assert.equal(res.body.limit, 3);
        assert.equal(res.body.remaining, 3);
        const resetsIn = new Date(res.body.resetsAt).getTime() - Date.now();
        assert.ok(resetsIn > 0 && resetsIn <= 86_400_000);
    });

    it("the 4th question of the day is refused", async () => {
        for (let i = 0; i < 3; i++) assert.ok(await quota.takeQuota(user.id, "vex"));
        assert.equal(await quota.takeQuota(user.id, "vex"), null);
        assert.equal((await as(user).get("/ai/usage")).body.remaining, 0);
    });

    it("the open AI endpoint is limited too", async () => {
        const res = await as(user).get("/ai/result?prompt=hello");
        assert.equal(res.status, 429);
        assert.match(res.body.message, /used all 3 Vex AI questions/);
    });

    it("a failed answer gives the question back", async () => {
        const other = await createUser();
        const refund = await quota.takeQuota(other.id, "vex");
        assert.ok(refund);
        refund();
        refund(); // only once
        assert.equal((await quota.quotaStatus(other.id, "vex")).used, 0);
    });

    it("prompt improvements have their own allowance", async () => {
        assert.equal((await quota.quotaStatus(user.id, "enhance")).remaining, 5);
    });

    it("admins aren't limited", async () => {
        for (let i = 0; i < 5; i++) assert.ok(await quota.takeQuota(admin.id, "vex"));
        assert.equal((await as(admin).get("/ai/usage")).body.limit, null);
    });
});
