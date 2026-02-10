/**
 * Detect if there are changes between two file trees
 * Compares keys and content of files
 */
export const hasFileTreeChanges = (dbFileTree, currentFileTree) => {
    if (!dbFileTree || !currentFileTree) {
        return true;
    }

    const dbKeys = Object.keys(dbFileTree).sort();
    const currentKeys = Object.keys(currentFileTree).sort();

    // Check if keys are different
    if (dbKeys.length !== currentKeys.length) {
        return true;
    }

    // Check if any key is different
    if (!dbKeys.every((key, index) => key === currentKeys[index])) {
        return true;
    }

    // Check if content of any file changed
    for (const key of dbKeys) {
        if (dbFileTree[key] !== currentFileTree[key]) {
            return true;
        }
    }

    return false;
};

/**
 * Get a summary of what changed
 */
export const getFileTreeChangeSummary = (dbFileTree, currentFileTree) => {
    const added = [];
    const modified = [];
    const deleted = [];

    const dbKeys = new Set(Object.keys(dbFileTree || {}));
    const currentKeys = new Set(Object.keys(currentFileTree || {}));

    // Find added files
    currentKeys.forEach((key) => {
        if (!dbKeys.has(key)) {
            added.push(key);
        }
    });

    // Find deleted files
    dbKeys.forEach((key) => {
        if (!currentKeys.has(key)) {
            deleted.push(key);
        }
    });

    // Find modified files
    dbKeys.forEach((key) => {
        if (currentKeys.has(key) && dbFileTree[key] !== currentFileTree[key]) {
            modified.push(key);
        }
    });

    return { added, modified, deleted };
};
