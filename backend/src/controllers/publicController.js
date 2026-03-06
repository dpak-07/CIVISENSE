const { StatusCodes } = require('http-status-codes');
const asyncHandler = require('../utils/asyncHandler');
const contactService = require('../services/contactService');
const adminService = require('../services/adminService');
const sensitiveLocationService = require('../services/sensitiveLocationService');

const sendContactMessage = asyncHandler(async (req, res) => {
  const result = await contactService.sendContactMessage(req.body);

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Message sent successfully',
    data: result
  });
});

const getAppConfig = asyncHandler(async (_req, res) => {
  const config = await adminService.getPublicAppConfig();
  res.status(StatusCodes.OK).json({
    success: true,
    data: config
  });
});

const getSensitiveLocations = asyncHandler(async (req, res) => {
  const locations = await sensitiveLocationService.getPublicSensitiveLocations(req.query);
  res.status(StatusCodes.OK).json({
    success: true,
    data: locations
  });
});

const getDevelopers = asyncHandler(async (_req, res) => {
  const developers = await adminService.getPublicDevelopers();
  res.status(StatusCodes.OK).json({
    success: true,
    data: developers
  });
});

module.exports = {
  sendContactMessage,
  getAppConfig,
  getSensitiveLocations,
  getDevelopers
};
