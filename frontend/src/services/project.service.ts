import axios from "../config/axios";
import type { FlatFileTree, Project, ProjectDetails } from "../types";

type RawProject = Omit<Project, "id" | "flatFileTree"> & Partial<Pick<Project, "id" | "flatFileTree">>;

/**
 * Normalize backend project object
 * Keeps frontend consistent even if backend changes
 */
const normalizeProject = <T extends RawProject>(p: T): T & Pick<Project, "id" | "flatFileTree"> => {
    return {
        ...p,
        id: p._id, // frontend-friendly id
        owner: p.owner, // Preserve owner information
        ownerId: p.ownerId || (typeof p.owner === "string" ? p.owner : p.owner?._id), // Support both formats
        // Map files from API response to flatFileTree for frontend
        flatFileTree: p.files || {},
    };
};

/**
 * Get all projects (dashboard)
 */
export const getProjects = async (): Promise<Project[]> => {
    const { data } = await axios.get<RawProject[]>("/projects");

    if (Array.isArray(data)) {
        return data.map(normalizeProject);
    }

    return [];
};

/**
 * Get single project by ID (project page)
 */
export const getProjectById = async (projectId: string): Promise<ProjectDetails> => {
    if (!projectId) {
        throw new Error("Project ID is required");
    }

    const { data } = await axios.get<{ success: boolean; project: RawProject & { users: ProjectDetails["users"] } }>(
        `/projects/${projectId}`,
    );
    return normalizeProject(data.project);
};

/**
 * Create new project
 */
export const createProject = async (payload: { name: string; stack?: string }): Promise<Project> => {
    const { data } = await axios.post<RawProject>("/projects", payload);
    return normalizeProject(data);
};

/**
 * Delete project
 */
export const deleteProject = async (id: string): Promise<void> => {
    if (!id) {
        throw new Error("Project ID is required");
    }

    await axios.delete(`/projects/${id}`);
};

export const addUserToProject = async (projectId: string, users: string[]) => {
    if (!projectId) {
        throw new Error("Project ID is required");
    }

    if (!Array.isArray(users) || users.length === 0) {
        throw new Error("Users array is required");
    }

    const { data } = await axios.patch<{ message: string; addedCount: number; usersCount: number }>(
        `/projects/${projectId}/invite`,
        { users }
    );

    return data;
};


export interface ProjectChat {
    id: string;
    text: string;
    role: "user" | "ai" | "system";
    sender: string | null;
    filePatch: Record<string, string> | null;
    createdAt: string;
    isAI?: boolean;
}

export const getProjectChats = async (projectId: string) => {
    if (!projectId) {
        throw new Error("Project ID is required");
    }
    const { data } = await axios.get<{ projectChats: ProjectChat[] }>(`/projects/${projectId}/chats`);
    return data;
}


export const updateProjectFiles = async (projectId: string, flatFileTree: FlatFileTree) => {
    if (!projectId) {
        throw new Error("Project ID is required");
    }
    const { data } = await axios.patch(`/projects/${projectId}`, { fileTree: { ...flatFileTree } });
    return data;
}

export const leaveProject = async (projectId: string) => {
    if (!projectId) {
        throw new Error("Project ID is required");
    }
    const { data } = await axios.patch<{ success: boolean }>(`/projects/${projectId}/leave`);
    return data;
}


export const updateProjectName = async (projectId: string, newName: string) => {
    if (!projectId) throw new Error("Project Id is required");
    if (!newName) throw new Error("New Name cannot be empty");

    const { data } = await axios.patch(`/projects/${projectId}/name`, { newName });
    return data;
};


export interface IssueReportPayload {
    type: "bug" | "feature" | "feedback";
    title: string;
    description: string;
    severity: "low" | "medium" | "high" | "critical";
    context?: Record<string, unknown>;
}

export const updateAiMemory = async (projectId: string, memory: string) => {
    const { data } = await axios.put<{ aiMemory: string }>(`/projects/${projectId}/memory`, { memory });
    return data;
};

export const transferOwnership = async (projectId: string, newOwnerId: string) => {
    if (!projectId) throw new Error("Project ID is required");
    const { data } = await axios.patch<{ success: boolean; owner: string }>(
        `/projects/${projectId}/owner`,
        { newOwnerId },
    );
    return data;
};

export const removeMember = async (projectId: string, memberId: string) => {
    if (!projectId) throw new Error("Project ID is required");
    const { data } = await axios.delete<{ success: boolean; usersCount: number }>(
        `/projects/${projectId}/members/${memberId}`,
    );
    return data;
};

export const reportIssue = async (projectId: string | undefined, report: IssueReportPayload) => {
    if (!report) throw new Error("Report cannot be empty");

    // The backend route is project-scoped; issues raised outside a project
    // (e.g. from the dashboard) are filed under a "general" placeholder.
    const endpoint = `/projects/${projectId || "general"}/issues`;

    const { data } = await axios.post<{ message: string; issueId: string }>(endpoint, report);
    return data;
}
