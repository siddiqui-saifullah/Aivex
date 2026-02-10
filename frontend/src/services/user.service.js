import axios from "../config/axios";

export const registerUser = async (email, password) => {
    const response = await axios.post("/users/register", { email, password });
    return response.data;
};

export const loginUser = async (email, password) => {
    const response = await axios.post("/users/login", { email, password });
    return response.data;
};

export const logOut = async () => {
    await axios.post("/users/logout");
    localStorage.removeItem("token");
};


export const userProfile = async () => {
    const response = await axios.get("/users/profile");
    return response.data;
};

export const updateUser = async (userData) => {
    const response = await axios.patch("/users/profile", userData);
    return response.data;
};

export const deleteUser = async () => {
    const response = await axios.delete("/users/profile");
    return response.data;
};

export const searchUser = async (q, signal) => {
    if (!q || q.trim().length < 2) {
        return { users: [] };
    }

    const response = await axios.get("/users/search", {
        params: { q: q.trim() },
        signal,
    });

    return response.data;
};
