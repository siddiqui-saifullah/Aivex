/**
 * Message Service
 * Handles message formatting and normalization
 */

import type {
    ChatMessage,
    FlatFileTree,
    SocketProjectMessage,
    Timestamp,
    User,
} from "../types";

/**
 * Format a user message for display
 */
export const formatUserMessage = (text: string, user: User | null | undefined): ChatMessage => {
    return {
        text,
        username: user?.name || user?.username || 'You',
        type: 'outgoing',
        timestamp: new Date(),
    };
};

/**
 * Create a system message (user joined, etc.)
 */
export const createSystemMessage = (text: string, timestamp?: Timestamp): ChatMessage => {
    return {
        text,
        type: 'system',
        timestamp,
    };
};

/**
 * Flatten the AI's nested fileTree into a simple { path: content } map.
 * Handles `{ file: { contents } }`, `{ contents }`, raw strings and `directory` wrappers.
 */
const flattenFileTree = (obj: Record<string, unknown>, basePath = '', out: FlatFileTree = {}): FlatFileTree => {
    Object.entries(obj).forEach(([key, value]) => {
        // Skip the "directory" wrapper key and recurse into it
        if (key === 'directory' && value && typeof value === 'object') {
            flattenFileTree(value as Record<string, unknown>, basePath, out);
            return;
        }

        const currentPath = basePath ? `${basePath}/${key}` : key;
        const node = value as { file?: { contents?: unknown }; contents?: unknown } | string | null;

        if (typeof node === 'string') {
            out[currentPath] = node;
        } else if (node && typeof node === 'object') {
            if (typeof node.file?.contents === 'string') {
                out[currentPath] = node.file.contents;
            } else if (typeof node.contents === 'string') {
                out[currentPath] = node.contents;
            } else {
                flattenFileTree(node as Record<string, unknown>, currentPath, out);
            }
        }
    });
    return out;
};

/**
 * Normalize socket message to app format
 * Flattens nested fileTree structure
 */
export const normalizeSocketMessage = (
    socketData: SocketProjectMessage,
    currentUserId: string | undefined,
    projectUsers: User[] = [],
): ChatMessage => {
    const isFromCurrentUser = String(socketData.sender?.id) === String(currentUserId);
    const isAI = Boolean(socketData.isAI || socketData.role === 'ai');

    // Determine username: AI messages show "Aivex", others lookup from members
    let username = 'Unknown';
    if (isAI) {
        username = 'Aivex';
    } else if (socketData.sender?.username) {
        username = socketData.sender.username;
    } else if (socketData.sender?.id) {
        // Lookup member by ID
        const member = projectUsers.find(m => String(m._id) === String(socketData.sender?.id));
        username = member?.name || member?.username || 'Unknown';
    }

    // Handle both string messages and object messages with fileTree
    const messageObj = typeof socketData.message === 'string'
        ? { text: socketData.message }
        : socketData.message || {};

    const fileTree = messageObj.fileTree ? flattenFileTree(messageObj.fileTree) : {};

    return {
        text: messageObj.text ?? '',
        fileTree: Object.keys(fileTree).length > 0 ? fileTree : null,
        username,
        role: socketData.role,
        senderId: socketData.sender?.id,
        type: isFromCurrentUser ? 'outgoing' : 'incoming',
        timestamp: socketData.timestamp,
        isAI,
    };
};
