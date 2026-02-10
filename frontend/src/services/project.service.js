import axios from "../config/axios";

/**
 * Normalize backend project object
 * Keeps frontend consistent even if backend changes
 */
const normalizeProject = (p) => {
    if (!p) return null;

    return {
        ...p,
        id: p._id, // frontend-friendly id
        owner: p.owner, // Preserve owner information
        ownerId: p.ownerId || p.owner?._id, // Support both formats
        // Map files from API response to flatFileTree for frontend
        flatFileTree: p.files || {},
    };
};

/**
 * Get all projects (dashboard)
 */
export const getProjects = async () => {
    const { data } = await axios.get("/projects");

    if (Array.isArray(data)) {
        return data.map(normalizeProject);
    }

    return [];
};

/**
 * Get single project by ID (project page)
 */
export const getProjectById = async (projectId) => {
    if (!projectId) {
        throw new Error("Project ID is required");
    }

    const { data } = await axios.get(`/projects/${projectId}`);
    return normalizeProject(data);
};

/**
 * Create new project
 */
export const createProject = async (payload) => {
    const { data } = await axios.post("/projects", payload);
    return normalizeProject(data);
};

/**
 * Delete project
 */
export const deleteProject = async (id) => {
    if (!id) {
        throw new Error("Project ID is required");
    }

    await axios.delete(`/projects/${id}`);
};

/**
 * Update project
 */
export const updateProject = async (id, updates) => {
    if (!id) {
        throw new Error("Project ID is required");
    }

    const { data } = await axios.patch(`/projects/${id}`, updates);
    return normalizeProject(data);
};

export const addUserToProject = async (projectId, users) => {
    if (!projectId) {
        throw new Error("Project ID is required");
    }

    if (!Array.isArray(users) || users.length === 0) {
        throw new Error("Users array is required");
    }

    const { data } = await axios.patch(
        `/projects/${projectId}/invite`,
        { users }
    );

    return data;
};


export const getProjectChats = async (projectId) => {
    if (!projectId) {
        throw new Error("Project ID is required");
    }
    const { data } = await axios.get(`/projects/${projectId}/chats`);
    return data;
}


export const updateProjectFiles = async (projectId, flatFileTree) => {
    if (!projectId) {
        throw new Error("Project ID is required");
    }
    const { data } = await axios.patch(`/projects/${projectId}`, { fileTree: { ...flatFileTree } });
    return data;
}

export const leaveProject = async (projectId) => {
    if (!projectId) {
        throw new Error("Project ID is required");
    }
    const { data } = await axios.patch(`/projects/${projectId}/leave`);
    return data;
}


export const updateProjectName = async (projectId, newName) => {
    if (!projectId) throw new Error("Project Id is required");
    if (!newName) throw new Error("New Name cannot be empty");

    const { data } = await axios.patch(`/projects/${projectId}/name`, { newName });
    return data;
};


export const reportIssue = async (projectId, report) => {
    if (!report) throw new Error("Report cannot be empty");

    // If projectId exists, report to project-specific endpoint
    // Otherwise, report to general platform/feedback endpoint
    const endpoint = `projects/${projectId}/issues`;

    const { data } = await axios.post(endpoint, report);
    return data;
}