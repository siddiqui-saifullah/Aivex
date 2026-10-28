import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { ADMIN_EMAIL, as, canRun, createUser, setup, teardown, type TestUser } from "./helpers.js";

describe("reports and moderation", { skip: !canRun && "set TEST_MONGO_URL to run API tests" }, () => {
    let admin: TestUser;
    let alice: TestUser;
    let bob: TestUser;
    let projectId: string;

    before(async () => {
        await setup();
        [admin, alice, bob] = await Promise.all([createUser(ADMIN_EMAIL), createUser(), createUser()]);
        const res = await as(alice).post("/projects", { name: `Reports ${Date.now()}`, stack: "c" });
        projectId = res.body._id ?? res.body.project?._id;
    });
    after(teardown);

    describe("bug reports", () => {
        it("need a title and description", async () => {
            assert.equal((await as(alice).post("/projects/general/issues", { title: "x" })).status, 400);
        });

        it("can be sent from a project you're in, not from someone else's", async () => {
            const ok = await as(alice).post(`/projects/${projectId}/issues`, { title: "Run is stuck", description: "Spins forever", type: "bug" });
            assert.equal(ok.status, 201);
            const denied = await as(bob).post(`/projects/${projectId}/issues`, { title: "x", description: "y" });
            assert.equal(denied.status, 404);
        });

        it("the admin answers and the reporter is told", async () => {
            const list = await as(admin).get("/admin/issues");
            assert.equal(list.status, 200);
            const issue = list.body.items[0];
            const res = await as(admin).patch(`/admin/issues/${issue._id}`, { status: "resolved", reply: "Fixed" });
            assert.equal(res.body.status, "resolved");
            const notes = await as(alice).get("/notifications");
            const all = Array.isArray(notes.body) ? notes.body : notes.body.notifications ?? notes.body.items ?? [];
            assert.ok(all.some((n: { type: string }) => n.type === "report-update"));
        });
    });

    describe("abuse reports", () => {
        it("check the reason, the target and the reporter", async () => {
            assert.equal((await as(alice).post("/reports", { targetType: "user", targetId: bob.id, reason: "nope" })).status, 400);
            assert.equal((await as(alice).post("/reports", { targetType: "user", targetId: alice.id, reason: "spam" })).status, 400);
            assert.equal((await as(alice).post("/reports", { targetType: "user", targetId: bob.id, reason: "other" })).status, 400);
            // Bob isn't in Alice's project, so he can't see (or report) it
            assert.equal((await as(bob).post("/reports", { targetType: "project", targetId: projectId, reason: "spam" })).status, 404);
        });

        it("one open report per person and target", async () => {
            const first = await as(alice).post("/reports", { targetType: "user", targetId: bob.id, reason: "harassment" });
            assert.equal(first.status, 201);
            const again = await as(alice).post("/reports", { targetType: "user", targetId: bob.id, reason: "spam" });
            assert.equal(again.status, 409);
        });

        it("are admin-only to list and act on", async () => {
            assert.equal((await as(alice).get("/admin/reports")).status, 404);
            assert.equal((await as(alice).patch(`/admin/users/${bob.id}/suspension`, { suspended: true })).status, 404);
        });

        it("suspending blocks the account everywhere until it is lifted", async () => {
            const list = await as(admin).get("/admin/reports");
            const report = list.body.items.find((r: { target: string }) => r.target === bob.id);
            const res = await as(admin).patch(`/admin/reports/${report._id}`, { action: "user-suspended", note: "test" });
            assert.equal(res.status, 200);

            const blocked = await as(bob).get("/users/profile");
            assert.equal(blocked.status, 403);
            assert.equal(blocked.body.code, "ACCOUNT_SUSPENDED");
            assert.equal((await as(admin).get("/admin/reports")).body.open, 0);

            await as(admin).patch(`/admin/users/${bob.id}/suspension`, { suspended: false });
            assert.equal((await as(bob).get("/users/profile")).status, 200);
        });

        it("admins can't suspend themselves", async () => {
            assert.equal((await as(admin).patch(`/admin/users/${admin.id}/suspension`, { suspended: true })).status, 400);
        });
    });
});
