import api from './axios';

export const getNotifications = () => api.get('/notifications');

export const markAsRead = (id) => api.patch(`/notifications/${id}/read`);
