import mongoose, { type Types } from "mongoose";
import Assignment, { type ITestCase } from "../models/assignment.model.js";
import Classroom from "../models/classroom.model.js";
import Submission, { type ITestResult, type ISubmissionTests } from "../models/submission.model.js";
import AppError from "../errors/AppError.js";
import { fromStoredFiles } from "../utils/fileStore.js";
import { findEntry, isTestableStack, outputsMatch } from "../utils/grading.js";
import { isRunnerConfigured, runCode } from "./runner.service.js";

type Id = Types.ObjectId | string;

/**
 * Auto-grading. Test cases run either on the server's code runner (when
 * PISTON_URL is set, right after a student submits) or in the teacher's
 * browser (the C/C++ compiler built into Aivex). Either way the server
 * compares the outputs with the expected ones and keeps the score, so the
 * expected output of hidden tests never leaves the server for students.
 */

const MAX_OUTPUT = 2000;
const OUTCOMES = ["ran", "compile-error", "error", "timeout"] as const;
type RunOutcome = (typeof OUTCOMES)[number];

/** What one test's run produced. */
export interface TestRun {
    outcome: RunOutcome;
    output: string;
}

/** Score every test of the assignment from the runs (a missing run fails). */
const score = (tests: ITestCase[], runs: Map<string, TestRun>, by: ISubmissionTests["by"]): ISubmissionTests => {
    const results: ITestResult[] = tests.map((t) => {
        const run = runs.get(String(t._id));
        const outcome: ITestResult["outcome"] = !run
            ? "error"
            : run.outcome !== "ran"
                ? run.outcome
                : outputsMatch(run.output, t.expected) ? "passed" : "failed";
        return {
            test: t._id,
            name: t.name,
            points: t.points,
            hidden: t.hidden,
            passed: outcome === "passed",
            outcome,
            output: (run?.output ?? "").slice(0, MAX_OUTPUT),
        };
    });
    return {
        results,
        score: results.reduce((n, r) => n + (r.passed ? r.points : 0), 0),
        total: tests.reduce((n, t) => n + t.points, 0),
        ranAt: new Date(),
        by,
    };
};

/** Teacher: results from running the tests in their browser. */
export const recordTestRuns = async ({ submissionId, userId, runs }: { submissionId: string; userId: Id; runs: unknown }) => {
    if (!mongoose.Types.ObjectId.isValid(submissionId)) throw new AppError("Invalid submission id", 400);
    const submission = await Submission.findById(submissionId).select("assignment classroom").lean();
    if (!submission) throw new AppError("Submission not found", 404);
    const [assignment, classroom] = await Promise.all([
        Assignment.findById(submission.assignment).select("tests").lean(),
        Classroom.findById(submission.classroom).select("teacher").lean(),
    ]);
    if (!assignment || !classroom) throw new AppError("Submission not found", 404);
    if (String(classroom.teacher) !== String(userId)) throw new AppError("Only the teacher can grade submissions", 403);
    if (!assignment.tests?.length) throw new AppError("This assignment has no test cases", 400);
    if (!Array.isArray(runs)) throw new AppError("Send the test runs", 400);

    const byId = new Map<string, TestRun>();
    for (const r of runs as Record<string, unknown>[]) {
        if (!r || typeof r.test !== "string") continue;
        const outcome = OUTCOMES.includes(r.outcome as RunOutcome) ? (r.outcome as RunOutcome) : "error";
        byId.set(r.test, { outcome, output: typeof r.output === "string" ? r.output.slice(0, 100_000) : "" });
    }
    const tests = score(assignment.tests, byId, "teacher");
    await Submission.updateOne({ _id: submission._id }, { $set: { tests } });
    return tests;
};

/** Run one test on the server's code runner. */
const runOnServer = async (stack: string, files: Record<string, string>, entry: string, input: string): Promise<TestRun> => {
    const sourceExt = stack === "cpp" ? /\.(cpp|cc|cxx|h|hpp)$/i : /\.(c|h)$/i;
    const names = [entry, ...Object.keys(files).filter((p) => p !== entry && sourceExt.test(p))];
    try {
        const result = await runCode({
            language: stack,
            files: names.map((name) => ({ name, content: files[name] ?? "" })),
            stdin: input,
        });
        if (result.compile && result.compile.code !== 0) return { outcome: "compile-error", output: result.compile.stderr || result.compile.stdout };
        if (result.run.signal === "SIGKILL") return { outcome: "timeout", output: result.run.stdout };
        if (result.run.code !== 0) return { outcome: "error", output: result.run.stdout };
        return { outcome: "ran", output: result.run.stdout };
    } catch (err) {
        return { outcome: "error", output: (err as Error).message };
    }
};

/** After a submit: grade on the server when a code runner is set up. */
export const autoGrade = async (submissionId: Id) => {
    if (!isRunnerConfigured()) return null;
    const submission = await Submission.findById(submissionId).select("assignment files").lean();
    if (!submission) return null;
    const assignment = await Assignment.findById(submission.assignment).select("stack tests").lean();
    if (!assignment?.tests?.length || !isTestableStack(assignment.stack)) return null;

    const files = fromStoredFiles(submission.files);
    const entry = findEntry(files, assignment.stack);
    const runs = new Map<string, TestRun>();
    for (const t of assignment.tests) {
        runs.set(String(t._id), entry
            ? await runOnServer(assignment.stack, files, entry, t.input)
            : { outcome: "compile-error", output: "No main file found" });
    }
    const tests = score(assignment.tests, runs, "server");
    await Submission.updateOne({ _id: submissionId }, { $set: { tests } });
    return tests;
};

/** What a student sees of their results: hidden tests only as passed or not. */
export const testsForRole = (tests: ISubmissionTests | null | undefined, role: "teacher" | "student") => {
    if (!tests) return null;
    if (role === "teacher") return tests;
    return {
        ...tests,
        results: tests.results.map((r) => (r.hidden ? { ...r, output: "" } : r)),
    };
};
