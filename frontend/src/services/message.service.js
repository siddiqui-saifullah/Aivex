/**
 * Message Service
 * Handles message formatting and normalization
 */

/**
 * Format a user message for display
 * @param {string} text - Message text
 * @param {object} user - User object {_id, name, username}
 * @returns {object} Formatted message
 */
export const formatUserMessage = (text, user) => {
    return {
        text,
        username: user?.name || user?.username || 'You',
        type: 'outgoing',
        timestamp: new Date(),
    };
};

/**
 * Create a system message (user joined, etc.)
 * @param {string} text - Message text
 * @param {number} timestamp - Message timestamp
 * @returns {object} System message
 */
export const createSystemMessage = (text, timestamp) => {
    return {
        text,
        type: 'system',
        timestamp,
    };
};

/**
 * Normalize socket message to app format
 * Flattens nested fileTree structure
 * @param {object} socketData - Raw data from socket
 * @param {string} currentUserId - Current user ID
 * @param {array} projectUsers - List of project members {_id, name, username}
 * @returns {object} Normalized message
 */
export const normalizeSocketMessage = (socketData, currentUserId, projectUsers = []) => {
    const isFromCurrentUser = String(socketData.sender?.id) === String(currentUserId);
    const isAI = socketData.isAI || socketData.role === 'ai';

    // Determine username: AI messages show "Aivex", others lookup from members
    let username = 'Unknown';
    if (isAI) {
        username = 'Aivex';
    } else if (socketData.sender?.username) {
        username = socketData.sender.username;
    } else if (socketData.sender?.id) {
        // Lookup member by ID
        const member = projectUsers.find(m => String(m._id) === String(socketData.sender.id));
        username = member?.name || member?.username || 'Unknown';
    }

    // Handle both string messages and object messages with fileTree
    const messageObj = typeof socketData.message === 'string'
        ? { text: socketData.message }
        : socketData.message || {};
    console.log(messageObj)
    // Flatten fileTree structure into simple { path: content } format
    let fileTree = {};

    if (messageObj.fileTree) {
        const flattenFileTree = (obj, basePath = '') => {
            Object.entries(obj).forEach(([key, value]) => {
                // Skip the "directory" wrapper key and recurse into it
                if (key === 'directory' && typeof value === 'object') {
                    flattenFileTree(value, basePath);
                    return;
                }

                const currentPath = basePath ? `${basePath}/${key}` : key;

                // Handle nested file structure: { file: { contents: "..." } }
                if (value?.file?.contents) {
                    fileTree[currentPath] = value.file.contents;
                    console.log(`[FileTree] Added: ${currentPath} (from file.contents)`);
                }
                // Handle previous format: { contents: "..." }
                else if (value?.contents) {
                    fileTree[currentPath] = value.contents;
                    console.log(`[FileTree] Added: ${currentPath} (from contents)`);
                }
                // Handle root-level string content
                else if (typeof value === 'string') {
                    fileTree[currentPath] = value;
                    console.log(`[FileTree] Added: ${currentPath} (from string)`);
                }
                // Handle nested directories/objects
                else if (value && typeof value === 'object') {
                    console.log(`[FileTree] Recursing into: ${currentPath}`);
                    flattenFileTree(value, currentPath);
                }
            });
        };

        console.log('[FileTree] Starting flattening:', messageObj.fileTree);
        flattenFileTree(messageObj.fileTree);
        console.log('[FileTree] Final result:', fileTree);
    }

    return {
        text: messageObj.text || socketData.message,
        fileTree: Object.keys(fileTree).length > 0 ? fileTree : null,
        username,
        type: isFromCurrentUser ? 'outgoing' : 'incoming',
        createdAt: socketData.timestamp,
        isAI,
    };
};
