import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";
import request from "supertest";
import { as, canRun, createUser, setup, teardown, type TestUser } from "./helpers.js";

/* A tiny in-memory GitHub: repos, refs, trees, commits, blobs. */
const sha = (s: string) => crypto.createHash("sha1").update(s).digest("hex");
const blobs = new Map<string, string>();
const trees = new Map<string, Record<string, string>>(); // path -> blob sha
const commits = new Map<string, { tree: string; parents: string[]; message: string }>();
const repos = new Map<string, { private: boolean; default_branch: string; refs: Map<string, string> }>();
let grantedScope = "repo";

const commitFiles = (repo: string, branch: string, files: Record<string, string>, message: string) => {
    const r = repos.get(repo)!;
    const entries: Record<string, string> = {};
    for (const [p, c] of Object.entries(files)) {
        const b = sha(`blob${c}`);
        blobs.set(b, c);
        entries[p] = b;
    }
    const t = sha(`tree${JSON.stringify(Object.entries(entries).sort())}`);
    trees.set(t, entries);
    const parent = r.refs.get(branch);
    const c = sha(`commit${t}${parent}${message}${Math.random()}`);
    commits.set(c, { tree: t, parents: parent ? [parent] : [], message });
    r.refs.set(branch, c);
    return c;
};
const filesAt = (repo: string, branch = "main") => {
    const c = commits.get(repos.get(repo)!.refs.get(branch)!)!;
    return Object.fromEntries(Object.entries(trees.get(c.tree)!).map(([p, b]) => [p, blobs.get(b)!]));
};

const mock = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
        const body = raw ? JSON.parse(raw) : {};
        const url = new URL(req.url!, "http://x");
        const send = (status: number, data?: unknown) => res.writeHead(status, { "Content-Type": "application/json" }).end(data === undefined ? "" : JSON.stringify(data));
        const p = url.pathname;
        const info = (name: string) => ({ full_name: name, private: repos.get(name)!.private, default_branch: repos.get(name)!.default_branch, html_url: `https://github.com/${name}`, description: null, updated_at: new Date().toISOString() });
        if (p === "/login/oauth/access_token") return send(200, body.code === "good" ? { access_token: "gho_secret", scope: grantedScope } : { error: "bad_verification_code" });
        if (req.headers.authorization !== "Bearer gho_secret" && !p.startsWith("/applications")) return send(401, { message: "Bad credentials" });
        if (p.startsWith("/applications/")) return send(204);
        if (p === "/user") return send(200, { login: "octo" });
        if (p === "/user/repos" && req.method === "GET") return send(200, [...repos.keys()].map(info));
        if (p === "/user/repos" && req.method === "POST") {
            const name = `octo/${body.name}`;
            if (repos.has(name)) return send(422, { message: "name already exists on this account" });
            repos.set(name, { private: body.private, default_branch: "main", refs: new Map() });
            if (body.auto_init) commitFiles(name, "main", { "README.md": `# ${body.name}\n` }, "Initial commit");
            return send(201, info(name));
        }
        const m = p.match(/^\/repos\/([^/]+\/[^/]+)(\/.*)?$/);
        if (!m || !repos.has(m[1])) return send(404, { message: "Not Found" });
        const [, name, rest = ""] = m;
        const r = repos.get(name)!;
        if (!rest) return send(200, info(name));
        let mm;
        if ((mm = rest.match(/^\/git\/ref\/heads\/(.+)$/))) {
            if (!r.refs.size) return send(409, { message: "Git Repository is empty." });
            const head = r.refs.get(mm[1]);
            return head ? send(200, { object: { sha: head } }) : send(404, { message: "Not Found" });
        }
        if (rest === "/git/trees" && req.method === "POST") {
            const entries: Record<string, string> = {};
            for (const e of body.tree) {
                const b = sha(`blob${e.content}`);
                blobs.set(b, e.content);
                entries[e.path] = b;
            }
            const t = sha(`tree${JSON.stringify(Object.entries(entries).sort())}`);
            trees.set(t, entries);
            return send(201, { sha: t });
        }
        if ((mm = rest.match(/^\/git\/trees\/(\w+)$/))) {
            const c = commits.get(mm[1]);
            const entries = trees.get(c ? c.tree : mm[1])!;
            return send(200, { truncated: false, tree: Object.entries(entries).map(([path, b]) => ({ path, type: "blob", sha: b, size: blobs.get(b)!.length })) });
        }
        if ((mm = rest.match(/^\/git\/blobs\/(\w+)$/))) return send(200, { content: Buffer.from(blobs.get(mm[1])!).toString("base64"), encoding: "base64" });
        if (rest === "/git/commits" && req.method === "POST") {
            const c = sha(`commit${body.tree}${body.parents}${body.message}`);
            commits.set(c, { tree: body.tree, parents: body.parents, message: body.message });
            return send(201, { sha: c });
        }
        if ((mm = rest.match(/^\/git\/commits\/(\w+)$/))) return send(200, { tree: { sha: commits.get(mm[1])!.tree } });
        if ((mm = rest.match(/^\/git\/refs\/heads\/(.+)$/)) && req.method === "PATCH") {
            const current = r.refs.get(mm[1]);
            if (!body.force && current && !commits.get(body.sha)!.parents.includes(current)) return send(422, { message: "Update is not a fast forward" });
            r.refs.set(mm[1], body.sha);
            return send(200, {});
        }
        if (rest === "/git/refs" && req.method === "POST") {
            r.refs.set(body.ref.replace("refs/heads/", ""), body.sha);
            return send(201, {});
        }
        if ((mm = rest.match(/^\/contents\/(.+)$/)) && req.method === "PUT") {
            const c = commitFiles(name, body.branch, { [decodeURIComponent(mm[1])]: Buffer.from(body.content, "base64").toString() }, body.message);
            return send(201, { commit: { sha: c } });
        }
        send(404, { message: "Not Found" });
    });
});

