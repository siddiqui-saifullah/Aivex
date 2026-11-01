import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { as, canRun, createUser, setup, teardown, type TestUser } from "./helpers.js";

describe("coding journey", { skip: !canRun && "set TEST_MONGO_URL to run API tests" }, () => {
    let teacher: TestUser;
    let student: TestUser;
    let classmate: TestUser;
    let classId: string;
    let assignmentId: string;
    let workId: string;
    const journey = (who: TestUser, studentId = student.id) => as(who).get(`/assignments/${assignmentId}/journey/${studentId}`);
    // Recording happens after the response; give it a moment
    const settle = () => new Promise((r) => setTimeout(r, 150));

    before(async () => {
        await setup();
        [teacher, student, classmate] = await Promise.all([createUser(), createUser(), createUser()]);
        const cls = await as(teacher).post("/classrooms", { name: "Journey 101", stack: "c" });
        classId = cls.body._id;
        await as(student).post("/classrooms/join", { code: cls.body.code });
        await as(classmate).post("/classrooms/join", { code: cls.body.code });
        assignmentId = (await as(teacher).post(`/classrooms/${classId}/assignments`, { title: "Sum" })).body._id;
        workId = (await as(student).post(`/assignments/${assignmentId}/start`)).body.projectId;
    });
    after(teardown);

    it("records saves with line counts, and a snapshot at most once a minute", async () => {
        await as(student).patch(`/projects/${workId}`, { fileTree: { "main.c": "int main() {\n  return 0;\n}\n" } });
        await settle();
        await as(student).patch(`/projects/${workId}`, { fileTree: { "main.c": "int main() {\n  int a = 1;\n  return a;\n}\n" } });
        await settle();
        const res = await journey(student);
        assert.equal(res.status, 200);
        const saves = res.body.timeline.filter((e: { type: string }) => e.type === "save");
        assert.equal(saves.length, 2);
        assert.deepEqual(saves[1].files, ["main.c"]);
        assert.equal(saves[1].added, 2);
        assert.equal(saves[1].removed, 1);
        assert.equal(saves[0].hasSnapshot, true);
        assert.equal(saves[1].hasSnapshot, false);
        assert.equal(res.body.summary.saves, 2);
    });

    it("saving the same files again records nothing", async () => {
        await as(student).patch(`/projects/${workId}`, { fileTree: { "main.c": "int main() {\n  int a = 1;\n  return a;\n}\n" } });
        await settle();
        assert.equal((await journey(student)).body.summary.saves, 2);
    });

    it("records runs reported by the browser", async () => {
        assert.equal((await as(student).post(`/projects/${workId}/journey/run`, { ok: "yes" })).status, 400);
        const bad = await as(student).post(`/projects/${workId}/journey/run`, { ok: false, message: "main.c:2: error: expected ';'" });
        assert.equal(bad.body.recorded, true);
        await as(student).post(`/projects/${workId}/journey/run`, { ok: true });
        const s = (await journey(student)).body.summary;
        assert.equal(s.runs, 2);
        assert.equal(s.failedRuns, 1);
    });

    it("doesn't record anything for personal projects", async () => {
        const mine = await as(student).post("/projects", { name: `Mine ${Date.now()}`, stack: "c" });
        const id = mine.body._id ?? mine.body.project?._id;
        assert.equal((await as(student).post(`/projects/${id}/journey/run`, { ok: true })).body.recorded, false);
    });

    it("the teacher's own edits are shown but not counted as the student's work", async () => {
        await as(teacher).patch(`/projects/${workId}`, { fileTree: { "main.c": "// hint: read two numbers\nint main() {\n  int a = 1;\n  return a;\n}\n" } });
        await settle();
        const res = await journey(teacher);
        const teacherSave = res.body.timeline.find((e: { byTeacher: boolean }) => e.byTeacher);
        assert.ok(teacherSave);
        assert.equal(res.body.summary.saves, 2);
        assert.equal(res.body.viewer, "teacher");
    });

    it("hand-ins appear on the timeline", async () => {
        await as(student).post(`/assignments/${assignmentId}/submit`);
        const res = await journey(teacher);
        assert.equal(res.body.summary.submissions, 1);
        assert.ok(res.body.timeline.some((e: { type: string }) => e.type === "submit"));
    });

    it("only the student and the teacher can see it", async () => {
        assert.equal((await journey(classmate)).status, 404);
        assert.equal((await journey(student, classmate.id)).status, 404);
        assert.equal((await journey(teacher, classmate.id)).status, 200);
    });

    it("snapshots replay the code at that moment", async () => {
        const first = (await journey(teacher)).body.timeline.find((e: { hasSnapshot: boolean }) => e.hasSnapshot);
        const snap = await as(teacher).get(`/assignments/${assignmentId}/journey/${student.id}/snapshots/${first._id}`);
        assert.equal(snap.status, 200);
        assert.equal(snap.body.files["main.c"], "int main() {\n  return 0;\n}\n");
        assert.equal(snap.body.previous, null);
        assert.equal((await as(classmate).get(`/assignments/${assignmentId}/journey/${student.id}/snapshots/${first._id}`)).status, 404);
    });

    it("leaving the class removes the journey", async () => {
        assert.equal((await as(student).post(`/classrooms/${classId}/leave`)).status, 204);
        // The assignment is still the teacher's; the student's steps are gone
        const res = await journey(teacher);
        assert.equal(res.body.timeline.filter((e: { type: string }) => e.type !== "submit").length, 0);
    });
});
