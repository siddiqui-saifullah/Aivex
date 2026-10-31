import catchAsync from "../utils/catchAsync.js";
import * as assignmentService from "../services/assignment.service.js";
import * as submissionService from "../services/submission.service.js";

export const createAssignment = catchAsync(async (req, res) => {
    res.status(201).json(await assignmentService.createAssignment({
        classroomId: req.params.classroomId as string,
        teacherId: req.user!._id,
        input: req.body ?? {},
    }));
});

export const listAssignments = catchAsync(async (req, res) => {
    res.status(200).json(await assignmentService.listAssignments({
        classroomId: req.params.classroomId as string,
        userId: req.user!._id,
    }));
});

export const getAssignment = catchAsync(async (req, res) => {
    res.status(200).json(await assignmentService.getAssignment({
        assignmentId: req.params.assignmentId as string,
        userId: req.user!._id,
    }));
});

export const startAssignment = catchAsync(async (req, res) => {
    res.status(200).json(await assignmentService.startAssignment({
        assignmentId: req.params.assignmentId as string,
        userId: req.user!._id,
    }));
});

export const updateAssignment = catchAsync(async (req, res) => {
    res.status(200).json(await assignmentService.updateAssignment({
        assignmentId: req.params.assignmentId as string,
        userId: req.user!._id,
        input: req.body ?? {},
    }));
});

export const deleteAssignment = catchAsync(async (req, res) => {
    await assignmentService.deleteAssignment({ assignmentId: req.params.assignmentId as string, userId: req.user!._id });
    res.status(204).end();
});

/* -------------------------------------------------------------------------- */
/* SUBMISSIONS                                                                */
/* -------------------------------------------------------------------------- */
export const submitAssignment = catchAsync(async (req, res) => {
    res.status(201).json(await submissionService.submitAssignment({
        assignmentId: req.params.assignmentId as string,
        userId: req.user!._id,
        note: req.body?.note,
    }));
});

export const listSubmissions = catchAsync(async (req, res) => {
    res.status(200).json(await submissionService.listSubmissions({
        assignmentId: req.params.assignmentId as string,
        userId: req.user!._id,
    }));
});

export const getSubmission = catchAsync(async (req, res) => {
    res.status(200).json(await submissionService.getSubmission({
        submissionId: req.params.submissionId as string,
        userId: req.user!._id,
    }));
});

export const reviewSubmission = catchAsync(async (req, res) => {
    res.status(200).json(await submissionService.reviewSubmission({
        submissionId: req.params.submissionId as string,
        userId: req.user!._id,
        input: req.body ?? {},
    }));
});
