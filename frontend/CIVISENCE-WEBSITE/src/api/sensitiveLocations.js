import api from './axios';

export const getSensitiveLocations = (params) =>
    api.get('/sensitive-locations', { params });

export const createSensitiveLocation = (payload) =>
    api.post('/sensitive-locations', payload);

export const updateSensitiveLocation = (id, payload) =>
    api.patch(`/sensitive-locations/${id}`, payload);

export const deleteSensitiveLocation = (id) =>
    api.delete(`/sensitive-locations/${id}`);
