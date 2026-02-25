import api from './axios';

export const getDashboardMetrics = () => api.get('/admin/dashboard');
export const getDevToolsData = () => api.get('/admin/dev-tools');
export const updateDevAppConfig = (payload) => api.patch('/admin/dev-tools/app-config', payload);
export const updateDevUser = (id, payload) => api.patch(`/admin/dev-tools/users/${id}`, payload);
export const deleteDevUser = (id) => api.delete(`/admin/dev-tools/users/${id}`);
