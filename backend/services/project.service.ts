import mongoose, { type Types } from "mongoose";
import Project, { PROJECT_STACKS, type ProjectStack } from "../models/project.model.js";
import userModel from "../models/user.model.js";
import AppError from "../errors/AppError.js";
import * as chatService from "../services/chats.service.js";
import Classroom from "../models/classroom.model.js";
import { aiPolicyFor } from "./aiPolicy.service.js";
import Assignment from "../models/assignment.model.js";
import { openRequestFor } from "./help.service.js";
import { recordChange, recordSafely } from "./journey.service.js";
import { pullStudent } from "./classroom.service.js";
import { notify, resolveInviteNotifications } from "./notification.service.js";
import { notifyProjectUpdated } from "../socket/io.js";
import { fromStoredFiles, toStoredFiles } from "../utils/fileStore.js";

type Id = Types.ObjectId | string;

/** Starter for C projects: compiled and run in the browser. */
const C_STARTER: Record<string, string> = {
    "main.c": `#include <stdio.h>

int main(void) {
    char name[50];
    int n;

    printf("What's your name? ");
    scanf("%49s", name);
    printf("Hello, %s! How many squares should I print? ", name);
    scanf("%d", &n);

    for (int i = 1; i <= n; i++) {
        printf("%d x %d = %d\\n", i, i, i * i);
    }
    return 0;
}
`,
};

/** Starter for C++ projects: compiled and run in the browser too. */
const CPP_STARTER: Record<string, string> = {
    "main.cpp": `#include <iostream>
#include <string>
#include <vector>
using namespace std;

int main() {
    string name;
    int n;

    cout << "What's your name? ";
    cin >> name;
    cout << "Hello, " << name << "! How many squares should I print? ";
    cin >> n;

    vector<int> squares;
    for (int i = 1; i <= n; i++) squares.push_back(i * i);
    for (int i = 0; i < (int)squares.size(); i++) {
        cout << i + 1 << " x " << i + 1 << " = " << squares[i] << "\\n";
    }
    return 0;
}
`,
};

/** Starter for HTML/CSS/JS projects: previews instantly, no install. */
const STATIC_SITE_STARTER: Record<string, string> = {
    "index.html": `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>My Site</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <main>
    <h1>Hello, Aivex 👋</h1>
    <p>Edit <code>index.html</code>, <code>style.css</code> or <code>script.js</code>: the preview updates as you type.</p>
    <button id="counter">Clicked 0 times</button>
  </main>
  <script src="script.js"></script>
</body>
</html>
`,
    "style.css": `* { box-sizing: border-box; }

body {
  margin: 0;
  min-height: 100vh;
  display: grid;
  place-items: center;
  font-family: system-ui, sans-serif;
  background: #0f172a;
  color: #e2e8f0;
}

main { text-align: center; padding: 2rem; }

button {
  padding: 0.6rem 1.2rem;
  border: 0;
  border-radius: 0.5rem;
  background: #14b8a6;
  color: #042f2e;
  font-weight: 600;
  cursor: pointer;
}
`,
    "script.js": `const button = document.getElementById("counter");
let count = 0;

button.addEventListener("click", () => {
  count++;
  button.textContent = \`Clicked \${count} time\${count === 1 ? "" : "s"}\`;
  console.log("count:", count);
});
`,
};

/* -------------------------------------------------------------------------- */
/* CREATE PROJECT                                                             */
/* -------------------------------------------------------------------------- */
/** "Next.js" -> "nextjs", "Node.js" -> "nodejs", "HTML/CSS/JS" -> "htmlcssjs", "C++" -> "cpp"; throws if unknown. */
export const normalizeStack = (stack: unknown): ProjectStack => {
    const normalized = typeof stack === "string"
        ? stack.toLowerCase().replace(/[.\-\s/]/g, "").replace("c++", "cpp")
        : "nodejs";
    if (!PROJECT_STACKS.includes(normalized as ProjectStack)) {
        throw new AppError(`Stack must be one of: ${PROJECT_STACKS.join(", ")}`, 400);
    }
    return normalized as ProjectStack;
};

/** Files a new project of `stack` starts with. */
export const starterFilesFor = (stack: ProjectStack): Record<string, string> => ({
    ".aivex": "//Aivex System File - Do not delete",
    ...(stack === "htmlcssjs" ? STATIC_SITE_STARTER : {}),
    ...(stack === "c" ? C_STARTER : {}),
    ...(stack === "cpp" ? CPP_STARTER : {}),
});

