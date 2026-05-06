const { StatusCodes } = require('http-status-codes');
const asyncHandler = require('../utils/asyncHandler');
const municipalOfficeService = require('../services/municipalOfficeService');

const createMunicipalOffice = asyncHandler(async (req, res) => {
  const office = await municipalOfficeService.createMunicipalOffice(req.body);
  res.status(StatusCodes.CREATED).json({ success: true, data: office });
});

const getMunicipalOffices = asyncHandler(async (req, res) => {
  const offices = await municipalOfficeService.getMunicipalOffices(req.query);
  res.status(StatusCodes.OK).json({ success: true, data: offices });
});

const importMunicipalOffices = asyncHandler(async (req, res) => {
  const result = await municipalOfficeService.importMunicipalOffices({
    buffer: req.uploadedSpreadsheet?.buffer
  });
  res.status(StatusCodes.OK).json({ success: true, data: result });
});

const downloadMunicipalOfficeTemplate = asyncHandler(async (_req, res) => {
  const buffer = await municipalOfficeService.buildMunicipalOfficeImportTemplateBuffer();
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader(
    'Content-Disposition',
    'attachment; filename="municipal-office-import-template.xlsx"'
  );
  res.status(StatusCodes.OK).send(buffer);
});

const updateMunicipalOffice = asyncHandler(async (req, res) => {
  const office = await municipalOfficeService.updateMunicipalOffice(req.params.id, req.body);
  res.status(StatusCodes.OK).json({ success: true, data: office });
});

const deleteMunicipalOffice = asyncHandler(async (req, res) => {
  const result = await municipalOfficeService.deleteMunicipalOffice(req.params.id);
  res.status(StatusCodes.OK).json({ success: true, data: result });
});

module.exports = {
  createMunicipalOffice,
  getMunicipalOffices,
  importMunicipalOffices,
  downloadMunicipalOfficeTemplate,
  updateMunicipalOffice,
  deleteMunicipalOffice
};
