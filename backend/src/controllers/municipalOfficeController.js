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
  updateMunicipalOffice,
  deleteMunicipalOffice
};
