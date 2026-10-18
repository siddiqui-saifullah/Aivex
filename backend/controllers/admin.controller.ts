import catchAsync from "../utils/catchAsync.js";
import * as adminService from "../services/admin.service.js";

const query = (v: unknown) => (typeof v === "string" ? v : undefined);

export const me = catchAsync(async (_req, res) => {
    // Only reachable by admins (requireAdmin answers 404 otherwise)
    res.status(200).json({ isAdmin: true });
});

export const overview = catchAsync(async (_req, res) => {
    res.status(200).json(await adminService.getOverview());
});

export const users = catchAsync(async (req, res) => {
    res.status(200).json(await adminService.listUsers({
        q: query(req.query.q),
        sort: query(req.query.sort),
        page: Number(req.query.page) || 1,
    }));
});

export const projects = catchAsync(async (req, res) => {
    res.status(200).json(await adminService.listProjects({
        q: query(req.query.q),
        sort: query(req.query.sort),
        page: Number(req.query.page) || 1,
    }));
});