export const createProject = async ({ name, userId, stack }: { name: string; userId: Id; stack?: unknown }) => {
    if (!name) throw new AppError("Project name required", 400);
    if (!userId) throw new AppError("UserId required", 400);

    const normalizedStack = normalizeStack(stack);

    try {
        const project = await Project.create({
            name,
            owner: userId,
            users: [userId],
            stack: normalizedStack,
            files: toStoredFiles(starterFilesFor(normalizedStack)),
        });
        const obj = project.toObject();
        return { ...obj, files: fromStoredFiles(obj.files) };
    } catch (err) {
        if ((err as { code?: number }).code === 11000) {
            throw new AppError("Project with this name already exists", 409);
        }
        throw err;
    }
};

/* -------------------------------------------------------------------------- */
/* CLASS PROJECTS                                                             */
/* -------------------------------------------------------------------------- */
/**
 * A student's class project belongs to the student and the class's teacher
 * only: membership comes from the class, not from project invites.
 */
const classTeacherOf = async (project: { classroom?: Types.ObjectId | null }) => {
    if (!project.classroom) return null;
    const classroom = await Classroom.findById(project.classroom).select("teacher").lean();
    return classroom ? classroom.teacher : null;
};

/* -------------------------------------------------------------------------- */
/* USER PROJECTS                                                              */
/* -------------------------------------------------------------------------- */
export const userAllProjects = async ({ userId }: { userId: Id }) => {
    if (!userId) throw new AppError("UserId required", 400);

    // The dashboard never needs file contents; skipping them keeps the
    // response small no matter how big the projects are.
    return Project.find({ users: userId })
        .select("-files")
        .sort({ createdAt: -1 })
        .lean();
};

/* -------------------------------------------------------------------------- */
/* GET PROJECT BY ID                                                          */
/* -------------------------------------------------------------------------- */
export const getProjectById = async ({ projectId, userId }: { projectId: string; userId: Id }) => {
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
        throw new AppError("Invalid projectId", 400);
    }

    const project = await Project.findOne({
        _id: projectId,
        users: userId,
    })
        .populate("users", "name username")
        .populate("invites.user", "name username")
        .lean();

    if (!project) {
        throw new AppError("Project not found or access denied", 404);
    }

    const isOwner = project.owner.toString() === userId.toString();
    const [aiPolicy, assignment, helpRequest] = await Promise.all([
        aiPolicyFor(project, userId),
        project.assignment
            ? Assignment.findById(project.assignment).select("title instructions dueAt aiPolicy classroom").lean()
            : null,
        // The student's open "I need help" request, shown on their button
        project.classroom && isOwner ? openRequestFor(project._id) : null,
    ]);

    return {
        ...project,
        files: fromStoredFiles(project.files),
        isOwner,
        aiPolicy,
        helpRequest: helpRequest ? { _id: helpRequest._id, createdAt: helpRequest.createdAt } : null,
        aiDisabled: aiPolicy === "disabled",
        assignment: assignment
            ? {
                _id: assignment._id,
                classroom: assignment.classroom,
                title: assignment.title,
                instructions: assignment.instructions,
                dueAt: assignment.dueAt,
                aiPolicy: assignment.aiPolicy,
            }
            : null,
    };
};

/* -------------------------------------------------------------------------- */
/* DELETE PROJECT                                                             */
/* -------------------------------------------------------------------------- */
export const deleteProject = async ({ projectId, userId }: { projectId: string; userId: Id }) => {
    const project = await Project.findById(projectId);

    if (!project) {
        throw new AppError("Project not found", 404);
    }

    if (!project.owner.equals(userId)) {
        throw new AppError("Only owner can delete project", 403);
    }

    await chatService.deleteChatsByProjectId({ projectId });

    // A deleted class project also leaves its class
    if (project.classroom) {
        await pullStudent(project.classroom, { project: project._id });
    }

    await project.deleteOne();
};

/* -------------------------------------------------------------------------- */
/* UPDATE FILES                                                               */
/* -------------------------------------------------------------------------- */
export const updateProjectFiles = async ({ projectId, userId, fileTree }: {
    projectId: string;
    userId: Id;
    fileTree: Record<string, string>;
}) => {
    if (!fileTree) throw new AppError("File tree required", 400);

    const project = await Project.findOne({
        _id: projectId,
        users: userId,
    });

    if (!project) {
        throw new AppError("Access denied or project not found", 403);
    }

    const before = fromStoredFiles(project.files);
    project.files = toStoredFiles(fileTree);
    await project.save();
    recordSafely(recordChange({ project, before, after: fileTree, actor: userId, type: "save" }));
};

