import api from './axios';

export const sendContactMessage = (payload) => api.post('/public/contact', payload);
export const getAppConfig = () => api.get('/public/app-config');
export const getPublicSensitiveLocations = (params) => api.get('/public/sensitive-locations', { params });
