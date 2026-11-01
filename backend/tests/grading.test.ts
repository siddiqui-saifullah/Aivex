import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { as, canRun, createUser, setup, teardown, type TestUser } from "./helpers.js";
import { normalizeOutput, outputsMatch } from "../utils/grading.js";
import { fingerprints, tokenize } from "../services/similarity.service.js";

const SUM = `#include <stdio.h>
int main(void) {
    int a, b;
    scanf("%d %d", &a, &b);
    printf("%d\\n", a + b);
    return 0;
}
`;

// One app and database for the whole file
before(async () => {
    if (canRun) await setup();
});
after(async () => {
    if (canRun) await teardown();
});

describe("output comparison", () => {
    it("ignores trailing spaces, line endings and final blank lines", () => {
        assert.equal(normalizeOutput("5  \r\n6\n\n\n"), "5\n6");
        assert.ok(outputsMatch("Sum = 5 \n", "Sum = 5"));
        assert.ok(!outputsMatch("Sum=5", "Sum = 5"));
        assert.ok(!outputsMatch("5\n6", "56"));
    });
});

describe("copy check fingerprints", () => {
    it("renamed variables and comments don't change the tokens", () => {
        const a = tokenize("int total = x + 1; // add one").map((t) => t.t).join(" ");
        const b = tokenize("int   sum=y+42; /* other */").map((t) => t.t).join(" ");
        assert.equal(a, b);
    });
    it("the same code gives the same fingerprints", () => {
        const code = SUM.repeat(3);
        assert.deepEqual([...fingerprints(code).keys()], [...fingerprints(code).keys()]);
        assert.ok(fingerprints(code).size > 3);
    });
});

describe("auto-grading", { skip: !canRun && "set TEST_MONGO_URL to run API tests" }, () => {
    let teacher: TestUser;
    let student: TestUser;
    let other: TestUser;
    let classId: string;
    let assignmentId: string;
    let submissionId: string;
    let tests: { _id: string; name: string; hidden: boolean; points: number }[];

    before(async () => {
        [teacher, student, other] = await Promise.all([createUser(), createUser(), createUser()]);
        const cls = await as(teacher).post("/classrooms", { name: "Grading 101", stack: "c" });
        classId = cls.body._id;
        await as(student).post("/classrooms/join", { code: cls.body.code });
        await as(other).post("/classrooms/join", { code: cls.body.code });
    });
    it("teachers add test cases; students see only the visible ones", async () => {
        const bad = await as(teacher).post(`/classrooms/${classId}/assignments`, { title: "x", tests: [{ input: "1", expected: "" }] });
        assert.equal(bad.status, 400);
        const res = await as(teacher).post(`/classrooms/${classId}/assignments`, {
            title: "Add two numbers",
            maxMarks: 10,
            tests: [
                { name: "Small", input: "2 3", expected: "5", points: 2 },
                { name: "Negative", input: "-4 1", expected: "-3", points: 3 },
                { name: "Big", input: "1000000 2000000", expected: "3000000", points: 5, hidden: true },
            ],
        });
        assert.equal(res.status, 201);
        assignmentId = res.body._id;
        tests = res.body.tests;
        assert.equal(tests.length, 3);
        assert.equal(res.body.totalPoints, 10);

        const mine = (await as(student).get(`/assignments/${assignmentId}`)).body;
        assert.equal(mine.tests.length, 2);
        assert.equal(mine.hiddenCount, 1);
        assert.equal(mine.totalPoints, 10);
        assert.ok(!JSON.stringify(mine).includes("3000000"));
    });

    it("editing keeps test ids", async () => {
        const keep = tests.map((t) => ({ ...t, input: undefined }));
        const full = (await as(teacher).get(`/assignments/${assignmentId}`)).body.tests;
        const res = await as(teacher).patch(`/assignments/${assignmentId}`, { tests: full.map((t: object, i: number) => (i === 0 ? { ...t, points: 2 } : t)) });
        assert.equal(res.status, 200);
        assert.deepEqual(res.body.tests.map((t: { _id: string }) => t._id), keep.map((t) => t._id));
    });

    it("test cases are for C and C++ only", async () => {
        const web = await as(teacher).post("/classrooms", { name: "Web 101", stack: "htmlcssjs" });
        const res = await as(teacher).post(`/classrooms/${web.body._id}/assignments`, { title: "Page", tests: [{ input: "", expected: "x" }] });
        assert.equal(res.status, 400);
    });

    it("the teacher's browser runs are scored on the server", async () => {
        const { projectId } = (await as(student).post(`/assignments/${assignmentId}/start`)).body;
        await as(student).patch(`/projects/${projectId}`, { fileTree: { "main.c": SUM } });
        submissionId = (await as(student).post(`/assignments/${assignmentId}/submit`)).body._id;

        // Only the teacher records results
        assert.equal((await as(student).post(`/submissions/${submissionId}/tests`, { runs: [] })).status, 403);

        const [small, negative] = tests;
        const res = await as(teacher).post(`/submissions/${submissionId}/tests`, {
            runs: [
                { test: small._id, outcome: "ran", output: "5  \n" },
                { test: negative._id, outcome: "ran", output: "3\n" },
                // the hidden test's run is missing: it fails
            ],
        });
        assert.equal(res.status, 200);
        assert.equal(res.body.score, 2);
        assert.equal(res.body.total, 10);
        assert.deepEqual(res.body.results.map((r: { outcome: string }) => r.outcome), ["passed", "failed", "error"]);
        assert.equal(res.body.by, "teacher");
    });

    it("students see their results, without hidden tests' details", async () => {
        const mine = (await as(student).get(`/submissions/${submissionId}`)).body;
        assert.equal(mine.tests.score, 2);
        assert.equal(mine.testCases.tests.length, 2);
        const hidden = mine.tests.results.find((r: { hidden: boolean }) => r.hidden);
        assert.equal(hidden.output, "");
        const list = (await as(teacher).get(`/assignments/${assignmentId}`)).body.students;
        const row = list.find((s: { submission: { tests?: object } | null }) => s.submission?.tests);
        assert.deepEqual(row.submission.tests, { score: 2, total: 10 });
    });

    it("compile errors fail every test", async () => {
        const runs = tests.map((t) => ({ test: t._id, outcome: "compile-error", output: "error: expected ';'" }));
        const res = await as(teacher).post(`/submissions/${submissionId}/tests`, { runs });
        assert.equal(res.body.score, 0);
        assert.ok(res.body.results.every((r: { outcome: string }) => r.outcome === "compile-error"));
    });
});