/* -------------------------------------------------------------------------- */
/* UPDATE PROJECT NAME                                                        */
/* -------------------------------------------------------------------------- */
export const updateProjectName = async ({
    projectId,
    userId,
    newName,
}: {
    projectId: string;
    userId: Id;
    newName: unknown;
}) => {

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
        throw new AppError("Invalid projectId", 400);
    }

    if (typeof newName !== "string" || !newName.trim()) {
        throw new AppError("Project name cannot be empty", 400);
    }

    const trimmedName = newName.trim();

    const project = await Project.findById(projectId);

    if (!project) {
        throw new AppError("Project not found", 404);
    }

    if (!project.owner.equals(userId)) {
        throw new AppError("Only project owner can rename the project", 403);
    }

    if (project.name === trimmedName) {
        throw new AppError("New project name must be different", 400);
    }

    if (project.lastRenamedAt) {
        const diffMs = Date.now() - project.lastRenamedAt.getTime();
        const hoursPassed = diffMs / (1000 * 60 * 60);

        if (hoursPassed < 24) {
            const remainingMs = 24 * 60 * 60 * 1000 - diffMs;
            const remainingHours = Math.ceil(
                remainingMs / (1000 * 60 * 60)
            );

            throw new AppError(
                `You can rename this project again in ${remainingHours} hour(s)`,
                400
            );
        }
    }

    project.name = trimmedName;
    project.lastRenamedAt = new Date();

    try {
        await project.save();
    } catch (err) {
        if ((err as { code?: number }).code === 11000) {
            throw new AppError("Project with this name already exists", 409);
        }
        throw err;
    }

    return {
        success: true,
        projectId,
        name: trimmedName,
    };
};


/* -------------------------------------------------------------------------- */
/* INVITE USERS                                                               */
/* -------------------------------------------------------------------------- */
export const inviteUsersToProject = async ({ ownerId, projectId, users }: {
    ownerId: Id;
    projectId: string;
    users: string[];
}) => {
    if (!Array.isArray(users) || users.length === 0) {
        throw new AppError("Users array required", 400);
    }

    const uniqueUsers = [...new Set(users)];

    if (!uniqueUsers.every(id => mongoose.Types.ObjectId.isValid(id))) {
        throw new AppError("Invalid users in list", 400);
    }

    const project = await Project.findById(projectId);

    if (!project) throw new AppError("Project not found", 404);
    if (!project.owner.equals(ownerId)) {
        throw new AppError("Only owner can invite users", 403);
    }
    if (await classTeacherOf(project)) {
        throw new AppError("Class projects are only shared with your teacher", 403);
    }

    const validUsers = await userModel.find({ _id: { $in: uniqueUsers } }).select("_id");

    if (validUsers.length !== uniqueUsers.length) {
        throw new AppError("Invalid users in list", 400);
    }

    // Members and people with a pending invite are skipped
    const toInvite = uniqueUsers.filter(
        id => !project.users.some(u => u.equals(id)) && !project.invites.some(i => i.user.equals(id))
    );

    if (toInvite.length === 0) {
        throw new AppError("Everyone selected is already a member or has been invited", 400);
    }

    // Nobody joins without saying yes: they get an invitation to accept or decline
    project.invites.push(...toInvite.map(id => ({
        user: new mongoose.Types.ObjectId(id),
        invitedBy: new mongoose.Types.ObjectId(String(ownerId)),
        createdAt: new Date(),
    })));
    await project.save();

    void notify({
        users: toInvite,
        type: "project-invite",
        title: `{actor} invited you to “${project.name}”`,
        body: "Accept to join the project and start coding together.",
        link: "",
        actorId: ownerId,
        projectId: project._id,
        status: "pending",
    });

    return {
        invitedCount: toInvite.length,
        usersCount: project.users.length,
    };
};

/* -------------------------------------------------------------------------- */
/* INVITATIONS (accept / decline / cancel)                                    */
/* -------------------------------------------------------------------------- */
export const listMyInvites = async ({ userId }: { userId: Id }) => {
    const projects = await Project.find({ "invites.user": userId })
        .select("name stack owner users invites")
        .populate("owner", "name username")
        .populate("invites.invitedBy", "name username")
        .lean();

    return projects.map((p) => {
        const invite = p.invites.find((i) => String(i.user) === String(userId))!;
        const invitedBy = invite.invitedBy as unknown as { name?: string; username?: string } | null;
        const owner = p.owner as unknown as { name?: string; username?: string };
        return {
            projectId: p._id,
            name: p.name,
            stack: p.stack,
            membersCount: p.users.length,
            owner: { name: owner?.name, username: owner?.username },
            invitedBy: { name: invitedBy?.name, username: invitedBy?.username },
            createdAt: invite.createdAt,
        };
    });
};

