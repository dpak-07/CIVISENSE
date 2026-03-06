import api from './axios';

export const sendContactMessage = (payload) => api.post('/public/contact', payload);
export const getAppConfig = () => api.get('/public/app-config');
export const getPublicSensitiveLocations = (params) => api.get('/public/sensitive-locations', { params });
export const getPublicDevelopers = async () => {
    try {
        return await api.get('/public/developers');
    } catch (error) {
        if (error?.response?.status === 404) {
            return api.get('/developers');
        }
        throw error;
    }
};
