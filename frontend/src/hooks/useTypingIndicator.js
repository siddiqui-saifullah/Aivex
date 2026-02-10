/**
 * useTypingIndicator Hook
 * Manages typing user indicators with automatic timeout
 */

import { useState, useRef, useCallback } from 'react';

export const useTypingIndicator = (timeoutDuration = 1000) => {
    const [typingUsers, setTypingUsers] = useState({});
    const typingTimeoutRef = useRef({});

    const handleUserTyping = useCallback((userId, username, isTyping) => {
        setTypingUsers((prev) => {
            const updated = { ...prev };

            if (isTyping) {
                updated[userId] = username;

                // Clear existing timeout for this user
                if (typingTimeoutRef.current[userId]) {
                    clearTimeout(typingTimeoutRef.current[userId]);
                }

                // Set timeout to remove typing indicator
                typingTimeoutRef.current[userId] = setTimeout(() => {
                    setTypingUsers((prevUsers) => {
                        const updatedUsers = { ...prevUsers };
                        delete updatedUsers[userId];
                        return updatedUsers;
                    });
                    delete typingTimeoutRef.current[userId];
                }, timeoutDuration);
            } else {
                delete updated[userId];
                if (typingTimeoutRef.current[userId]) {
                    clearTimeout(typingTimeoutRef.current[userId]);
                    delete typingTimeoutRef.current[userId];
                }
            }

            return updated;
        });
    }, [timeoutDuration]);

    const clearAllTypingUsers = useCallback(() => {
        // Clear all timeouts
        Object.values(typingTimeoutRef.current).forEach(timeout => clearTimeout(timeout));
        typingTimeoutRef.current = {};
        setTypingUsers({});
    }, []);

    return {
        typingUsers,
        handleUserTyping,
        clearAllTypingUsers,
        typingTimeoutRef,
    };
};
