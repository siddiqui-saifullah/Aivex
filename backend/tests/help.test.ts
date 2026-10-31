import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { as, canRun, createUser, setup, teardown, type TestUser } from "./helpers.js";

describe("help requests", { skip: !canRun && "set TEST_MONGO_URL to run API tests" }, () => {
    let teacher: TestUser;
    let student: TestUser;
    let stranger: TestUser;
    let classId: string;
    let projectId: string;
    let requestId: string;

    before(async () => {
        await setup();
        [teacher, student, stranger] = await Promise.all([createUser(), createUser(), createUser()]);
        const cls = await as(teacher).post("/classrooms", { name: "Help 101", stack: "c" });
        classId = cls.body._id;
        projectId = (await as(student).post("/classrooms/join", { code: cls.body.code })).body.projectId;
    });
    after(teardown);

    it("only a student's own class project can ask", async () => {
        assert.equal((await as(stranger).post("/classrooms/help", { projectId })).status, 404);
        const personal = await as(student).post("/projects", { name: `Mine ${Date.now()}`, stack: "c" });
        const personalId = personal.body._id ?? personal.body.project?._id;
        assert.equal((await as(student).post("/classrooms/help", { projectId: personalId })).status, 400);
    });

    it("asking notifies the teacher; asking again doesn't duplicate", async () => {
        const res = await as(student).post("/classrooms/help", { projectId, message: "My loop never stops" });
        assert.equal(res.status, 201);
        assert.equal(res.body.alreadyOpen, false);
        requestId = res.body._id;
        const again = await as(student).post("/classrooms/help", { projectId });
        assert.equal(again.body.alreadyOpen, true);
        assert.equal(again.body._id, requestId);

        const notes = await as(teacher).get("/notifications");
        const all = Array.isArray(notes.body) ? notes.body : notes.body.notifications ?? notes.body.items ?? [];
        assert.ok(all.some((n: { type: string }) => n.type === "help-request"));
        assert.equal((await as(student).get(`/projects/${projectId}`)).body.project.helpRequest._id, requestId);
    });

    it("the teacher sees open requests; nobody else does", async () => {
        const list = await as(teacher).get(`/classrooms/${classId}/help`);
        assert.equal(list.status, 200);
        assert.equal(list.body.length, 1);
        assert.equal(list.body[0].message, "My loop never stops");
        assert.equal((await as(student).get(`/classrooms/${classId}/help`)).status, 403);
    });

    it("the teacher resolves it", async () => {
        assert.equal((await as(stranger).patch(`/classrooms/help/${requestId}/resolve`)).status, 404);
        assert.equal((await as(teacher).patch(`/classrooms/help/${requestId}/resolve`)).status, 200);
        assert.equal((await as(teacher).get(`/classrooms/${classId}/help`)).body.length, 0);
        assert.equal((await as(student).get(`/projects/${projectId}`)).body.project.helpRequest, null);
    });

    it("the student can withdraw their own request", async () => {
        const res = await as(student).post("/classrooms/help", { projectId });
        assert.equal((await as(student).patch(`/classrooms/help/${res.body._id}/resolve`)).status, 200);
    });
});
