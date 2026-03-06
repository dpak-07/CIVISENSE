import api from './axios';

export const updateProfilePhoto = (formData) =>
    api.post('/users/profile-photo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });

export const removeProfilePhoto = () => api.delete('/users/profile-photo');

export const updateLanguagePreference = (language) =>
    api.patch('/users/preferences/language', { language });

export const deleteAccount = () => api.delete('/users/account');
