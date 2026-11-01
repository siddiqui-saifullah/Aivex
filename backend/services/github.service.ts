import crypto from "node:crypto";
import mongoose, { type Types } from "mongoose";
import AppError from "../errors/AppError.js";
import userModel from "../models/user.model.js";
import Project, { type ProjectStack } from "../models/project.model.js";
import redisClient from "./redis.service.js";
import { fromStoredFiles, toStoredFiles } from "../utils/fileStore.js";
import { recordChange, recordSafely } from "./journey.service.js";
import * as collab from "../socket/collab.js";
import { emitToProject, notifyProjectUpdated } from "../socket/io.js";

type Id = Types.ObjectId | string;

/*
 * GitHub sync. Users connect their GitHub account (the same OAuth app as
 * "Continue with GitHub", asking for the `repo` scope), then push a project
 * to a new or existing repository, import a repository as a new project, and
 * pull the latest commit back. Everything goes through GitHub's REST API
 * (Git Data endpoints), so the server needs no git binary.
 *
 * A push makes the repository match the project exactly (files deleted in
 * Aivex are deleted in the commit). Before overwriting anything, pushes and
 * pulls check that the other side hasn't moved since the last sync.
 */

const API = () => (process.env.GITHUB_API_BASE || "https://api.github.com").replace(/\/$/, "");
const SCOPE = "repo";

const MAX_FILES = 1000;
const MAX_TOTAL_BYTES = 10 * 1024 * 1024;
const MAX_FILE_BYTES = 512 * 1024;
const SKIP_PATH = /(^|\/)(node_modules|\.git|dist|build|\.next)\//;
const LOCAL_ONLY = new Set([".aivex"]);

/* -------------------------------------------------------------------------- */
/* TOKEN (AES-256-GCM, key from GITHUB_TOKEN_SECRET or JWT_SECRET)            */
/* -------------------------------------------------------------------------- */
const key = () => crypto.createHash("sha256").update(process.env.GITHUB_TOKEN_SECRET || process.env.JWT_SECRET || "aivex").digest();

const encrypt = (text: string) => {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
    const data = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
    return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64")).join(".");
};

const decrypt = (stored: string) => {
    const [iv, tag, data] = stored.split(".").map((p) => Buffer.from(p, "base64"));
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
};

const tokenOf = async (userId: Id) => {
    const user = await userModel.findById(userId).select("+githubToken").lean();
    if (!user?.githubToken) throw new AppError("Connect your GitHub account first", 400);
    try {
        return decrypt(user.githubToken);
    } catch {
        throw new AppError("Connect your GitHub account again", 400);
    }
};

/* -------------------------------------------------------------------------- */
/* API                                                                        */
/* -------------------------------------------------------------------------- */
class GitHubError extends AppError {
    constructor(message: string, statusCode: number, public githubStatus: number) {
        super(message, statusCode);
    }
}

const gh = async <T>(token: string, path: string, init: { method?: string; body?: unknown } = {}): Promise<T> => {
    const res = await fetch(`${API()}${path}`, {
        method: init.method ?? "GET",
        headers: {
            Accept: "application/vnd.github+json",
            Authorization: `Bearer ${token}`,
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "Aivex",
            ...(init.body ? { "Content-Type": "application/json" } : {}),
        },
        body: init.body ? JSON.stringify(init.body) : undefined,
        signal: AbortSignal.timeout(30_000),
    }).catch(() => {
        throw new GitHubError("GitHub is unreachable right now. Please try again.", 502, 0);
    });
    if (res.status === 204) return undefined as T;
    const data = await res.json().catch(() => ({})) as { message?: string };
    if (!res.ok) {
        if (res.status === 401) throw new GitHubError("Your GitHub connection has expired. Connect GitHub again.", 401, 401);
        if (res.status === 403 && /rate limit/i.test(data.message ?? "")) throw new GitHubError("GitHub's rate limit was reached. Try again in a few minutes.", 429, 403);
        if (res.status === 404) throw new GitHubError("Repository not found, or your GitHub account can't access it.", 404, 404);
        throw new GitHubError(data.message ? `GitHub: ${data.message}` : `GitHub error (${res.status})`, res.status >= 500 ? 502 : 400, res.status);
    }
    return data as T;
};