describe("GitHub sync", { skip: !canRun && "set TEST_MONGO_URL to run API tests" }, () => {
    let app: Awaited<ReturnType<typeof setup>>;
    let user: TestUser;
    let other: TestUser;
    let projectId: string;
    let Project: typeof import("../models/project.model.js").default;

    before(async () => {
        await new Promise<void>((r) => mock.listen(0, r));
        const base = `http://127.0.0.1:${(mock.address() as AddressInfo).port}`;
        Object.assign(process.env, {
            GITHUB_CLIENT_ID: "client", GITHUB_CLIENT_SECRET: "secret",
            GITHUB_API_BASE: base, GITHUB_OAUTH_TOKEN_URL: `${base}/login/oauth/access_token`,
            FRONTEND_URL: "http://app.test", BACKEND_URL: "http://api.test",
        });
        app = await setup();
        Project = (await import("../models/project.model.js")).default;
        [user, other] = await Promise.all([createUser(), createUser()]);
        projectId = (await as(user).post("/projects", { name: `gh-${crypto.randomBytes(3).toString("hex")}`, stack: "c" })).body._id
            ?? (await as(user).get("/projects")).body[0]._id;
    });
    after(async () => {
        mock.close();
        await teardown();
    });

    /** The browser side of connecting: ticket, redirect to GitHub, callback. */
    const connect = async (code = "good") => {
        const { ticket } = (await as(user).post("/integrations/github/ticket", { next: `/projects/${projectId}` })).body;
        const start = await request(app).get(`/auth/github/connect?ticket=${ticket}`);
        assert.equal(start.status, 302);
        const to = new URL(start.headers.location);
        assert.equal(to.searchParams.get("scope"), "repo");
        assert.equal(to.searchParams.get("redirect_uri"), "http://api.test/auth/github/callback/connect");
        const cookie = start.headers["set-cookie"];
        return request(app).get(`/auth/github/callback/connect?code=${code}&state=${to.searchParams.get("state")}`).set("Cookie", cookie);
    };

    it("asks to connect first", async () => {
        assert.deepEqual((await as(user).get("/integrations/github")).body, { available: true, connected: false, login: "", connectedAt: null });
        const res = await as(user).post(`/projects/${projectId}/github/push`, { create: { name: "x" } });
        assert.equal(res.status, 400);
        assert.match(res.body.message, /Connect your GitHub/);
    });

    it("connecting needs the browser that started it", async () => {
        const { ticket } = (await as(user).post("/integrations/github/ticket")).body;
        const start = await request(app).get(`/auth/github/connect?ticket=${ticket}`);
        const state = new URL(start.headers.location).searchParams.get("state");
        const res = await request(app).get(`/auth/github/callback/connect?code=good&state=${state}`); // no cookie
        assert.match(res.headers.location, /github=error/);
        assert.equal((await as(user).get("/integrations/github")).body.connected, false);
    });

    it("refuses a connection without repository access", async () => {
        grantedScope = "read:user";
        const res = await connect();
        grantedScope = "repo";
        assert.match(new URL(res.headers.location).searchParams.get("message") ?? "", /needs access to your repositories/);
    });

    it("connects and keeps the token encrypted", async () => {
        const res = await connect();
        assert.equal(res.headers.location, `http://app.test/projects/${projectId}?github=connected`);
        const status = (await as(user).get("/integrations/github")).body;
        assert.equal(status.connected, true);
        assert.equal(status.login, "octo");
        const User = (await import("../models/user.model.js")).default;
        const stored = await User.findById(user.id).select("+githubToken").lean();
        assert.ok(stored!.githubToken && !stored!.githubToken.includes("gho_secret"));
    });

    it("pushes a project to a new private repository", async () => {
        await as(user).patch(`/projects/${projectId}`, { fileTree: { "main.c": "int main(){return 0;}\n", "lib/util.h": "#pragma once\n", ".aivex": "notes" } });
        const res = await as(user).post(`/projects/${projectId}/github/push`, { create: { name: "my-c-app", private: true }, message: "First push" });
        assert.equal(res.status, 200, JSON.stringify(res.body));
        assert.equal(res.body.repo, "octo/my-c-app");
        assert.equal(res.body.changed, true);
        assert.equal(repos.get("octo/my-c-app")!.private, true);
        // The repository matches the project (Aivex's notes stay in Aivex)
        assert.deepEqual(filesAt("octo/my-c-app"), { "main.c": "int main(){return 0;}\n", "lib/util.h": "#pragma once\n" });
        assert.equal(commits.get(res.body.commit)!.message, "First push");
        assert.equal((await as(user).get(`/projects/${projectId}/github`)).body.link.repo, "octo/my-c-app");
    });

    it("a second push without changes makes no commit; a change does", async () => {
        const same = await as(user).post(`/projects/${projectId}/github/push`, {});
        assert.equal(same.body.changed, false);
        await as(user).patch(`/projects/${projectId}`, { fileTree: { "main.c": "int main(){return 1;}\n", ".aivex": "notes" } });
        const status = (await as(user).get(`/projects/${projectId}/github`)).body;
        assert.equal(status.localChanges, true);
        const res = await as(user).post(`/projects/${projectId}/github/push`, { message: "Remove util" });
        assert.equal(res.body.changed, true);
        assert.deepEqual(filesAt("octo/my-c-app"), { "main.c": "int main(){return 1;}\n" });
    });

    it("won't overwrite newer commits on GitHub without asking", async () => {
        commitFiles("octo/my-c-app", "main", { "main.c": "int main(){return 2;}\n", "README.md": "# hi\n" }, "Edit on GitHub");
        assert.equal((await as(user).get(`/projects/${projectId}/github`)).body.remoteChanges, true);
        await as(user).patch(`/projects/${projectId}`, { fileTree: { "main.c": "int main(){return 3;}\n" } });
        const res = await as(user).post(`/projects/${projectId}/github/push`, {});
        assert.equal(res.status, 409);
        // Pulling would lose the local edit: also asks
        assert.equal((await as(user).post(`/projects/${projectId}/github/pull`, {})).status, 409);
    });

    it("pull anyway takes GitHub's version", async () => {
        const res = await as(user).post(`/projects/${projectId}/github/pull`, { force: true });
        assert.equal(res.status, 200);
        const files = (await as(user).get(`/projects/${projectId}`)).body;
        const flat = files.files ?? files.project?.files ?? files.flatFileTree;
        assert.equal(flat["main.c"], "int main(){return 2;}\n");
        assert.equal(flat["README.md"], "# hi\n");
        const status = (await as(user).get(`/projects/${projectId}/github`)).body;
        assert.deepEqual([status.localChanges, status.remoteChanges], [false, false]);
    });

    it("pulls cleanly when only GitHub changed", async () => {
        commitFiles("octo/my-c-app", "main", { "main.c": "int main(){return 4;}\n" }, "Another");
        const res = await as(user).post(`/projects/${projectId}/github/pull`, {});
        assert.equal(res.body.changed, true);
        assert.equal((await as(user).post(`/projects/${projectId}/github/pull`, {})).body.changed, false);
    });

    it("push anyway replaces GitHub's newer commits", async () => {
        commitFiles("octo/my-c-app", "main", { "main.c": "remote\n" }, "Remote");
        await as(user).patch(`/projects/${projectId}`, { fileTree: { "main.c": "local\n" } });
        const res = await as(user).post(`/projects/${projectId}/github/push`, { force: true });
        assert.equal(res.status, 200);
        assert.equal(filesAt("octo/my-c-app")["main.c"], "local\n");
    });

    it("only the owner syncs", async () => {
        await Project.updateOne({ _id: projectId }, { $addToSet: { users: other.id } });
        assert.equal((await as(other).post(`/projects/${projectId}/github/push`, {})).status, 403);
    });

    it("lists repositories and imports one as a new project", async () => {
        repos.set("octo/calc", { private: false, default_branch: "main", refs: new Map() });
        commitFiles("octo/calc", "main", { "src/calc.cpp": "int main(){}\n", "README.md": "calc\n" }, "init");
        const list = (await as(user).get("/integrations/github/repos")).body;
        assert.ok(list.some((r: { fullName: string }) => r.fullName === "octo/calc"));
        const res = await as(user).post("/integrations/github/import", { repo: "https://github.com/octo/calc" });
        assert.equal(res.status, 201, JSON.stringify(res.body));
        assert.equal(res.body.stack, "cpp");
        const p = await Project.findById(res.body.projectId).lean();
        assert.equal(p!.github!.repo, "octo/calc");
        assert.equal((await as(user).get(`/projects/${res.body.projectId}/github`)).body.localChanges, false);
    });

    it("pushes into an empty existing repository", async () => {
        repos.set("octo/empty", { private: true, default_branch: "main", refs: new Map() });
        const res = await as(user).post(`/projects/${projectId}/github/push`, { repo: "octo/empty" });
        assert.equal(res.status, 200, JSON.stringify(res.body));
        assert.equal(filesAt("octo/empty")["main.c"], "local\n");
    });

    it("disconnects", async () => {
        assert.equal((await as(user).delete("/integrations/github")).status, 204);
        assert.equal((await as(user).get("/integrations/github")).body.connected, false);
    });
});
