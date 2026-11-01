import mongoose, { type Types } from "mongoose";
import Assignment from "../models/assignment.model.js";
import Classroom from "../models/classroom.model.js";
import Project from "../models/project.model.js";
import Submission, { type SubmissionStatus } from "../models/submission.model.js";
import userModel from "../models/user.model.js";
import AppError from "../errors/AppError.js";
import { fromStoredFiles, toStoredFiles } from "../utils/fileStore.js";
import { notify } from "./notification.service.js";
import { autoGrade, testsForRole } from "./grading.service.js";
import { testsFor } from "./assignment.service.js";

type Id = Types.ObjectId | string;

/** A hand-in's files (MongoDB documents are capped at 16 MB). */
const MAX_SNAPSHOT_CHARS = 4_000_000;

const assertId = (id: string, label: string) => {
    if (!mongoose.Types.ObjectId.isValid(id)) throw new AppError(`Invalid ${label}`, 400);
};

const isDuplicateKey = (err: unknown) => (err as { code?: number }).code === 11000;

const loadAssignment = async (assignmentId: string, userId: Id) => {
    assertId(assignmentId, "assignment id");
    const assignment = await Assignment.findById(assignmentId).select("classroom title maxMarks").lean();
    if (!assignment) throw new AppError("Assignment not found", 404);
    const classroom = await Classroom.findById(assignment.classroom).select("name teacher students").lean();
    if (!classroom) throw new AppError("Class not found", 404);
    const isTeacher = String(classroom.teacher) === String(userId);
    const isStudent = classroom.students.some((s) => String(s.user) === String(userId));
    if (!isTeacher && !isStudent) throw new AppError("You are not in this class", 403);
    return { assignment, classroom, role: isTeacher ? ("teacher" as const) : ("student" as const) };
};

/** What lists show: no files. */
const summary = (s: {
    _id: Types.ObjectId;
    assignment: Types.ObjectId;
    student: Types.ObjectId;
    version: number;
    note: string;
    status: SubmissionStatus;
    feedback: string;
    marks: number | null;
    reviewedAt: Date | null;
    createdAt: Date;
    tests?: { score: number; total: number } | null;
}) => ({
    _id: s._id,
    assignment: s.assignment,
    student: s.student,
    version: s.version,
    note: s.note,
    status: s.status,
    feedback: s.feedback,
    marks: s.marks,
    reviewedAt: s.reviewedAt,
    createdAt: s.createdAt,
    tests: s.tests ? { score: s.tests.score, total: s.tests.total } : null,
});

/* -------------------------------------------------------------------------- */
/* SUBMIT (student): a frozen copy of their project's files                   */
/* -------------------------------------------------------------------------- */
export const submitAssignment = async ({ assignmentId, userId, note }: {
    assignmentId: string;
    userId: Id;
    note?: unknown;
}) => {
    const { assignment, classroom, role } = await loadAssignment(assignmentId, userId);
    if (role !== "student") throw new AppError("Only students submit assignments", 400);
    if (note !== undefined && typeof note !== "string") throw new AppError("Note must be text", 400);
    const text = (note ?? "").trim();
    if (text.length > 1000) throw new AppError("Keep the note under 1000 characters", 400);

    const project = await Project.findOne({ assignment: assignment._id, owner: userId, classroom: classroom._id })
        .select("files")
        .lean();
    if (!project) throw new AppError("Start the assignment before submitting it", 400);

    const files = toStoredFiles(fromStoredFiles(project.files));
    if (JSON.stringify(files).length > MAX_SNAPSHOT_CHARS) {
        throw new AppError("This project is too large to submit. Remove large files and try again", 413);
    }

    // Next version number; retry if a parallel submit took it
    let created = null;
    for (let attempt = 0; attempt < 3 && !created; attempt++) {
        const last = await Submission.findOne({ assignment: assignment._id, student: userId })
            .sort({ version: -1 })
            .select("version")
            .lean();
        try {
            created = await Submission.create({
                assignment: assignment._id,
                classroom: classroom._id,
                student: userId,
                project: project._id,
                version: (last?.version ?? 0) + 1,
                files,
                note: text,
            });
        } catch (err) {
            if (!isDuplicateKey(err)) throw err;
        }
    }
    if (!created) throw new AppError("Could not submit, please try again", 500);
    // Graded in the background when the server has a code runner
    void autoGrade(created._id).catch((err) => console.error("Auto-grading failed:", err));

    void notify({
        users: [classroom.teacher],
        type: "submission",
        title: created.version > 1
            ? `{actor} resubmitted “${assignment.title}” (version ${created.version})`
            : `{actor} submitted “${assignment.title}”`,
        body: text.slice(0, 200),
        link: `/classes/${classroom._id}/assignments/${assignment._id}/submissions/${created._id}`,
        actorId: userId,
    });

    return summary(created.toObject());
};