describe("auto-grading on the server's code runner", { skip: !canRun && "set TEST_MONGO_URL to run API tests" }, () => {
    let piston: http.Server;
    let teacher: TestUser;
    let student: TestUser;

    before(async () => {
        // A stand-in for Piston that "runs" the sum program
        piston = http.createServer((req, res) => {
            let body = "";
            req.on("data", (c) => (body += c));
            req.on("end", () => {
                const { stdin, files } = JSON.parse(body);
                const broken = !String(files[0].content).includes("printf");
                const [a, b] = String(stdin).split(/\s+/).map(Number);
                res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({
                    language: "c", version: "10",
                    compile: broken ? { stdout: "", stderr: "error", code: 1 } : { stdout: "", stderr: "", code: 0 },
                    run: { stdout: broken ? "" : `${a + b}\n`, stderr: "", code: 0, signal: null },
                }));
            });
        }).listen(0);
        process.env.PISTON_URL = `http://127.0.0.1:${(piston.address() as AddressInfo).port}`;
        [teacher, student] = await Promise.all([createUser(), createUser()]);
    });
    after(async () => {
        delete process.env.PISTON_URL;
        piston.close();
    });

    it("grades right after the student submits", async () => {
        const cls = await as(teacher).post("/classrooms", { name: "Server grading", stack: "c" });
        await as(student).post("/classrooms/join", { code: cls.body.code });
        const a = await as(teacher).post(`/classrooms/${cls.body._id}/assignments`, {
            title: "Sum",
            tests: [{ input: "2 3", expected: "5" }, { input: "10 -3", expected: "7", hidden: true, points: 4 }],
        });
        const { projectId } = (await as(student).post(`/assignments/${a.body._id}/start`)).body;
        await as(student).patch(`/projects/${projectId}`, { fileTree: { "main.c": SUM } });
        const sub = (await as(student).post(`/assignments/${a.body._id}/submit`)).body;
        let tests = null;
        for (let i = 0; i < 50 && !tests; i++) {
            await new Promise((r) => setTimeout(r, 100));
            tests = (await as(teacher).get(`/submissions/${sub._id}`)).body.tests;
        }
        assert.ok(tests);
        assert.equal(tests.by, "server");
        assert.equal(tests.score, 5);
        assert.equal(tests.total, 5);
    });
});