const REPO_NAME = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;
const parseRepo = (value: unknown) => {
    const repo = String(value ?? "").trim().replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$/i, "").replace(/\/$/, "");
    if (!REPO_NAME.test(repo)) throw new AppError("Choose a repository (owner/name)", 400);
    return repo;
};
const BRANCH = /^[A-Za-z0-9._/-]{1,200}$/;
const parseBranch = (value: unknown) => {
    if (value === undefined || value === null || value === "") return null;
    const branch = String(value).trim();
    if (!BRANCH.test(branch) || branch.includes("..")) throw new AppError("Invalid branch name", 400);
    return branch;
};

/* -------------------------------------------------------------------------- */
/* CONNECT                                                                    */
/* -------------------------------------------------------------------------- */
export const isAvailable = () => Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);

/** One-time ticket so the browser can start connecting with a plain link. */
export const createTicket = async (userId: Id, next: unknown) => {
    if (!isAvailable()) throw new AppError("GitHub isn't set up on this server", 503);
    const ticket = crypto.randomBytes(24).toString("base64url");
    const back = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/settings/account";
    await redisClient.set(`gh:ticket:${ticket}`, JSON.stringify({ userId: String(userId), next: back }), "EX", 120);
    return { ticket };
};

/** The ticket becomes the OAuth state (tied to this browser by a cookie). */
export const startConnect = async (ticket: string, redirectUri: string) => {
    const raw = await redisClient.getdel(`gh:ticket:${ticket}`);
    if (!raw) throw new AppError("This link expired. Try connecting again.", 400);
    const state = crypto.randomBytes(24).toString("base64url");
    await redisClient.set(`gh:state:${state}`, raw, "EX", 600);
    const params = new URLSearchParams({
        client_id: process.env.GITHUB_CLIENT_ID!,
        redirect_uri: redirectUri,
        state,
        scope: SCOPE,
        allow_signup: "true",
    });
    return { state, url: `https://github.com/login/oauth/authorize?${params}`, next: (JSON.parse(raw) as { next: string }).next };
};

/** GitHub sent the browser back: trade the code for a token and keep it. */
export const finishConnect = async (state: string, code: string, redirectUri: string) => {
    const raw = await redisClient.getdel(`gh:state:${state}`);
    if (!raw) throw new AppError("Connecting expired. Try again.", 400);
    const { userId, next } = JSON.parse(raw) as { userId: string; next: string };

    const res = await fetch(process.env.GITHUB_OAUTH_TOKEN_URL || "https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: process.env.GITHUB_CLIENT_ID, client_secret: process.env.GITHUB_CLIENT_SECRET, code, redirect_uri: redirectUri }),
        signal: AbortSignal.timeout(10_000),
    });
    const token = await res.json().catch(() => ({})) as { access_token?: string; scope?: string };
    if (!token.access_token) throw new AppError("GitHub didn't connect. Try again.", 400);
    if (!String(token.scope ?? "").split(",").includes(SCOPE)) {
        throw new AppError("Aivex needs access to your repositories to push code. Try again and approve it.", 400);
    }
    const me = await gh<{ login: string }>(token.access_token, "/user");
    await userModel.updateOne(
        { _id: userId },
        { $set: { githubToken: encrypt(token.access_token), githubLogin: me.login, githubConnectedAt: new Date() } },
    );
    return { next, login: me.login };
};

export const status = async (userId: Id) => {
    const user = await userModel.findById(userId).select("githubLogin githubConnectedAt +githubToken").lean();
    return {
        available: isAvailable(),
        connected: Boolean(user?.githubToken),
        login: user?.githubToken ? user.githubLogin : "",
        connectedAt: user?.githubToken ? user.githubConnectedAt : null,
    };
};

/** Forget the token (and revoke it at GitHub when possible). */
export const disconnect = async (userId: Id) => {
    const user = await userModel.findById(userId).select("+githubToken").lean();
    if (user?.githubToken && isAvailable()) {
        try {
            const token = decrypt(user.githubToken);
            const basic = Buffer.from(`${process.env.GITHUB_CLIENT_ID}:${process.env.GITHUB_CLIENT_SECRET}`).toString("base64");
            await fetch(`${API()}/applications/${process.env.GITHUB_CLIENT_ID}/token`, {
                method: "DELETE",
                headers: { Accept: "application/vnd.github+json", Authorization: `Basic ${basic}`, "Content-Type": "application/json" },
                body: JSON.stringify({ access_token: token }),
                signal: AbortSignal.timeout(10_000),
            });
        } catch {
            /* the token is forgotten either way */
        }
    }
    await userModel.updateOne({ _id: userId }, { $set: { githubToken: "", githubLogin: "", githubConnectedAt: null } });
};

