import catchAsync from "../utils/catchAsync.js";
import * as github from "../services/github.service.js";

export const status = catchAsync(async (req, res) => {
    res.json(await github.status(req.user!._id));
});
export const ticket = catchAsync(async (req, res) => {
    res.status(201).json(await github.createTicket(req.user!._id, req.body?.next));
});
export const disconnect = catchAsync(async (req, res) => {
    await github.disconnect(req.user!._id);
    res.status(204).end();
});
export const repos = catchAsync(async (req, res) => {
    res.json(await github.listRepos(req.user!._id));
});
export const importRepo = catchAsync(async (req, res) => {
    res.status(201).json(await github.importRepo({ userId: req.user!._id, input: req.body ?? {} }));
});

/* A project's link */
const projectId = (req: { params: Record<string, unknown> }) => String(req.params.projectId);
export const projectStatus = catchAsync(async (req, res) => {
    res.json(await github.projectStatus({ projectId: projectId(req), userId: req.user!._id }));
});
export const push = catchAsync(async (req, res) => {
    res.json(await github.push({ projectId: projectId(req), userId: req.user!._id, input: req.body ?? {} }));
});
export const pull = catchAsync(async (req, res) => {
    res.json(await github.pull({ projectId: projectId(req), userId: req.user!._id, force: req.body?.force }));
});
export const unlink = catchAsync(async (req, res) => {
    await github.unlink({ projectId: projectId(req), userId: req.user!._id });
    res.status(204).end();
});
