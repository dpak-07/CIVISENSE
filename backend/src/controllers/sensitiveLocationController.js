const { StatusCodes } = require('http-status-codes');
const asyncHandler = require('../utils/asyncHandler');
const sensitiveLocationService = require('../services/sensitiveLocationService');

const createSensitiveLocation = asyncHandler(async (req, res) => {
  const location = await sensitiveLocationService.createSensitiveLocation(req.body, req.user?.id);
  res.status(StatusCodes.CREATED).json({ success: true, data: location });
});

const getSensitiveLocations = asyncHandler(async (req, res) => {
  const locations = await sensitiveLocationService.getSensitiveLocations(req.query);
  res.status(StatusCodes.OK).json({ success: true, data: locations });
});

const importSensitiveLocations = asyncHandler(async (req, res) => {
  const result = await sensitiveLocationService.importSensitiveLocations({
    buffer: req.uploadedSpreadsheet?.buffer,
    createdBy: req.user?.id || null
  });
  res.status(StatusCodes.OK).json({ success: true, data: result });
});

const downloadSensitiveLocationTemplate = asyncHandler(async (_req, res) => {
  const buffer = await sensitiveLocationService.buildSensitiveLocationImportTemplateBuffer();
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader(
    'Content-Disposition',
    'attachment; filename="sensitive-location-import-template.xlsx"'
  );
  res.status(StatusCodes.OK).send(buffer);
});

const updateSensitiveLocation = asyncHandler(async (req, res) => {
  const location = await sensitiveLocationService.updateSensitiveLocation(req.params.id, req.body);
  res.status(StatusCodes.OK).json({ success: true, data: location });
});

const deleteSensitiveLocation = asyncHandler(async (req, res) => {
  const result = await sensitiveLocationService.deleteSensitiveLocation(req.params.id);
  res.status(StatusCodes.OK).json({ success: true, data: result });
});

module.exports = {
  createSensitiveLocation,
  getSensitiveLocations,
  importSensitiveLocations,
  downloadSensitiveLocationTemplate,
  updateSensitiveLocation,
  deleteSensitiveLocation
};
