import * as institute from "../services/institute.service.js";
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

/* Institute plan: enquiries, seat packs, and seats for colleges paying by invoice */
export const institutes = catchAsync(async (_req, res) => {
    res.status(200).json(await institute.adminInstitutes());
});

export const grantSeats = catchAsync(async (req, res) => {
    res.status(201).json(await institute.grantSeats(req.body ?? {}));
});

export const updateInquiry = catchAsync(async (req, res) => {
    await institute.updateInquiry(String(req.params.inquiryId), req.body?.status);
    res.status(204).end();
});
