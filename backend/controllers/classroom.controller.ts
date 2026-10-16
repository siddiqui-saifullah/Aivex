import catchAsync from "../utils/catchAsync.js";
import * as classroomService from "../services/classroom.service.js";

export const createClassroom = catchAsync(async (req, res) => {
    const { name, stack, templateProjectId } = req.body ?? {};
    const classroom = await classroomService.createClassroom({
        teacherId: req.user!._id,
        name,
        stack,
        templateProjectId: typeof templateProjectId === "string" && templateProjectId ? templateProjectId : undefined,
    });
    res.status(201).json(classroom);
});

export const listClassrooms = catchAsync(async (req, res) => {
    res.status(200).json(await classroomService.listClassrooms({ userId: req.user!._id }));
});

export const getClassroom = catchAsync(async (req, res) => {
    res.status(200).json(await classroomService.getClassroom({
        classroomId: req.params.classroomId as string,
        userId: req.user!._id,
    }));
});

export const joinClassroom = catchAsync(async (req, res) => {
    res.status(200).json(await classroomService.joinClassroom({
        code: String(req.body?.code ?? ""),
        userId: req.user!._id,
    }));
});

export const deleteClassroom = catchAsync(async (req, res) => {
    await classroomService.deleteClassroom({
        classroomId: req.params.classroomId as string,
        userId: req.user!._id,
    });
    res.status(204).end();
});
