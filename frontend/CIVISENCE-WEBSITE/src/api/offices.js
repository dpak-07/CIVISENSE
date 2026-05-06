import api from './axios';

export const getMunicipalOffices = (params) =>
    api.get('/municipal-offices', { params });

export const createMunicipalOffice = (data) =>
    api.post('/municipal-offices', data);

export const updateMunicipalOffice = (id, data) =>
    api.patch(`/municipal-offices/${id}`, data);

export const deleteMunicipalOffice = (id) =>
    api.delete(`/municipal-offices/${id}`);

export const importMunicipalOffices = (formData) =>
    api.post('/municipal-offices/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    });

export const downloadMunicipalOfficeTemplate = () =>
    api.get('/municipal-offices/import-template', {
        responseType: 'blob'
    });

// Short aliases
export const getOffices = getMunicipalOffices;
export const createOffice = createMunicipalOffice;
export const updateOffice = updateMunicipalOffice;
export const deleteOffice = deleteMunicipalOffice;