describe("copy check", { skip: !canRun && "set TEST_MONGO_URL to run API tests" }, () => {
    let teacher: TestUser;
    let students: TestUser[];
    let assignmentId: string;

    const ORIGINAL = `#include <stdio.h>
int is_prime(int n) {
    if (n < 2) return 0;
    for (int i = 2; i * i <= n; i++) {
        if (n % i == 0) return 0;
    }
    return 1;
}
int main(void) {
    int count = 0;
    for (int k = 1; k <= 100; k++) {
        if (is_prime(k)) { printf("%d ", k); count++; }
    }
    printf("\\nTotal: %d\\n", count);
    return 0;
}
`;
    // The same program with new names, comments and spacing
    const DISGUISED = `#include <stdio.h>
// checks if a number is prime
int check(int value)
{
    if (value < 2) return 0;
    for (int j = 2; j * j <= value; j++)
    {
        if (value % j == 0) return 0;   /* not prime */
    }
    return 1;
}

int main(void)
{
    int total = 0;
    for (int x = 1; x <= 100; x++)
    {
        if (check(x)) { printf("%d ", x); total++; }
    }
    printf("\\nTotal: %d\\n", total);
    return 0;
}
`;
    const OWN = `#include <stdio.h>
int main(void) {
    int primes[100], found = 0;
    for (int n = 2; n <= 100; n++) {
        int ok = 1;
        for (int d = 0; d < found && primes[d] * primes[d] <= n; d++) if (n % primes[d] == 0) { ok = 0; break; }
        if (ok) primes[found++] = n;
    }
    for (int i = 0; i < found; i++) printf("%d%c", primes[i], i + 1 < found ? ' ' : '\\n');
    printf("Total: %d\\n", found);
    return 0;
}
`;

    before(async () => {
        teacher = await createUser();
        students = await Promise.all([createUser(), createUser(), createUser()]);
        const cls = await as(teacher).post("/classrooms", { name: "Copy check", stack: "c" });
        for (const s of students) await as(s).post("/classrooms/join", { code: cls.body.code });
        assignmentId = (await as(teacher).post(`/classrooms/${cls.body._id}/assignments`, { title: "Primes" })).body._id;
        const code = [ORIGINAL, DISGUISED, OWN];
        for (let i = 0; i < 3; i++) {
            const { projectId } = (await as(students[i]).post(`/assignments/${assignmentId}/start`)).body;
            await as(students[i]).patch(`/projects/${projectId}`, { fileTree: { "main.c": code[i] } });
            await as(students[i]).post(`/assignments/${assignmentId}/submit`);
        }
    });

    it("finds the disguised copy, not the student who wrote their own", async () => {
        assert.equal((await as(students[0]).get(`/assignments/${assignmentId}/similarity`)).status, 403);
        const res = await as(teacher).get(`/assignments/${assignmentId}/similarity`);
        assert.equal(res.status, 200);
        assert.equal(res.body.compared, 3);
        assert.equal(res.body.pairs.length, 1);
        const [pair] = res.body.pairs;
        assert.ok(pair.score >= 80, `score ${pair.score}`);
        const names = [pair.a.username, pair.b.username].sort();
        assert.deepEqual(names, [students[0].username, students[1].username].sort());
        assert.ok(pair.a.journey.saves >= 1);
    });

    it("shows the two side by side with the shared lines marked", async () => {
        const { pairs } = (await as(teacher).get(`/assignments/${assignmentId}/similarity`)).body;
        const res = await as(teacher).get(`/assignments/${assignmentId}/similarity/compare?a=${pairs[0].a.submissionId}&b=${pairs[0].b.submissionId}`);
        assert.equal(res.status, 200);
        const lines = res.body.a.files[0].matched;
        assert.ok(lines.length >= 8, `matched ${lines.length}`);
        assert.ok(res.body.b.files[0].matched.length >= 8);
    });
});
