/**
 * Message Grouping Utilities
 * Groups consecutive messages from the same sender
 *
 * Features:
 * - Combines consecutive messages from same user
 * - Maintains timestamp info
 * - Preserves message types and metadata
 */

import type { ChatMessage, FlatFileTree, MessageType, Timestamp } from "../types";

export interface GroupedMessageItem {
    id?: string;
    text: string;
    timestamp?: Timestamp;
    isStreaming?: boolean;
    isError?: boolean;
    /** Files generated with an AI message (live `fileTree` or saved `filePatch`). */
    files?: FlatFileTree | null;
}

export interface MessageGroupData {
    groupId: string;
    username?: string;
    type: MessageType;
    isAI?: boolean;
    messages: GroupedMessageItem[];
    firstTimestamp?: Timestamp;
    lastTimestamp?: Timestamp;
}

/** Timestamps arrive as Date objects, epoch numbers or ISO strings. */
const toMillis = (timestamp?: Timestamp): number => {
    if (timestamp === undefined || timestamp === null) return NaN;
    return new Date(timestamp).getTime();
};

/**
 * Check if two consecutive messages should be grouped
 * Messages are grouped if:
 * - From the same sender
 * - Within 5 minutes of each other
 * - Both not streaming/error messages
 */
const shouldGroupMessages = (current?: ChatMessage, next?: ChatMessage): boolean => {
    if (!current || !next) return false;

    // Don't group if different senders or different kinds (e.g. system vs user)
    if (current.username !== next.username) return false;
    if (current.type !== next.type) return false;

    // Don't group if either is streaming or error
    if (current.isStreaming || next.isStreaming) return false;
    if (current.isError || next.isError) return false;

    // Group if within 5 minutes
    const timeDiff = Math.abs(toMillis(next.timestamp) - toMillis(current.timestamp));
    const fiveMinutes = 5 * 60 * 1000;

    return timeDiff < fiveMinutes;
};

const toGroupItem = (message: ChatMessage): GroupedMessageItem => ({
    id: message.id,
    text: message.text,
    timestamp: message.timestamp,
    isStreaming: message.isStreaming,
    isError: message.isError,
    files: message.fileTree ?? message.filePatch ?? null,
});

/**
 * Group consecutive messages from same sender
 *
 * Example:
 * Input:
 * [
 *   { username: 'john', text: 'Hi', timestamp: 100 },
 *   { username: 'john', text: 'How are you?', timestamp: 150 },
 *   { username: 'jane', text: 'Hi john', timestamp: 200 },
 * ]
 *
 * Output:
 * [
 *   { groupId: 'group-0', username: 'john', messages: [Hi, How are you?], ... },
 *   { groupId: 'group-1', username: 'jane', messages: [Hi john], ... },
 * ]
 */
export const groupMessages = (messages: ChatMessage[]): MessageGroupData[] => {
    if (!Array.isArray(messages) || messages.length === 0) {
        return [];
    }

    const groups: MessageGroupData[] = [];
    let currentGroup: MessageGroupData | null = null;

    messages.forEach((message, index) => {
        const nextMessage = messages[index + 1];
        const shouldGroup = shouldGroupMessages(message, nextMessage);

        // Start new group if first message or different sender
        if (!currentGroup || currentGroup.username !== message.username) {
            currentGroup = {
                groupId: `group-${groups.length}`,
                username: message.username,
                type: message.type,
                isAI: message.isAI,
                messages: [toGroupItem(message)],
                firstTimestamp: message.timestamp,
                lastTimestamp: message.timestamp,
            };
            groups.push(currentGroup);
        } else {
            // Add to current group
            currentGroup.messages.push(toGroupItem(message));
            currentGroup.lastTimestamp = message.timestamp;
        }

        // Close group if next message is from different sender or too far apart
        if (!shouldGroup) {
            currentGroup = null;
        }
    });

    return groups;
};

/**
 * Flatten grouped messages back to original format
 * Useful for sending to API or logging
 */
export const flattenMessageGroups = (groups: MessageGroupData[]): ChatMessage[] => {
    return groups.flatMap((group) =>
        group.messages.map((msg) => ({
            text: msg.text,
            username: group.username,
            type: group.type,
            timestamp: msg.timestamp,
            isAI: group.isAI,
            isStreaming: msg.isStreaming,
            isError: msg.isError,
        }))
    );
};
