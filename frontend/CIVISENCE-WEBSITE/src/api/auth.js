import api from './axios';

export const login = (credentials) => api.post('/auth/login', credentials);

export const requestRegisterOtp = (payload) =>
    api.post('/auth/register/request-otp', payload);

export const register = (formData) =>
    api.post('/auth/register/verify-otp', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });

export const refreshToken = (token) =>
    api.post('/auth/refresh', { refreshToken: token });

export const logout = (token) =>
    api.post('/auth/logout', { refreshToken: token });
