import catchAsync from "../utils/catchAsync.js";
import * as assignmentService from "../services/assignment.service.js";

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
