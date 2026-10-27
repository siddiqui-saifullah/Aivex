import axios from "../config/axios";
import type { User } from "../types";

export interface AuthResponse {
    token: string;
    user: Pick<User, "_id" | "name" | "username">;
}

/** Sign-up step 1: the server emails a code (or signs in right away if email isn't set up). */
export const registerUser = async (payload: {
    name: string;
    username: string;
    email: string;
    password: string;
    /** Honeypot: hidden from people, so only bots fill it in. */
    website?: string;
}): Promise<AuthResponse | { verificationRequired: true; email: string }> => {
    const response = await axios.post<AuthResponse | { verificationRequired: true; email: string }>("/users/register", payload);
    return response.data;
};

/** Sign-up step 2: the emailed code creates the account. */
export const verifySignup = async (email: string, code: string): Promise<AuthResponse> => {
    const response = await axios.post<AuthResponse>("/users/register/verify", { email, code });
    return response.data;
};

export const resendSignupCode = async (email: string) => {
    await axios.post("/users/register/resend", { email });
};

export type OAuthProvider = "google" | "github";

/** Which "Continue with ..." buttons the server supports. */
export const getAuthProviders = async (): Promise<Record<OAuthProvider, boolean>> => {
    const response = await axios.get<Record<OAuthProvider, boolean>>("/auth/providers");
    return response.data;
};

/** Full-page redirect to the provider; it comes back to /auth/callback. */
export const oauthStartUrl = (provider: OAuthProvider, next: string) =>
    `${import.meta.env.VITE_API_URL}/auth/${provider}?next=${encodeURIComponent(next)}`;

/** Trade the one-time code from /auth/callback for a session. */
export const exchangeOAuthCode = async (code: string): Promise<AuthResponse> => {
    const response = await axios.post<AuthResponse>("/auth/exchange", { code });
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


export interface ProfileStats {
    projectsOwned: number;
    projectsJoined: number;
    collaborators: number;
    messagesSent: number;
}

export interface RecentProject {
    _id: string;
    name: string;
    stack?: string;
    updatedAt: string;
    usersCount: number;
    isOwner: boolean;
}

export const userProfile = async () => {
    const response = await axios.get<{
        user: User;
        stats?: ProfileStats;
        recentProjects?: RecentProject[];
    }>("/users/profile");
    return response.data;
};

export const updateProfile = async (updates: { name?: string; username?: string; bio?: string }) => {
    const response = await axios.patch<{ user: User }>("/users/profile", updates);
    return response.data;
};

/** `currentPassword` is left out when a Google/GitHub account sets its first password. */
export const changePassword = async (currentPassword: string | undefined, newPassword: string) => {
    const response = await axios.patch<{ message: string }>("/users/password", {
        currentPassword,
        newPassword,
    });
    return response.data;
};

/** Permanently delete the account; the server also revokes the token. */
/** `password` is left out for Google/GitHub accounts without one. */
export const deleteAccount = async (password: string | undefined): Promise<void> => {
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
