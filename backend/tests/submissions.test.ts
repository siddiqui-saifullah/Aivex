import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { as, canRun, createUser, setup, teardown, type TestUser } from "./helpers.js";

describe("submissions", { skip: !canRun && "set TEST_MONGO_URL to run API tests" }, () => {
    let teacher: TestUser;
    let student: TestUser;
    let other: TestUser;
    let classId: string;
    let assignmentId: string;
    let workId: string;
    let firstId: string;
    let secondId: string;

    before(async () => {
        await setup();
        [teacher, student, other] = await Promise.all([createUser(), createUser(), createUser()]);
        const cls = await as(teacher).post("/classrooms", { name: "Review 101", stack: "c" });
        classId = cls.body._id;
        await as(student).post("/classrooms/join", { code: cls.body.code });
        await as(other).post("/classrooms/join", { code: cls.body.code });
        const a = await as(teacher).post(`/classrooms/${classId}/assignments`, { title: "Sum", maxMarks: 10 });
        assignmentId = a.body._id;
    });
    after(teardown);

    it("max marks are optional whole numbers", async () => {
        assert.equal((await as(teacher).post(`/classrooms/${classId}/assignments`, { title: "x", maxMarks: 0 })).status, 400);
        assert.equal((await as(teacher).post(`/classrooms/${classId}/assignments`, { title: "x", maxMarks: 2.5 })).status, 400);
    });

    it("needs a started assignment, and only students submit", async () => {
        assert.equal((await as(student).post(`/assignments/${assignmentId}/submit`)).status, 400);
        assert.equal((await as(teacher).post(`/assignments/${assignmentId}/submit`)).status, 400);
    });

    it("snapshots the files; later edits don't change it", async () => {
        workId = (await as(student).post(`/assignments/${assignmentId}/start`)).body.projectId;
        await as(student).patch(`/projects/${workId}`, { fileTree: { "main.c": "int main(){return 1;}\n" } });
        const res = await as(student).post(`/assignments/${assignmentId}/submit`, { note: "First try" });
        assert.equal(res.status, 201);
        assert.equal(res.body.version, 1);
        assert.equal(res.body.status, "submitted");
        firstId = res.body._id;

        // The student keeps working on the live project
        await as(student).patch(`/projects/${workId}`, { fileTree: { "main.c": "int main(){return 0;}\n" } });
        const snap = await as(student).get(`/submissions/${firstId}`);
        assert.equal(snap.body.files["main.c"], "int main(){return 1;}\n");
    });

    it("resubmitting creates a new version, the old one stays", async () => {
        const res = await as(student).post(`/assignments/${assignmentId}/submit`);
        assert.equal(res.body.version, 2);
        secondId = res.body._id;
        const two = await as(student).get(`/submissions/${secondId}`);
        assert.equal(two.body.files["main.c"], "int main(){return 0;}\n");
        assert.equal(two.body.versions.length, 2);
        assert.equal((await as(student).get(`/submissions/${firstId}`)).body.files["main.c"], "int main(){return 1;}\n");
    });

    it("only the student and the teacher can see a submission", async () => {
        assert.equal((await as(other).get(`/submissions/${firstId}`)).status, 404);
        assert.equal((await as(teacher).get(`/submissions/${firstId}`)).status, 200);
        const mine = await as(other).get(`/assignments/${assignmentId}/submissions`);
        assert.equal(mine.body.length, 0);
        const all = await as(teacher).get(`/assignments/${assignmentId}/submissions`);
        assert.equal(all.body.length, 2);
    });

    it("the teacher reviews: revision needs feedback, marks within range", async () => {
        assert.equal((await as(student).patch(`/submissions/${secondId}/review`, { status: "reviewed" })).status, 403);
        assert.equal((await as(teacher).patch(`/submissions/${secondId}/review`, { status: "revision-requested" })).status, 400);
        assert.equal((await as(teacher).patch(`/submissions/${secondId}/review`, { status: "reviewed", marks: 11 })).status, 400);
        assert.equal((await as(teacher).patch(`/submissions/${secondId}/review`, { status: "done" })).status, 400);

        const asked = await as(teacher).patch(`/submissions/${secondId}/review`, { status: "revision-requested", feedback: "Handle negatives" });
        assert.equal(asked.body.status, "revision-requested");
        const done = await as(teacher).patch(`/submissions/${secondId}/review`, { status: "reviewed", feedback: "Nice", marks: 8.5 });
        assert.equal(done.body.marks, 8.5);
    });

    it("the student sees the review and gets notified; files stay frozen", async () => {
        const mine = await as(student).get(`/submissions/${secondId}`);
        assert.equal(mine.body.status, "reviewed");
        assert.equal(mine.body.feedback, "Nice");
        assert.equal(mine.body.files["main.c"], "int main(){return 0;}\n");
        const notes = await as(student).get("/notifications");
        const all = Array.isArray(notes.body) ? notes.body : notes.body.notifications ?? notes.body.items ?? [];
        assert.ok(all.some((n: { type: string }) => n.type === "submission-review"));
    });

    it("the teacher's overview counts hand-ins and what's left to review", async () => {
        const otherWork = (await as(other).post(`/assignments/${assignmentId}/start`)).body.projectId;
        assert.ok(otherWork);
        await as(other).post(`/assignments/${assignmentId}/submit`);
        const list = await as(teacher).get(`/classrooms/${classId}/assignments`);
        const row = list.body.find((a: { _id: string }) => a._id === assignmentId);
        assert.equal(row.submitted, 2);
        assert.equal(row.toReview, 1);
        const details = await as(teacher).get(`/assignments/${assignmentId}`);
        const s = details.body.students.find((x: { userId: string }) => x.userId === student.id);
        assert.equal(s.submission.version, 2);
        assert.equal(s.submission.status, "reviewed");
    });

    it("deleting the assignment deletes its submissions", async () => {
        assert.equal((await as(teacher).delete(`/assignments/${assignmentId}`)).status, 204);
        assert.equal((await as(student).get(`/submissions/${firstId}`)).status, 404);
    });
});
