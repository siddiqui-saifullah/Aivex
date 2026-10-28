import catchAsync from "../utils/catchAsync.js";
import * as reportService from "../services/report.service.js";

const query = (v: unknown) => (typeof v === "string" ? v : undefined);

/** Anyone signed in: report a user, project or chat message. */
export const createReport = catchAsync(async (req, res) => {
    const { targetType, targetId, reason, details } = req.body ?? {};
    res.status(201).json(await reportService.createAbuseReport({
        reporterId: req.user!._id,
        targetType,
        targetId,
        reason,
        details,
    }));
});

/* ---- admin ---- */

export const listIssues = catchAsync(async (req, res) => {
    res.status(200).json(await reportService.listIssues({
        status: query(req.query.status),
        type: query(req.query.type),
        page: Number(req.query.page) || 1,
    }));
});

export const updateIssue = catchAsync(async (req, res) => {
    res.status(200).json(await reportService.updateIssue({
        issueId: req.params.issueId as string,
        status: req.body?.status,
        reply: req.body?.reply,
    }));
});

export const listReports = catchAsync(async (req, res) => {
    res.status(200).json(await reportService.listAbuseReports({
        status: query(req.query.status),
        page: Number(req.query.page) || 1,
    }));
});

export const resolveReport = catchAsync(async (req, res) => {
    res.status(200).json(await reportService.resolveAbuseReport({
        reportId: req.params.reportId as string,
        adminId: req.user!._id,
        action: req.body?.action,
        note: req.body?.note,
    }));
});

export const setSuspension = catchAsync(async (req, res) => {
    res.status(200).json(await reportService.setSuspended({
        userId: req.params.userId as string,
        adminId: req.user!._id,
        suspended: req.body?.suspended === true,
        reason: typeof req.body?.reason === "string" ? req.body.reason : undefined,
    }));
});