export const respondToInvite = async ({ projectId, userId, accept }: {
    projectId: string;
    userId: Id;
    accept: boolean;
}) => {
    if (!mongoose.Types.ObjectId.isValid(projectId)) throw new AppError("Invalid projectId", 400);

    const project = await Project.findOne({ _id: projectId, "invites.user": userId })
        .select("name invites")
        .lean();
    if (!project) {
        // Deleted project or withdrawn invite: settle the stale notification
        void resolveInviteNotifications({ userId, projectId, status: "expired" });
        throw new AppError("This invitation is no longer available", 404);
    }
    const invite = project.invites.find((i) => String(i.user) === String(userId))!;

    // Only if the invite is still there, so a double click can't answer twice
    const remaining = project.invites.filter((i) => String(i.user) !== String(userId));
    const result = await Project.updateOne(
        { _id: projectId, "invites.user": userId },
        accept
            ? { $set: { invites: remaining }, $addToSet: { users: userId } }
            : { $set: { invites: remaining } },
    );
    if (result.modifiedCount === 0) throw new AppError("This invitation is no longer available", 404);

    void resolveInviteNotifications({ userId, projectId, status: accept ? "accepted" : "declined" });
    void notify({
        users: [invite.invitedBy],
        type: accept ? "invite-accepted" : "invite-declined",
        title: accept
            ? `{actor} accepted your invite to “${project.name}”`
            : `{actor} declined your invite to “${project.name}”`,
        link: `/projects/${projectId}`,
        actorId: userId,
    });
    notifyProjectUpdated(projectId, "members");

    return { accepted: accept, projectId };
};

export const cancelInvite = async ({ projectId, ownerId, userId }: {
    projectId: string;
    ownerId: Id;
    userId: string;
}) => {
    if (!mongoose.Types.ObjectId.isValid(projectId) || !mongoose.Types.ObjectId.isValid(userId)) {
        throw new AppError("Invalid id", 400);
    }
    const project = await Project.findById(projectId).select("owner invites").lean();
    if (!project) throw new AppError("Project not found", 404);
    if (String(project.owner) !== String(ownerId)) {
        throw new AppError("Only the owner can cancel invitations", 403);
    }

    const remaining = project.invites.filter((i) => String(i.user) !== userId);
    const result = await Project.updateOne(
        { _id: projectId, "invites.user": userId },
        { $set: { invites: remaining } },
    );
    if (result.modifiedCount === 0) throw new AppError("No pending invitation for this user", 404);

    void resolveInviteNotifications({ userId, projectId, status: "cancelled" });
    notifyProjectUpdated(projectId, "members");
    return { success: true };
};

/* -------------------------------------------------------------------------- */
/* LEAVE PROJECT                                                              */
/* -------------------------------------------------------------------------- */
export const leaveProject = async ({ projectId, userId }: { projectId: string; userId: Id }) => {
    const project = await Project.findById(projectId);

    if (!project) throw new AppError("Project not found", 404);

    if (project.owner.equals(userId)) {
        throw new AppError("Owner cannot leave project", 403);
    }
    const teacher = await classTeacherOf(project);
    if (teacher?.equals(userId)) {
        throw new AppError("This is your student's class project. Remove the student from the class instead", 403);
    }

    if (!project.users.some(id => id.equals(userId))) {
        throw new AppError("User not in project", 400);
    }

    project.users = project.users.filter(id => !id.equals(userId));
    await project.save();

    return { success: true };
};

/* -------------------------------------------------------------------------- */
/* AI MEMORY                                                                  */
/* -------------------------------------------------------------------------- */
export const MAX_AI_MEMORY_CHARS = 2000;

