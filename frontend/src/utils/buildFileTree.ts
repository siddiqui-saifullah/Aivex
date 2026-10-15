import type { FlatFileTree } from "../types";

/**
 * Hidden file that keeps an otherwise empty folder in the saved file tree
 * (the tree is a flat path -> contents map, so folders only exist through files).
 */
export const FOLDER_PLACEHOLDER = ".gitkeep";

const isPlaceholder = (path: string) =>
    path === FOLDER_PLACEHOLDER || path.endsWith(`/${FOLDER_PLACEHOLDER}`);

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

        // Placeholders create their folder but are not shown as files
        if (isPlaceholder(path)) parts.pop();

        parts.forEach((part, index) => {
            if (!current[part]) {
                const isFile = index === parts.length - 1 && !isPlaceholder(path);
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

/**
 * Rename/move a file or folder (and everything under it).
 * Returns null if the target already exists.
 */
export const renamePath = (flatFileTree: FlatFileTree, from: string, to: string): FlatFileTree | null => {
    if (from === to) return flatFileTree;
    if (pathExists(flatFileTree, to)) return null;

    const updated: FlatFileTree = {};
    for (const [path, contents] of Object.entries(flatFileTree)) {
        if (path === from) {
            updated[to] = contents;
        } else if (path.startsWith(from + "/")) {
            updated[to + path.slice(from.length)] = contents;
        } else {
            updated[path] = contents;
        }
    }
    return updated;
};
