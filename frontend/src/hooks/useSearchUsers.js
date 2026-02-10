import { useEffect, useRef, useState } from "react";
import { searchUser } from "../services/user.service";

const DEBOUNCE_DELAY = 350;

export const useUserSearch = (query) => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const debounceRef = useRef(null);
    const abortRef = useRef(null);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);

        if (!query || query.trim().length < 2) {
            setUsers([]);
            setError("");
            return;
        }

        debounceRef.current = setTimeout(async () => {
            if (abortRef.current) abortRef.current.abort();

            const controller = new AbortController();
            abortRef.current = controller;

            try {
                setLoading(true);
                setError("");

                const res = await searchUser(query, controller.signal);
                setUsers(res.users || []);

            } catch (err) {
                if (err.name !== "CanceledError") {
                    setError("Failed to search users");
                }
            } finally {
                setLoading(false);
            }
        }, DEBOUNCE_DELAY);

        return () => clearTimeout(debounceRef.current);
    }, [query]);

    return { users, loading, error };
};
