import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { as, canRun, createUser, setup, teardown, type TestUser } from "./helpers.js";

describe("classrooms", { skip: !canRun && "set TEST_MONGO_URL to run API tests" }, () => {
    let teacher: TestUser;
    let student: TestUser;
    let stranger: TestUser;
    let classId: string;
    let code: string;
    let projectId: string;

    before(async () => {
        await setup();
        [teacher, student, stranger] = await Promise.all([createUser(), createUser(), createUser()]);
        const res = await as(teacher).post("/classrooms", { name: "Intro to C", stack: "c" });
        assert.equal(res.status, 201);
        classId = res.body._id;
        code = res.body.code;
    });
    after(teardown);

    describe("join codes", () => {
        it("are 6 characters without look-alike letters", () => {
            assert.match(code, /^[2-9A-HJ-NP-Z]{6}$/);
            assert.doesNotMatch(code, /[01IOL]/);
        });

        it("reject a malformed or unknown code", async () => {
            assert.equal((await as(student).post("/classrooms/join", { code: "ABC" })).status, 400);
            assert.equal((await as(student).post("/classrooms/join", { code: "ZZZZZZ" })).status, 404);
        });

        it("give the student their own project, with the teacher in it", async () => {
            const res = await as(student).post("/classrooms/join", { code: code.toLowerCase() });
            assert.equal(res.status, 200);
            assert.equal(res.body.alreadyJoined, false);
            projectId = res.body.projectId;
            const project = await as(teacher).get(`/projects/${projectId}`);
            assert.equal(project.status, 200);
            assert.equal(project.body.project.classroom, classId);
        });

        it("joining twice returns the same project", async () => {
            const res = await as(student).post("/classrooms/join", { code });
            assert.equal(res.body.alreadyJoined, true);
            assert.equal(res.body.projectId, projectId);
        });

        it("the teacher can't join their own class", async () => {
            assert.equal((await as(teacher).post("/classrooms/join", { code })).status, 400);
        });

        it("one account can teach one class and study in another", async () => {
            const other = await as(student).post("/classrooms", { name: "Student-run club", stack: "c" });
            assert.equal(other.status, 201);
            const joined = await as(teacher).post("/classrooms/join", { code: other.body.code });
            assert.equal(joined.status, 200);
            const list = await as(teacher).get("/classrooms");
            const roles = Object.fromEntries(list.body.map((c: { _id: string; role: string }) => [c._id, c.role]));
            assert.equal(roles[classId], "teacher");
            assert.equal(roles[other.body._id], "student");
        });
    });

    describe("permissions", () => {
        it("outsiders can't see the class or the student's project", async () => {
            assert.equal((await as(stranger).get(`/classrooms/${classId}`)).status, 403);
            assert.equal((await as(stranger).get(`/projects/${projectId}`)).status, 404);
        });

        it("students see only their own project, not the join code or classmates", async () => {
            const res = await as(student).get(`/classrooms/${classId}`);
            assert.equal(res.status, 200);
            assert.equal(res.body.role, "student");
            assert.equal(res.body.code, undefined);
            assert.equal(res.body.students, undefined);
        });

        it("the student can't remove the teacher, hand the project over or invite others", async () => {
            assert.equal((await as(student).delete(`/projects/${projectId}/members/${teacher.id}`)).status, 403);
            assert.equal((await as(student).patch(`/projects/${projectId}/owner`, { newOwnerId: teacher.id })).status, 403);
            assert.equal((await as(student).patch(`/projects/${projectId}/invite`, { users: [stranger.id] })).status, 403);
        });

        it("the teacher can't leave a student's project or delete it", async () => {
            assert.equal((await as(teacher).patch(`/projects/${projectId}/leave`)).status, 403);
            assert.equal((await as(teacher).delete(`/projects/${projectId}`)).status, 403);
        });

        it("only the teacher changes settings, removes students or deletes the class", async () => {
            assert.equal((await as(student).patch(`/classrooms/${classId}`, { aiEnabled: false })).status, 403);
            assert.equal((await as(student).delete(`/classrooms/${classId}/students/${student.id}`)).status, 403);
            assert.equal((await as(student).delete(`/classrooms/${classId}`)).status, 403);
        });
    });

    describe("AI toggle", () => {
        it("turning it off blocks students on the server, not the teacher", async () => {
            assert.equal((await as(teacher).patch(`/classrooms/${classId}`, { aiEnabled: false })).status, 200);
            assert.equal((await as(student).get(`/projects/${projectId}`)).body.project.aiDisabled, true);
            assert.equal((await as(teacher).get(`/projects/${projectId}`)).body.project.aiDisabled, false);
            const blocked = await as(student).post("/ai/enhance", { prompt: "make a loop", projectId });
            assert.equal(blocked.status, 403);
            const teacherCall = await as(teacher).post("/ai/enhance", { prompt: "make a loop", projectId });
            assert.notEqual(teacherCall.status, 403);
        });

        it("turning it back on unblocks students", async () => {
            await as(teacher).patch(`/classrooms/${classId}`, { aiEnabled: true });
            assert.equal((await as(student).get(`/projects/${projectId}`)).body.project.aiDisabled, false);
        });

        it("rejects anything but true/false", async () => {
            assert.equal((await as(teacher).patch(`/classrooms/${classId}`, { aiEnabled: "no" })).status, 400);
        });
    });

    describe("leaving and removal", () => {
        it("a removed student keeps the project as a personal one; the teacher loses access", async () => {
            const res = await as(teacher).delete(`/classrooms/${classId}/students/${student.id}`);
            assert.equal(res.status, 204);
            assert.equal((await as(teacher).get(`/projects/${projectId}`)).status, 404);
            const mine = await as(student).get(`/projects/${projectId}`);
            assert.equal(mine.status, 200);
            assert.equal(mine.body.project.classroom, null);
            assert.equal((await as(student).get(`/classrooms/${classId}`)).status, 403);
        });

        it("a student can leave a class", async () => {
            const joined = await as(stranger).post("/classrooms/join", { code });
            assert.equal((await as(stranger).post(`/classrooms/${classId}/leave`)).status, 204);
            assert.equal((await as(teacher).get(`/projects/${joined.body.projectId}`)).status, 404);
            assert.equal((await as(stranger).get(`/projects/${joined.body.projectId}`)).status, 200);
            assert.equal((await as(stranger).post(`/classrooms/${classId}/leave`)).status, 400);
        });
    });

    describe("deleting the class", () => {
        it("students keep their projects and the teacher loses access to them", async () => {
            const late = await createUser();
            const joined = await as(late).post("/classrooms/join", { code });
            assert.equal((await as(teacher).delete(`/classrooms/${classId}`)).status, 204);
            assert.equal((await as(teacher).get(`/projects/${joined.body.projectId}`)).status, 404);
            const mine = await as(late).get(`/projects/${joined.body.projectId}`);
            assert.equal(mine.status, 200);
            assert.equal(mine.body.project.classroom, null);
            assert.equal((await as(late).post("/classrooms/join", { code })).status, 404);
        });
    });
});