/* -------------------------------------------------------------------------- */
/* REPOSITORIES                                                               */
/* -------------------------------------------------------------------------- */
interface RepoInfo {
    full_name: string;
    private: boolean;
    default_branch: string;
    html_url: string;
    description: string | null;
    updated_at: string;
    size?: number;
}

const repoSummary = (r: RepoInfo) => ({
    fullName: r.full_name,
    private: r.private,
    defaultBranch: r.default_branch,
    url: r.html_url,
    description: r.description ?? "",
    updatedAt: r.updated_at,
});

export const listRepos = async (userId: Id) => {
    const token = await tokenOf(userId);
    const repos = await gh<RepoInfo[]>(token, "/user/repos?sort=updated&per_page=100&affiliation=owner,collaborator,organization_member");
    return repos.map(repoSummary);
};

/* -------------------------------------------------------------------------- */
/* FILES                                                                      */
/* -------------------------------------------------------------------------- */
/** Files that go to GitHub: everything but Aivex's own notes. */
const pushable = (files: Record<string, string>) =>
    Object.fromEntries(Object.entries(files).filter(([p]) => !LOCAL_ONLY.has(p)).sort(([a], [b]) => a.localeCompare(b)));

export const hashFiles = (files: Record<string, string>) => {
    const h = crypto.createHash("sha256");
    for (const [path, contents] of Object.entries(pushable(files))) h.update(path).update("\0").update(contents).update("\0");
    return h.digest("hex");
};

/** Text files of a commit (binary, huge and generated files are skipped). */
const readCommit = async (token: string, repo: string, commitSha: string) => {
    const tree = await gh<{ tree: { path: string; type: string; sha: string; size?: number }[]; truncated: boolean }>(
        token, `/repos/${repo}/git/trees/${commitSha}?recursive=1`,
    );
    const blobs = tree.tree.filter((e) => e.type === "blob" && !SKIP_PATH.test(`${e.path}`) && (e.size ?? 0) <= MAX_FILE_BYTES);
    const skipped = tree.tree.filter((e) => e.type === "blob").length - blobs.length;
    if (blobs.length > MAX_FILES) throw new AppError(`This repository has too many files (over ${MAX_FILES}) to open in Aivex`, 413);

    const files: Record<string, string> = {};
    let total = 0;
    let binary = 0;
    // A few at a time: GitHub limits concurrent requests
    for (let i = 0; i < blobs.length; i += 8) {
        const batch = await Promise.all(blobs.slice(i, i + 8).map(async (e) => ({
            path: e.path,
            blob: await gh<{ content: string; encoding: string }>(token, `/repos/${repo}/git/blobs/${e.sha}`),
        })));
        for (const { path, blob } of batch) {
            const buf = Buffer.from(blob.content, blob.encoding === "base64" ? "base64" : "utf8");
            if (buf.includes(0)) {
                binary++;
                continue;
            }
            total += buf.length;
            if (total > MAX_TOTAL_BYTES) throw new AppError("This repository is too large to open in Aivex (10 MB of text)", 413);
            files[path] = buf.toString("utf8");
        }
    }
    return { files, skipped: skipped + binary, truncated: tree.truncated };
};

const headOf = async (token: string, repo: string, branch: string) => {
    try {
        const ref = await gh<{ object: { sha: string } }>(token, `/repos/${repo}/git/ref/heads/${encodeURIComponent(branch).replace(/%2F/g, "/")}`);
        return ref.object.sha;
    } catch (err) {
        // A missing branch is a 404; an empty repository answers 409
        const status = (err as GitHubError).githubStatus;
        if (status === 404 || status === 409) return null;
        throw err;
    }
};

const projectFor = async (projectId: string, userId: Id) => {
    if (!mongoose.Types.ObjectId.isValid(projectId)) throw new AppError("Invalid project id", 400);
    const project = await Project.findById(projectId);
    if (!project) throw new AppError("Project not found", 404);
    if (String(project.owner) !== String(userId)) throw new AppError("Only the project's owner can sync it with GitHub", 403);
    return project;
};

