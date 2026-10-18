import catchAsync from "../utils/catchAsync.js";
import * as notificationService from "../services/notification.service.js";

export const listNotifications = catchAsync(async (req, res) => {
    res.status(200).json(await notificationService.listNotifications({
        userId: req.user!._id,
        before: typeof req.query.before === "string" ? req.query.before : undefined,
    }));
});

export const markRead = catchAsync(async (req, res) => {
    res.status(200).json(await notificationService.markRead({ userId: req.user!._id, ids: req.body?.ids }));
});

export const clearNotifications = catchAsync(async (req, res) => {
    await notificationService.clearNotifications({ userId: req.user!._id });
    res.status(204).end();
});