/* -------------------------------------------------------------------------- */
/* LIST: teacher sees everyone's, a student their own                         */
/* -------------------------------------------------------------------------- */
export const listSubmissions = async ({ assignmentId, userId }: { assignmentId: string; userId: Id }) => {
    const { assignment, role } = await loadAssignment(assignmentId, userId);
    const rows = await Submission.find({
        assignment: assignment._id,
        ...(role === "student" ? { student: userId } : {}),
    })
        .select("-files")
        .sort({ createdAt: -1 })
        .lean();
    return rows.map(summary);
};

/* -------------------------------------------------------------------------- */
/* ONE SUBMISSION, with its files and the student's other versions            */
/* -------------------------------------------------------------------------- */
export const getSubmission = async ({ submissionId, userId }: { submissionId: string; userId: Id }) => {
    assertId(submissionId, "submission id");
    const submission = await Submission.findById(submissionId).lean();
    if (!submission) throw new AppError("Submission not found", 404);

    const [assignment, classroom] = await Promise.all([
        Assignment.findById(submission.assignment).select("title maxMarks stack tests").lean(),
        Classroom.findById(submission.classroom).select("name teacher").lean(),
    ]);
    if (!assignment || !classroom) throw new AppError("Submission not found", 404);
    const isTeacher = String(classroom.teacher) === String(userId);
    if (!isTeacher && String(submission.student) !== String(userId)) throw new AppError("Submission not found", 404);

    const [student, versions] = await Promise.all([
        userModel.findById(submission.student).select("name username").lean(),
        Submission.find({ assignment: submission.assignment, student: submission.student })
            .select("version status createdAt")
            .sort({ version: -1 })
            .lean(),
    ]);

    return {
        ...summary(submission),
        files: fromStoredFiles(submission.files),
        role: isTeacher ? "teacher" : "student",
        classroom: { _id: classroom._id, name: classroom.name },
        assignmentTitle: assignment.title,
        maxMarks: assignment.maxMarks ?? null,
        studentInfo: { _id: submission.student, name: student?.name, username: student?.username },
        versions: versions.map((v) => ({ _id: v._id, version: v.version, status: v.status, createdAt: v.createdAt })),
        stack: assignment.stack,
        // Test cases (the teacher can run them in the browser) and their results
        testCases: testsFor(assignment.tests, isTeacher ? "teacher" : "student"),
        tests: testsForRole(submission.tests, isTeacher ? "teacher" : "student"),
    };
};

/* -------------------------------------------------------------------------- */
/* REVIEW (teacher): feedback, optional marks, or ask for a revision          */
/* -------------------------------------------------------------------------- */
export const reviewSubmission = async ({ submissionId, userId, input }: {
    submissionId: string;
    userId: Id;
    input: Record<string, unknown>;
}) => {
    assertId(submissionId, "submission id");
    const submission = await Submission.findById(submissionId).select("-files").lean();
    if (!submission) throw new AppError("Submission not found", 404);
    const [assignment, classroom] = await Promise.all([
        Assignment.findById(submission.assignment).select("title maxMarks").lean(),
        Classroom.findById(submission.classroom).select("teacher").lean(),
    ]);
    if (!assignment || !classroom) throw new AppError("Submission not found", 404);
    if (String(classroom.teacher) !== String(userId)) throw new AppError("Only the teacher can review submissions", 403);

    const status = input.status;
    if (status !== "reviewed" && status !== "revision-requested") {
        throw new AppError("Status must be reviewed or revision-requested", 400);
    }
    const feedback = typeof input.feedback === "string" ? input.feedback.trim() : "";
    if (feedback.length > 5000) throw new AppError("Keep the feedback under 5000 characters", 400);
    if (status === "revision-requested" && !feedback) throw new AppError("Tell the student what to change", 400);

    let marks: number | null = null;
    if (input.marks !== undefined && input.marks !== null && input.marks !== "") {
        if (assignment.maxMarks == null) throw new AppError("This assignment isn't graded with marks", 400);
        const n = Number(input.marks);
        if (!Number.isFinite(n) || n < 0 || n > assignment.maxMarks) {
            throw new AppError(`Marks must be between 0 and ${assignment.maxMarks}`, 400);
        }
        marks = Math.round(n * 10) / 10;
    }

    const reviewedAt = new Date();
    await Submission.updateOne(
        { _id: submission._id },
        { $set: { status, feedback, marks, reviewedBy: userId, reviewedAt } },
    );

    void notify({
        users: [submission.student],
        type: "submission-review",
        title: status === "revision-requested"
            ? `{actor} asked for changes to “${assignment.title}”`
            : `{actor} reviewed “${assignment.title}”${marks !== null ? `: ${marks}/${assignment.maxMarks}` : ""}`,
        body: feedback.slice(0, 200),
        link: `/classes/${submission.classroom}/assignments/${submission.assignment}/submissions/${submission._id}`,
        actorId: userId,
    });

    return summary({ ...submission, status, feedback, marks, reviewedAt });
};
