import api from './axios';

export const getLogsOverview = () => api.get('/logs/overview');
export const getRecentLogs = (params) => api.get('/logs/recent', { params });
export const getAiLogsOverview = () => api.get('/logs/ai/overview');
export const getAiRecentLogs = (params) => api.get('/logs/ai/recent', { params });
export const sendClientLog = (payload) => api.post('/logs/client', payload);