/* -------------------------------------------------------------------------- */
/* PUSH                                                                       */
/* -------------------------------------------------------------------------- */
export const push = async ({ projectId, userId, input }: { projectId: string; userId: Id; input: Record<string, unknown> }) => {
    const project = await projectFor(projectId, userId);
    const token = await tokenOf(userId);
    const message = String(input.message ?? "").trim().slice(0, 500) || "Update from Aivex";
    const files = pushable(fromStoredFiles(project.files));
    const paths = Object.keys(files);
    if (!paths.length) throw new AppError("The project has no files to push", 400);
    if (paths.length > MAX_FILES) throw new AppError(`Too many files to push (over ${MAX_FILES})`, 413);
    if (Object.values(files).reduce((n, c) => n + Buffer.byteLength(c), 0) > MAX_TOTAL_BYTES) {
        throw new AppError("The project is too large to push (10 MB)", 413);
    }

    // Which repository: a new one, the linked one, or one the user picked
    let repo: string;
    let info: RepoInfo;
    const create = input.create as { name?: unknown; private?: unknown } | undefined;
    if (create && typeof create === "object") {
        const name = String(create.name ?? "").trim();
        if (!/^[A-Za-z0-9_.-]{1,100}$/.test(name)) throw new AppError("Repository names can use letters, numbers, - _ and .", 400);
        try {
            info = await gh<RepoInfo>(token, "/user/repos", {
                method: "POST",
                body: { name, private: create.private !== false, auto_init: true, description: `Made with Aivex: ${project.name}`.slice(0, 300) },
            });
        } catch (err) {
            if ((err as GitHubError).githubStatus === 422) throw new AppError("You already have a repository with this name", 409);
            throw err;
        }
        repo = info.full_name;
    } else {
        repo = parseRepo(input.repo ?? project.github?.repo);
        info = await gh<RepoInfo>(token, `/repos/${repo}`);
    }
    const linked = project.github?.repo === repo ? project.github : null;
    const branch = parseBranch(input.branch) ?? linked?.branch ?? info.default_branch ?? "main";

    let head = await headOf(token, repo, branch);
    // GitHub moved on since the last sync (someone pushed from elsewhere)
    if (linked?.lastCommit && head && head !== linked.lastCommit && input.force !== true) {
        throw new AppError("GitHub has newer commits than this project. Pull them first, or push anyway to replace them.", 409);
    }
    // A branch that doesn't exist yet starts from the default branch
    if (!head && branch !== info.default_branch) head = await headOf(token, repo, info.default_branch);
    // A completely empty repository needs a first commit before the Git Data API works
    if (!head) {
        const [first] = paths;
        const made = await gh<{ commit: { sha: string } }>(token, `/repos/${repo}/contents/${first.split("/").map(encodeURIComponent).join("/")}`, {
            method: "PUT",
            body: { message, content: Buffer.from(files[first]).toString("base64"), branch },
        });
        head = made.commit.sha;
    }

    const tree = await gh<{ sha: string }>(token, `/repos/${repo}/git/trees`, {
        method: "POST",
        body: { tree: paths.map((path) => ({ path, mode: "100644", type: "blob", content: files[path] })) },
    });
    const parent = await gh<{ tree: { sha: string } }>(token, `/repos/${repo}/git/commits/${head}`);
    let commitSha = head;
    let changed = false;
    if (parent.tree.sha !== tree.sha) {
        const commit = await gh<{ sha: string }>(token, `/repos/${repo}/git/commits`, {
            method: "POST",
            body: { message, tree: tree.sha, parents: [head] },
        });
        commitSha = commit.sha;
        changed = true;
        const refPath = `/repos/${repo}/git/refs/heads/${branch}`;
        const exists = await headOf(token, repo, branch);
        if (exists) await gh(token, refPath, { method: "PATCH", body: { sha: commitSha, force: false } });
        else await gh(token, `/repos/${repo}/git/refs`, { method: "POST", body: { ref: `refs/heads/${branch}`, sha: commitSha } });
    }

    project.github = { repo, branch, lastCommit: commitSha, syncedHash: hashFiles(files), syncedAt: new Date() };
    await project.save();
    notifyProjectUpdated(String(project._id), "github");
    return {
        changed,
        repo,
        branch,
        commit: commitSha,
        url: `https://github.com/${repo}${changed ? `/commit/${commitSha}` : `/tree/${branch}`}`,
        link: project.github,
    };
};

