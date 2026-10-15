import axios from "../config/axios";
import type { User } from "../types";

export interface AuthResponse {
    token: string;
    user: Pick<User, "_id" | "name" | "username">;
}

export const registerUser = async (payload: {
    name: string;
    username: string;
    email: string;
    password: string;
}): Promise<AuthResponse> => {
    const response = await axios.post<AuthResponse>("/users/register", payload);
    return response.data;
};

export const loginUser = async (email: string, password: string): Promise<AuthResponse> => {
    const response = await axios.post<AuthResponse>("/users/login", { email, password });
    return response.data;
};

/**
 * Revoke the token on the server, then clear local auth state.
 * The request must be sent before the token is removed, otherwise the
 * server never receives (and blacklists) it.
 */
export const logOut = async (): Promise<void> => {
    try {
        await axios.post("/users/logout");
    } catch (err) {
        console.error("Logout request failed:", err);
    } finally {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
    }
};


export const userProfile = async () => {
    const response = await axios.get<{ user: User }>("/users/profile");
    return response.data;
};

export const updateProfile = async (updates: { name?: string; username?: string }) => {
    const response = await axios.patch<{ user: User }>("/users/profile", updates);
    return response.data;
};

export const changePassword = async (currentPassword: string, newPassword: string) => {
    const response = await axios.patch<{ message: string }>("/users/password", {
        currentPassword,
        newPassword,
    });
    return response.data;
};

/** Permanently delete the account; the server also revokes the token. */
export const deleteAccount = async (password: string): Promise<void> => {
    await axios.delete("/users/profile", { data: { password } });
    localStorage.removeItem("token");
    localStorage.removeItem("user");
};

export const searchUser = async (q: string, signal?: AbortSignal): Promise<{ users: User[] }> => {
    if (!q || q.trim().length < 2) {
        return { users: [] };
    }

    const response = await axios.get<{ users: User[] }>("/users/search", {
        params: { q: q.trim() },
        signal,
    });

    return response.data;
};
