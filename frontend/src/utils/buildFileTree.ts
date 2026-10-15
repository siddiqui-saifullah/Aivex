import type { FlatFileTree } from "../types";

export interface TreeNodeData {
    __isFile: boolean;
    __children: Record<string, TreeNodeData>;
    __content?: string;
}

export type TreeNodeMap = Record<string, TreeNodeData>;

export function buildFileTree(fileTree: FlatFileTree, emptyFolders: string[] = []): TreeNodeMap {
    const root: TreeNodeMap = {};

    // First, add all files from flatFileTree
    Object.keys(fileTree).forEach((path) => {
        const parts = path.split("/");
        let current = root;

        parts.forEach((part, index) => {
            if (!current[part]) {
                const isFile = index === parts.length - 1;
                const fileContent = fileTree[path];

                current[part] = {
                    __isFile: isFile,
                    __children: {},
                    // Store file content if it's a file
                    ...(isFile && fileContent ? { __content: fileContent } : {}),
                };
            }
            current = current[part].__children;
        });
    });

    // Add empty folders
    emptyFolders.forEach((folderPath) => {
        const parts = folderPath.split("/").filter(Boolean);
        let current = root;

        parts.forEach((part) => {
            if (!current[part]) {
                current[part] = {
                    __isFile: false,
                    __children: {},
                };
            }
            current = current[part].__children;
        });
    });

    return root;
}

/**
 * Add a file to the flatFileTree
 * @param {Object} flatFileTree - Current flat file tree
 * @param {string} path - Full path including filename (e.g., "src/utils/helper.js")
 * @param {string} content - Content for files (default: empty string)
 * @returns {Object} Updated flatFileTree
 */
export const addFileToTree = (flatFileTree: FlatFileTree, path: string, content = ""): FlatFileTree => {
    const updated = { ...flatFileTree };
    updated[path] = content;
    return updated;
};

/**
 * Add an empty folder to tracking
 * @param emptyFolders - Set of empty folder paths
 * @param {string} path - Folder path
 * @returns {Set} Updated emptyFolders set
 */
export const addEmptyFolder = (emptyFolders: Set<string>, path: string): Set<string> => {
    const updated = new Set(emptyFolders);
    updated.add(path);
    return updated;
};

/**
 * Delete a file or folder from flatFileTree
 * @param {Object} flatFileTree - Current flat file tree
 * @param {string} path - Full path to delete
 * @returns {Object} Updated flatFileTree with deleted entry
 */
export const deleteFileFromTree = (flatFileTree: FlatFileTree, path: string): FlatFileTree => {
    const updated = { ...flatFileTree };
    const normalizedPath = path.endsWith("/") ? path.slice(0, -1) : path;

    // Delete the file if it exists (even when its content is empty)
    delete updated[normalizedPath];

    // Delete all files within this folder path
    Object.keys(updated).forEach((filePath) => {
        if (filePath.startsWith(normalizedPath + "/")) {
            delete updated[filePath];
        }
    });

    return updated;
};

/**
 * Remove folder from empty folders tracking when deleted
 * @param emptyFolders - Set of empty folder paths
 * @param {string} path - Folder path to delete
 * @returns {Set} Updated emptyFolders set
 */
export const deleteEmptyFolder = (emptyFolders: Set<string>, path: string): Set<string> => {
    const updated = new Set(emptyFolders);
    const normalizedPath = path.endsWith("/") ? path.slice(0, -1) : path;

    updated.delete(normalizedPath);

    // Also delete subfolders
    emptyFolders.forEach((folderPath) => {
        if (folderPath.startsWith(normalizedPath + "/")) {
            updated.delete(folderPath);
        }
    });

    return updated;
};

/**
 * Check if a file/folder already exists in the tree
 * @param {Object} flatFileTree - Current flat file tree
 * @param {string} path - Full path to check
 * @param emptyFolders - Set of empty folder paths
 * @returns {boolean} True if path exists
 */
export const pathExists = (flatFileTree: FlatFileTree, path: string, emptyFolders: Set<string> = new Set()): boolean => {
    const normalizedPath = path.endsWith("/") ? path.slice(0, -1) : path;

    // Check if it's an actual file (empty files have "" as content)
    if (normalizedPath in flatFileTree) {
        return true;
    }

    // Check if it's an empty folder
    if (emptyFolders.has(normalizedPath)) {
        return true;
    }

    // Check if folder exists implicitly (files inside it)
    return Object.keys(flatFileTree).some(
        (filePath) => filePath.startsWith(normalizedPath + "/"),
    );
};

/**
 * Get all files in a specific directory
 * @param {Object} flatFileTree - Current flat file tree
 * @param {string} dirPath - Directory path
 * @returns {Array} Array of file paths in this directory
 */
export const getFilesInDirectory = (flatFileTree: FlatFileTree, dirPath: string): string[] => {
    const normalizedPath = dirPath.endsWith("/") ? dirPath.slice(0, -1) : dirPath;
    const prefix = normalizedPath ? normalizedPath + "/" : "";

    return Object.keys(flatFileTree).filter(
        (filePath) =>
            filePath.startsWith(prefix) &&
            filePath !== normalizedPath &&
            !filePath.slice(prefix.length).includes("/"),
    );
};

/**
 * Get immediate children (files and folders) in a directory
 * @param {Object} flatFileTree - Current flat file tree
 * @param {string} dirPath - Directory path (empty string for root)
 * @returns {Object} { folders: [], files: [] }
 */
export const getDirectoryContents = (flatFileTree: FlatFileTree, dirPath: string) => {
    const normalizedPath = dirPath ? dirPath : "";
    const prefix = normalizedPath ? normalizedPath + "/" : "";
    const children = new Set<string>();

    Object.keys(flatFileTree).forEach((filePath) => {
        if (filePath.startsWith(prefix) && filePath !== normalizedPath) {
            const relativePath = filePath.slice(prefix.length);
            const parts = relativePath.split("/");

            if (parts.length > 0) {
                children.add(parts[0]);
            }
        }
    });

    const folders: string[] = [];
    const files: string[] = [];

    children.forEach((name) => {
        const fullPath = prefix + name;
        if (fullPath in flatFileTree) {
            files.push(name);
        } else {
            // It's a folder if files exist under it but not the exact path
            const hasChildren = Object.keys(flatFileTree).some((p) =>
                p.startsWith(fullPath + "/"),
            );
            if (hasChildren) {
                folders.push(name);
            }
        }
    });

    return { folders, files };
};