/* -------------------------------------------------------------------------- */
/* PULL                                                                       */
/* -------------------------------------------------------------------------- */
export const pull = async ({ projectId, userId, force }: { projectId: string; userId: Id; force?: unknown }) => {
    const project = await projectFor(projectId, userId);
    const link = project.github;
    if (!link?.repo) throw new AppError("This project isn't linked to a GitHub repository yet", 400);
    const token = await tokenOf(userId);
    const head = await headOf(token, link.repo, link.branch);
    if (!head) throw new AppError(`The branch ${link.branch} doesn't exist on GitHub any more`, 404);
    const current = fromStoredFiles(project.files);
    if (head === link.lastCommit) return { changed: false, commit: head, link };

    if (hashFiles(current) !== link.syncedHash && force !== true) {
        throw new AppError("This project has changes that aren't on GitHub. Push them first, or pull anyway to replace them.", 409);
    }

    const { files: incoming, skipped } = await readCommit(token, link.repo, head);
    const next: Record<string, string> = { ...incoming };
    for (const p of LOCAL_ONLY) if (current[p] !== undefined) next[p] = current[p];

    const changed = Object.fromEntries(Object.entries(next).filter(([p, c]) => current[p] !== c));
    const deleted = Object.keys(current).filter((p) => next[p] === undefined);
    project.files = toStoredFiles(next);
    project.github = { ...link, lastCommit: head, syncedHash: hashFiles(next), syncedAt: new Date() };
    await project.save();
    recordSafely(recordChange({ project, before: current, after: next, actor: userId, type: "save" }));

    // Open editors update in place
    const room = await collab.getRoom(String(project._id));
    if (room) {
        const update = collab.applyFileChanges(room.doc, changed, deleted);
        if (update) emitToProject(String(project._id), "collab:update", update);
    }
    notifyProjectUpdated(String(project._id), "github");
    return { changed: true, commit: head, skipped, files: next, link: project.github };
};

/* -------------------------------------------------------------------------- */
/* IMPORT                                                                     */
/* -------------------------------------------------------------------------- */
const detectStack = (files: Record<string, string>): ProjectStack => {
    const paths = Object.keys(files);
    const pkg = files["package.json"];
    if (pkg) {
        if (/"next"\s*:/.test(pkg)) return "nextjs";
        if (/"react"\s*:/.test(pkg)) return "react";
        return "nodejs";
    }
    if (paths.some((p) => /\.(cpp|cc|cxx|hpp)$/i.test(p))) return "cpp";
    if (paths.some((p) => /\.c$/i.test(p))) return "c";
    if (paths.some((p) => /\.html?$/i.test(p))) return "htmlcssjs";
    return "nodejs";
};

export const importRepo = async ({ userId, input }: { userId: Id; input: Record<string, unknown> }) => {
    const token = await tokenOf(userId);
    const repo = parseRepo(input.repo);
    const info = await gh<RepoInfo>(token, `/repos/${repo}`);
    const branch = parseBranch(input.branch) ?? info.default_branch;
    const head = await headOf(token, repo, branch);
    if (!head) throw new AppError("This repository is empty", 400);
    const { files, skipped } = await readCommit(token, repo, head);
    if (!Object.keys(files).length) throw new AppError("This repository has no text files to open", 400);

    // Project names are unique site-wide
    const base = String(input.name ?? "").trim().slice(0, 80) || repo.split("/")[1];
    let project = null;
    for (let attempt = 0; attempt < 4 && !project; attempt++) {
        try {
            project = await Project.create({
                name: attempt === 0 ? base : `${base}-${crypto.randomBytes(2).toString("hex")}`,
                owner: userId,
                users: [userId],
                stack: detectStack(files),
                files: toStoredFiles(files),
                github: { repo, branch, lastCommit: head, syncedHash: hashFiles(files), syncedAt: new Date() },
            });
        } catch (err) {
            if ((err as { code?: number }).code !== 11000) throw err;
        }
    }
    if (!project) throw new AppError("Couldn't create the project, try another name", 409);
    return { projectId: project._id, name: project.name, stack: project.stack, files: Object.keys(files).length, skipped };
};

/** Stop syncing a project (the repository stays on GitHub). */
export const unlink = async ({ projectId, userId }: { projectId: string; userId: Id }) => {
    const project = await projectFor(projectId, userId);
    project.github = null;
    await project.save();
    notifyProjectUpdated(String(project._id), "github");
};

/** The project's link and whether GitHub moved on since. */
export const projectStatus = async ({ projectId, userId }: { projectId: string; userId: Id }) => {
    const project = await projectFor(projectId, userId);
    const link = project.github;
    if (!link?.repo) return { link: null, localChanges: false, remoteChanges: false };
    const localChanges = hashFiles(fromStoredFiles(project.files)) !== link.syncedHash;
    let remoteChanges = false;
    try {
        const token = await tokenOf(userId);
        const head = await headOf(token, link.repo, link.branch);
        remoteChanges = Boolean(head && head !== link.lastCommit);
    } catch {
        /* not connected or offline: show what we know */
    }
    return { link, localChanges, remoteChanges };
};
