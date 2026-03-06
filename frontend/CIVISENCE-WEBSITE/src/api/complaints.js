import api from './axios';

export const getComplaints = (params) => api.get('/complaints', { params });

export const getComplaintById = (id) => api.get(`/complaints/${id}`);

export const createComplaint = (formData) =>
    api.post('/complaints', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });

export const updateComplaintStatus = (id, payload) =>
    api.patch(`/complaints/${id}/status`, payload);

export const reportComplaintUser = (id, payload) =>
    api.patch(`/complaints/${id}/report-user`, payload);

export const deleteComplaint = (id) => api.delete(`/complaints/${id}`);
