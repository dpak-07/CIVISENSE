import axios from 'axios';
import api from './axios';
import { API_BASE_URL, API_REQUEST_TIMEOUT_MS } from './axios';

const APK_UPLOAD_TIMEOUT_MS = 900000;
const uploadApi = axios.create({ baseURL: API_BASE_URL, timeout: APK_UPLOAD_TIMEOUT_MS });

const getAuthHeader = () => {
    const token = localStorage.getItem('accessToken');
    return token ? { Authorization: `Bearer ${token}` } : {};
};

export const getDashboardMetrics = () => api.get('/admin/dashboard', { timeout: API_REQUEST_TIMEOUT_MS });
export const getDevToolsData = () => api.get('/admin/dev-tools', { timeout: API_REQUEST_TIMEOUT_MS });
export const updateDevAppConfig = (payload) => api.patch('/admin/dev-tools/app-config', payload, { timeout: API_REQUEST_TIMEOUT_MS });
export const uploadDevAppApk = (formData, onUploadProgress) =>
    uploadApi.post('/admin/dev-tools/app-config/upload-apk', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
            ...getAuthHeader()
        },
        onUploadProgress,
        timeout: APK_UPLOAD_TIMEOUT_MS
    });
export const getDevDevelopers = () => api.get('/admin/dev-tools/developers', { timeout: API_REQUEST_TIMEOUT_MS });
export const createDevDeveloper = (payload) => api.post('/admin/dev-tools/developers', payload, { timeout: API_REQUEST_TIMEOUT_MS });
export const updateDevDeveloper = (id, payload) => api.patch(`/admin/dev-tools/developers/${id}`, payload, { timeout: API_REQUEST_TIMEOUT_MS });
export const deleteDevDeveloper = (id) => api.delete(`/admin/dev-tools/developers/${id}`, { timeout: API_REQUEST_TIMEOUT_MS });
export const updateDevUser = (id, payload) => api.patch(`/admin/dev-tools/users/${id}`, payload, { timeout: API_REQUEST_TIMEOUT_MS });
export const deleteDevUser = (id) => api.delete(`/admin/dev-tools/users/${id}`, { timeout: API_REQUEST_TIMEOUT_MS });
