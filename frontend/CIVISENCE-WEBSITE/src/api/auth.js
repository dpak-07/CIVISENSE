import api from './axios';

export const login = (credentials) => api.post('/auth/login', credentials);

export const requestRegisterOtp = (payload) =>
    api.post('/auth/register/request-otp', payload);

export const register = (formData) =>
    api.post('/auth/register/verify-otp', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });

export const refreshSession = (token = null) =>
    api.post('/auth/refresh', token ? { refreshToken: token } : {});

export const logout = (token = null) =>
    api.post('/auth/logout', token ? { refreshToken: token } : {});
