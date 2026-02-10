/**
 * API configuration constants
 */

export const API_ENDPOINTS = {
    PROJECTS: '/projects',
    PROJECT_BY_ID: (id) => `/projects/${id}`,
};

export const API_MESSAGES = {
    DELETE_FAILED: "Failed to delete project",
    RENAME_FAILED: "Failed to rename project",
    CREATE_FAILED: "Failed to create project",
    FETCH_FAILED: "Unable to load projects",
    CONFIRM_DELETE: "Are you sure you want to delete this project?",

    PROJECT_NAME_EXISTS: "Project with this name already exists",
};
