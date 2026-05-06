import axios from 'axios';
import api from './axios';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://13.200.19.117/api';
const uploadApi = axios.create({ baseURL: apiBaseUrl, timeout: 0 });

const getAuthHeader = () => {
    const token = localStorage.getItem('accessToken');
    return token ? { Authorization: `Bearer ${token}` } : {};
};

export const getDashboardMetrics = () => api.get('/admin/dashboard', { timeout: 300000 });
export const getDevToolsData = () => api.get('/admin/dev-tools', { timeout: 300000 });
export const updateDevAppConfig = (payload) => api.patch('/admin/dev-tools/app-config', payload, { timeout: 300000 });
export const uploadDevAppApk = (formData, onUploadProgress) =>
    uploadApi.post('/admin/dev-tools/app-config/upload-apk', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
            ...getAuthHeader()
        },
        onUploadProgress,
        timeout: 0
    });
export const getDevDevelopers = () => api.get('/admin/dev-tools/developers', { timeout: 300000 });
export const createDevDeveloper = (payload) => api.post('/admin/dev-tools/developers', payload, { timeout: 300000 });
export const updateDevDeveloper = (id, payload) => api.patch(`/admin/dev-tools/developers/${id}`, payload, { timeout: 300000 });
export const deleteDevDeveloper = (id) => api.delete(`/admin/dev-tools/developers/${id}`, { timeout: 300000 });
export const updateDevUser = (id, payload) => api.patch(`/admin/dev-tools/users/${id}`, payload, { timeout: 300000 });
export const deleteDevUser = (id) => api.delete(`/admin/dev-tools/users/${id}`, { timeout: 300000 });
