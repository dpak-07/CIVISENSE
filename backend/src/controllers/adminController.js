const { StatusCodes } = require('http-status-codes');
const asyncHandler = require('../utils/asyncHandler');
const adminService = require('../services/adminService');

const getDashboard = asyncHandler(async (_req, res) => {
  const dashboard = await adminService.getDashboardMetrics();
  res.status(StatusCodes.OK).json({ success: true, data: dashboard });
});

const getDevTools = asyncHandler(async (_req, res) => {
  const data = await adminService.getDevToolsData();
  res.status(StatusCodes.OK).json({ success: true, data });
});

const updateAppConfig = asyncHandler(async (req, res) => {
  const data = await adminService.updateAppConfig({
    androidApkUrl: req.body?.androidApkUrl,
    iosNote: req.body?.iosNote,
    updatedBy: req.user?.id || null
  });
  res.status(StatusCodes.OK).json({ success: true, data });
});

const updateDevUserCredentials = asyncHandler(async (req, res) => {
  const data = await adminService.updateDevUserCredentials({
    userId: req.params.id,
    payload: req.body || {}
  });
  res.status(StatusCodes.OK).json({ success: true, data });
});

const deleteDevUser = asyncHandler(async (req, res) => {
  const data = await adminService.deleteDevUser({
    userId: req.params.id,
    requestedBy: req.user?.id || null
  });
  res.status(StatusCodes.OK).json({ success: true, data });
});

module.exports = {
  getDashboard,
  getDevTools,
  updateAppConfig,
  updateDevUserCredentials,
  deleteDevUser
};
