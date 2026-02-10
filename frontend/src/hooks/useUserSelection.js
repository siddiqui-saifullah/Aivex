import { useState } from "react";

export const useUserSelection = (max = 10) => {
    const [selectedUserIds, setSelectedUserIds] = useState([]);
    const [error, setError] = useState("");

    const toggleUser = (userId) => {
        setSelectedUserIds((prev) => {
            if (prev.includes(userId)) {
                setError("");
                return prev.filter((id) => id !== userId);
            }

            if (prev.length >= max) {
                setError(`You can select up to ${max} users`);
                return prev;
            }

            setError("");
            return [...prev, userId];
        });
    };

    const clearSelection = () => {
        setSelectedUserIds([]);
        setError("");
    };

    return {
        selectedUserIds,
        toggleUser,
        clearSelection,
        error,
    };
};