export const updateAiMemory = async ({ projectId, userId, memory }: {
    projectId: string;
    userId: Id;
    memory: unknown;
}) => {
    if (typeof memory !== "string") {
        throw new AppError("memory must be text", 400);
    }
    if (memory.length > MAX_AI_MEMORY_CHARS) {
        throw new AppError(`Memory must be at most ${MAX_AI_MEMORY_CHARS} characters`, 400);
    }

    if (!mongoose.Types.ObjectId.isValid(projectId)) {
        throw new AppError("Invalid projectId", 400);
    }

    const result = await Project.updateOne(
        { _id: projectId, users: userId },
        { aiMemory: memory.trim() },
    );

    if (result.matchedCount === 0) throw new AppError("Project not found or access denied", 404);
    return { aiMemory: memory.trim() };
};

/**
 * Save the AI's changes straight to the project so they persist even if
 * nobody presses save. Merges into the stored files (unchanged files stay)
 * and applies deletions; the .aivex system file is never removed.
 */
export const applyAiChanges = async ({ projectId, changed, deleted = [], memory }: {
    projectId: Id;
    changed: Record<string, string>;
    deleted?: string[];
    memory?: string;
}) => {
    const project = await Project.findById(projectId).select("files aiMemory owner assignment classroom");
    if (!project) return false;

    const hasFileChanges = Object.keys(changed).length > 0 || deleted.length > 0;
    const before = fromStoredFiles(project.files);

    if (hasFileChanges) {
        const files = { ...before, ...changed };
        for (const path of deleted) {
            if (path === ".aivex") continue;
            for (const key of Object.keys(files)) {
                if (key === path || key.startsWith(path + "/")) delete files[key];
            }
        }
        project.files = toStoredFiles(files);
    }

    if (typeof memory === "string" && memory.trim()) {
        project.aiMemory = memory.trim().slice(0, MAX_AI_MEMORY_CHARS);
    }

    await project.save();
    if (hasFileChanges) {
        recordSafely(recordChange({ project, before, after: fromStoredFiles(project.files), actor: null, type: "ai-edit" }));
    }
    return hasFileChanges;
};

/* -------------------------------------------------------------------------- */
/* TRANSFER OWNERSHIP                                                         */
/* -------------------------------------------------------------------------- */
export const transferOwnership = async ({ projectId, ownerId, newOwnerId }: {
    projectId: string;
    ownerId: Id;
    newOwnerId: unknown;
}) => {
    if (typeof newOwnerId !== "string" || !mongoose.Types.ObjectId.isValid(newOwnerId)) {
        throw new AppError("A valid newOwnerId is required", 400);
    }

    const project = await Project.findById(projectId);
    if (!project) throw new AppError("Project not found", 404);

    if (!project.owner.equals(ownerId)) {
        throw new AppError("Only the owner can transfer ownership", 403);
    }

    if (project.owner.equals(newOwnerId)) {
        throw new AppError("You already own this project", 400);
    }

    if (!project.users.some(id => id.equals(newOwnerId))) {
        throw new AppError("New owner must be a member of the project", 400);
    }
    if (await classTeacherOf(project)) {
        throw new AppError("A class project stays with its student", 403);
    }

    project.owner = new mongoose.Types.ObjectId(newOwnerId);
    await project.save();

    void notify({
        users: [newOwnerId],
        type: "project-owner",
        title: `{actor} made you the owner of “${project.name}”`,
        link: `/projects/${project._id}`,
        actorId: ownerId,
    });

    return { success: true, owner: newOwnerId };
};

/* -------------------------------------------------------------------------- */
/* REMOVE MEMBER                                                              */
/* -------------------------------------------------------------------------- */
export const removeMember = async ({ projectId, ownerId, memberId }: {
    projectId: string;
    ownerId: Id;
    memberId: string;
}) => {
    if (!mongoose.Types.ObjectId.isValid(memberId)) {
        throw new AppError("Invalid member id", 400);
    }

    const project = await Project.findById(projectId);
    if (!project) throw new AppError("Project not found", 404);

    if (!project.owner.equals(ownerId)) {
        throw new AppError("Only the owner can remove members", 403);
    }

    if (project.owner.equals(memberId)) {
        throw new AppError("The owner cannot be removed", 400);
    }

    if (!project.users.some(id => id.equals(memberId))) {
        throw new AppError("User is not a member of this project", 404);
    }
    const teacher = await classTeacherOf(project);
    if (teacher?.equals(memberId)) {
        throw new AppError("Your teacher stays in class projects. Leave the class to remove them", 403);
    }

    project.users = project.users.filter(id => !id.equals(memberId));
    await project.save();

    void notify({
        users: [memberId],
        type: "project-removed",
        title: `{actor} removed you from “${project.name}”`,
        link: "/dashboard",
        actorId: ownerId,
    });

    return { success: true, usersCount: project.users.length };
};

