import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { as, canRun, createUser, setup, teardown, type TestUser } from "./helpers.js";

describe("assignments", { skip: !canRun && "set TEST_MONGO_URL to run API tests" }, () => {
    let teacher: TestUser;
    let student: TestUser;
    let other: TestUser;
    let stranger: TestUser;
    let classId: string;
    let code: string;
    let templateId: string;
    let assignmentId: string;
    let workId: string;

    before(async () => {
        await setup();
        [teacher, student, other, stranger] = await Promise.all([createUser(), createUser(), createUser(), createUser()]);
        const cls = await as(teacher).post("/classrooms", { name: "Assignments 101", stack: "c" });
        classId = cls.body._id;
        code = cls.body.code;
        await as(student).post("/classrooms/join", { code });
        await as(other).post("/classrooms/join", { code });
        const template = await as(teacher).post("/projects", { name: `Loops starter ${Date.now()}`, stack: "c" });
        templateId = template.body._id ?? template.body.project?._id;
        const saved = await as(teacher).patch(`/projects/${templateId}`, { fileTree: { "main.c": "// TODO: print 1..10\n" } });
        assert.equal(saved.status, 204);
    });
    after(teardown);

    describe("creating", () => {
        it("is for the teacher only, with a title and a valid AI rule", async () => {
            assert.equal((await as(student).post(`/classrooms/${classId}/assignments`, { title: "x" })).status, 403);
            assert.equal((await as(stranger).post(`/classrooms/${classId}/assignments`, { title: "x" })).status, 403);
            assert.equal((await as(teacher).post(`/classrooms/${classId}/assignments`, { title: " " })).status, 400);
            assert.equal((await as(teacher).post(`/classrooms/${classId}/assignments`, { title: "x", aiPolicy: "all" })).status, 400);
            assert.equal((await as(teacher).post(`/classrooms/${classId}/assignments`, { title: "x", dueAt: "soon" })).status, 400);
        });

        it("can use one of the teacher's projects as starter code", async () => {
            const due = new Date(Date.now() + 86_400_000).toISOString();
            const res = await as(teacher).post(`/classrooms/${classId}/assignments`, {
                title: "Loops",
                instructions: "Print the numbers 1 to 10.",
                dueAt: due,
                aiPolicy: "hints",
                templateProjectId: templateId,
            });
            assert.equal(res.status, 201);
            assert.equal(res.body.aiPolicy, "hints");
            assert.equal(new Date(res.body.dueAt).toISOString(), due);
            assignmentId = res.body._id;
        });

        it("can't copy someone else's project", async () => {
            const theirs = await as(stranger).post("/projects", { name: `Not yours ${Date.now()}`, stack: "c" });
            const res = await as(teacher).post(`/classrooms/${classId}/assignments`, {
                title: "Steal",
                templateProjectId: theirs.body._id ?? theirs.body.project?._id,
            });
            assert.equal(res.status, 404);
        });

        it("tells the students", async () => {
            const notes = await as(student).get("/notifications");
            const all = Array.isArray(notes.body) ? notes.body : notes.body.notifications ?? notes.body.items ?? [];
            assert.ok(all.some((n: { type: string }) => n.type === "assignment"));
        });
    });

    describe("students", () => {
        it("see the class's assignments, outsiders don't", async () => {
            const list = await as(student).get(`/classrooms/${classId}/assignments`);
            assert.equal(list.status, 200);
            assert.equal(list.body[0].projectId, null);
            assert.equal((await as(stranger).get(`/classrooms/${classId}/assignments`)).status, 403);
            assert.equal((await as(stranger).get(`/assignments/${assignmentId}`)).status, 403);
            assert.equal((await as(stranger).post(`/assignments/${assignmentId}/start`)).status, 403);
        });

        it("starting gives them their own copy of the starter code, shared with the teacher", async () => {
            const res = await as(student).post(`/assignments/${assignmentId}/start`);
            assert.equal(res.status, 200);
            workId = res.body.projectId;
            const project = await as(student).get(`/projects/${workId}`);
            assert.equal(project.body.project.files["main.c"], "// TODO: print 1..10\n");
            assert.equal(project.body.project.assignment.title, "Loops");
            assert.equal((await as(teacher).get(`/projects/${workId}`)).status, 200);
            assert.equal((await as(other).get(`/projects/${workId}`)).status, 404);
        });

        it("starting again (or twice at once) opens the same project", async () => {
            const again = await as(student).post(`/assignments/${assignmentId}/start`);
            assert.equal(String(again.body.projectId), String(workId));
            const [a, b] = await Promise.all([
                as(other).post(`/assignments/${assignmentId}/start`),
                as(other).post(`/assignments/${assignmentId}/start`),
            ]);
            assert.equal(String(a.body.projectId), String(b.body.projectId));
        });

        it("the teacher can't start it, and sees who started", async () => {
            assert.equal((await as(teacher).post(`/assignments/${assignmentId}/start`)).status, 400);
            const res = await as(teacher).get(`/assignments/${assignmentId}`);
            const started = res.body.students.filter((s: { projectId: string | null }) => s.projectId);
            assert.equal(res.body.students.length, 2);
            assert.equal(started.length, 2);
            const list = await as(teacher).get(`/classrooms/${classId}/assignments`);
            assert.equal(list.body.find((a: { _id: string }) => a._id === assignmentId).started, 2);
        });

        it("class work stays out of the student's way: no invites to it", async () => {
            assert.equal((await as(student).patch(`/projects/${workId}/invite`, { users: [stranger.id] })).status, 403);
        });
    });

    describe("AI rule", () => {
        it("hints for the student, full AI for the teacher", async () => {
            assert.equal((await as(student).get(`/projects/${workId}`)).body.project.aiPolicy, "hints");
            assert.equal((await as(teacher).get(`/projects/${workId}`)).body.project.aiPolicy, "allowed");
        });

        it("disabled blocks the student on the server", async () => {
            assert.equal((await as(teacher).patch(`/assignments/${assignmentId}`, { aiPolicy: "disabled" })).status, 200);
            const project = await as(student).get(`/projects/${workId}`);
            assert.equal(project.body.project.aiDisabled, true);
            assert.equal((await as(student).post("/ai/enhance", { prompt: "do it", projectId: workId })).status, 403);
        });

        it("turning AI off for the class wins over an assignment that allows it", async () => {
            await as(teacher).patch(`/assignments/${assignmentId}`, { aiPolicy: "allowed" });
            await as(teacher).patch(`/classrooms/${classId}`, { aiEnabled: false });
            assert.equal((await as(student).get(`/projects/${workId}`)).body.project.aiPolicy, "disabled");
            await as(teacher).patch(`/classrooms/${classId}`, { aiEnabled: true });
            assert.equal((await as(student).get(`/projects/${workId}`)).body.project.aiPolicy, "allowed");
        });

        it("only the teacher edits the assignment", async () => {
            assert.equal((await as(student).patch(`/assignments/${assignmentId}`, { aiPolicy: "allowed" })).status, 403);
            assert.equal((await as(teacher).patch(`/assignments/${assignmentId}`, {})).status, 400);
        });
    });

    describe("leaving and deleting", () => {
        it("a student who leaves keeps their assignment work as personal projects", async () => {
            assert.equal((await as(other).post(`/classrooms/${classId}/leave`)).status, 204);
            const list = await as(other).get("/projects");
            const mine = (Array.isArray(list.body) ? list.body : list.body.projects ?? []) as { classroom?: string | null; assignment?: string | null }[];
            assert.ok(mine.length >= 2);
            assert.ok(mine.every((p) => !p.classroom && !p.assignment));
        });

        it("deleting the assignment keeps the student's work and drops the teacher", async () => {
            assert.equal((await as(student).delete(`/assignments/${assignmentId}`)).status, 403);
            assert.equal((await as(teacher).delete(`/assignments/${assignmentId}`)).status, 204);
            assert.equal((await as(teacher).get(`/projects/${workId}`)).status, 404);
            const mine = await as(student).get(`/projects/${workId}`);
            assert.equal(mine.status, 200);
            assert.equal(mine.body.project.assignment, null);
            assert.equal((await as(student).get(`/assignments/${assignmentId}`)).status, 404);
        });

        it("deleting the class deletes its assignments", async () => {
            const a = await as(teacher).post(`/classrooms/${classId}/assignments`, { title: "Last one" });
            assert.equal((await as(teacher).delete(`/classrooms/${classId}`)).status, 204);
            assert.equal((await as(teacher).get(`/assignments/${a.body._id}`)).status, 404);
        });
    });
});
