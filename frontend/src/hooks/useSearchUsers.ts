import { useEffect, useRef, useState } from "react";
import { isCancel } from "axios";
import { searchUser } from "../services/user.service";
import type { User } from "../types";

const DEBOUNCE_DELAY = 350;

export const useUserSearch = (query: string) => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);

        if (!query || query.trim().length < 2) {
            abortRef.current?.abort();
            setUsers([]);
            setError("");
            setLoading(false);
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
                if (!isCancel(err)) {
                    setError("Failed to search users");
                }
            } finally {
                // A newer request owns the loading flag once this one is aborted
                if (abortRef.current === controller) {
                    setLoading(false);
                }
            }
        }, DEBOUNCE_DELAY);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [query]);

    return { users, loading, error };
};
