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
  updateSensitiveLocation,
  deleteSensitiveLocation
};
