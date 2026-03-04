import axios from 'axios';
import {
    clearAuthSession,
    getAccessToken,
    getLegacyRefreshToken,
    isDemoSession,
} from '../utils/authStorage';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const api = axios.create({
    baseURL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 15000,
    withCredentials: true,
});

api.interceptors.request.use((config) => {
    const token = getAccessToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach((prom) => {
        if (error) prom.reject(error);
        else prom.resolve(token);
    });
    failedQueue = [];
};

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config || {};
        const isAuthRoute =
            typeof originalRequest.url === 'string' &&
            originalRequest.url.includes('/auth/refresh');

        if (error.response?.status === 401 && !originalRequest._retry && !isAuthRoute) {
            if (isDemoSession()) {
                return Promise.reject(error);
            }

            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                })
                    .then((token) => {
                        originalRequest.headers = originalRequest.headers || {};
                        originalRequest.headers.Authorization = `Bearer ${token}`;
                        return api(originalRequest);
                    })
                    .catch((err) => Promise.reject(err));
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                const legacyRefreshToken = getLegacyRefreshToken();
                const refreshPayload = legacyRefreshToken ? { refreshToken: legacyRefreshToken } : {};

                const { data } = await axios.post(
                    `${baseURL}/auth/refresh`,
                    refreshPayload,
                    { withCredentials: true }
                );

                const newAccessToken = data.data.accessToken;
                sessionStorage.setItem('accessToken', newAccessToken);

                api.defaults.headers.Authorization = `Bearer ${newAccessToken}`;
                originalRequest.headers = originalRequest.headers || {};
                originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

                processQueue(null, newAccessToken);
                return api(originalRequest);
            } catch (refreshError) {
                processQueue(refreshError, null);
                clearAuthSession();
                window.location.href = '/login';
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    }
);

export default api;
