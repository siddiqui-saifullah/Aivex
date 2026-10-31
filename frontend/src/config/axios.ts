import axios from 'axios';


const axiosInstance = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    withCredentials: true,
});

// we always use the latest token from localStorage for each request
axiosInstance.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    } else {
        delete config.headers.Authorization;
    }
    return config;
});

// The session ended (expired or revoked token): sign in again and come back
// to this page. Only for requests that were sent with a token, so a wrong
// password on the login form is still shown as an error.
axiosInstance.interceptors.response.use(undefined, (error) => {
    const hadToken = Boolean(error.config?.headers?.Authorization);
    // An admin suspended this account: sign out and say why
    if (error.response?.status === 403 && error.response?.data?.code === 'ACCOUNT_SUSPENDED') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.assign('/login?suspended=1');
        return Promise.reject(error);
    }
    const isLogout = String(error.config?.url ?? '').includes('/users/logout');
    if (error.response?.status === 401 && hadToken && !isLogout && localStorage.getItem('token')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        const here = `${window.location.pathname}${window.location.search}`;
        window.location.assign(`/login?next=${encodeURIComponent(here)}`);
    }
    return Promise.reject(error);
});

export default axiosInstance;
