import api from './axios';

export const getDashboardMetrics = () => api.get('/admin/dashboard');
export const getDevToolsData = () => api.get('/admin/dev-tools');
export const updateDevAppConfig = (payload) => api.patch('/admin/dev-tools/app-config', payload);
export const uploadDevAppApk = (formData) =>
    api.post('/admin/dev-tools/app-config/upload-apk', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });
export const getDevDevelopers = () => api.get('/admin/dev-tools/developers');
export const createDevDeveloper = (payload) => api.post('/admin/dev-tools/developers', payload);
export const updateDevDeveloper = (id, payload) => api.patch(`/admin/dev-tools/developers/${id}`, payload);
export const deleteDevDeveloper = (id) => api.delete(`/admin/dev-tools/developers/${id}`);
export const updateDevUser = (id, payload) => api.patch(`/admin/dev-tools/users/${id}`, payload);
export const deleteDevUser = (id) => api.delete(`/admin/dev-tools/users/${id}`);
