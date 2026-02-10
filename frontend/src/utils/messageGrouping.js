/**
 * Message Grouping Utilities
 * Groups consecutive messages from the same sender
 * 
 * Features:
 * - Combines consecutive messages from same user
 * - Maintains timestamp info
 * - Preserves message types and metadata
 */

/**
 * Check if two consecutive messages should be grouped
 * Messages are grouped if:
 * - From the same sender
 * - Within 5 minutes of each other
 * - Both not streaming/error messages
 * 
 * @param {object} current - Current message
 * @param {object} next - Next message
 * @returns {boolean} True if messages should be grouped
 */
const shouldGroupMessages = (current, next) => {
    if (!current || !next) return false;

    // Don't group if different senders
    if (current.username !== next.username) return false;

    // Don't group if either is streaming or error
    if (current.isStreaming || next.isStreaming) return false;
    if (current.isError || next.isError) return false;

    // Group if within 5 minutes
    const timeDiff = Math.abs(next.timestamp - current.timestamp);
    const fiveMinutes = 5 * 60 * 1000;

    return timeDiff < fiveMinutes;
};

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
 *   {
 *     groupId: 'group-0',
 *     username: 'john',
 *     messages: [
 *       { text: 'Hi', timestamp: 100 },
 *       { text: 'How are you?', timestamp: 150 },
 *     ],
 *     firstTimestamp: 100,
 *     lastTimestamp: 150,
 *   },
 *   {
 *     groupId: 'group-1',
 *     username: 'jane',
 *     messages: [
 *       { text: 'Hi john', timestamp: 200 },
 *     ],
 *     firstTimestamp: 200,
 *     lastTimestamp: 200,
 *   }
 * ]
 * 
 * @param {array} messages - Array of message objects
 * @returns {array} Array of message groups
 */
export const groupMessages = (messages) => {
    if (!Array.isArray(messages) || messages.length === 0) {
        return [];
    }

    const groups = [];
    let currentGroup = null;

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
                messages: [
                    {
                        text: message.text,
                        timestamp: message.timestamp,
                        isStreaming: message.isStreaming,
                        isError: message.isError,
                    },
                ],
                firstTimestamp: message.timestamp,
                lastTimestamp: message.timestamp,
            };
            groups.push(currentGroup);
        } else {
            // Add to current group
            currentGroup.messages.push({
                text: message.text,
                timestamp: message.timestamp,
                isStreaming: message.isStreaming,
                isError: message.isError,
            });
            currentGroup.lastTimestamp = message.timestamp;
        }

        // Close group if next message is from different sender or too far apart
        if (!shouldGroup && currentGroup) {
            currentGroup = null;
        }
    });

    return groups;
};

/**
 * Flatten grouped messages back to original format
 * Useful for sending to API or logging
 * 
 * @param {array} groups - Array of message groups
 * @returns {array} Array of individual messages
 */
export const flattenMessageGroups = (groups) => {
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
