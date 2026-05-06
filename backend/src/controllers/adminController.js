const { StatusCodes } = require('http-status-codes');
const asyncHandler = require('../utils/asyncHandler');
const adminService = require('../services/adminService');
const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');

const getDashboard = asyncHandler(async (_req, res) => {
  const dashboard = await adminService.getDashboardMetrics();
  res.status(StatusCodes.OK).json({ success: true, data: dashboard });
});

const getDevTools = asyncHandler(async (_req, res) => {
  const data = await adminService.getDevToolsData();
  res.status(StatusCodes.OK).json({ success: true, data });
});

const updateAppConfig = asyncHandler(async (req, res) => {
  try {
    const data = await adminService.updateAppConfig({
      androidApkUrl: req.body?.androidApkUrl,
      iosNote: req.body?.iosNote,
      updatedBy: req.user?.id || null
    });
    res.status(StatusCodes.OK).json({ success: true, data });
  } catch (err) {
    logger.error({
      message: 'updateAppConfig failed',
      body: req.body,
      userId: req.user?.id || null,
      error: err.stack || err.message || err
    });
    throw err;
  }
});

const uploadDevAppApk = asyncHandler(async (req, res) => {
  if (!req.uploadedApkUrl) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'APK file is required');
  }

  try {
    const data = await adminService.updateAppConfig({
      androidApkUrl: req.uploadedApkUrl,
      updatedBy: req.user?.id || null
    });

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        ...data,
        uploadedApkUrl: req.uploadedApkUrl
      }
    });
  } catch (err) {
    logger.error({
      message: 'uploadDevAppApk failed',
      uploadedApkUrl: req.uploadedApkUrl,
      userId: req.user?.id || null,
      error: err.stack || err.message || err
    });
    throw err;
  }
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

const listDevDevelopers = asyncHandler(async (_req, res) => {
  const data = await adminService.listDeveloperProfiles();
  res.status(StatusCodes.OK).json({ success: true, data });
});

const createDevDeveloper = asyncHandler(async (req, res) => {
  const data = await adminService.createDeveloperProfile({
    payload: req.body || {},
    createdBy: req.user?.id || null
  });
  res.status(StatusCodes.CREATED).json({ success: true, data });
});

const updateDevDeveloper = asyncHandler(async (req, res) => {
  const data = await adminService.updateDeveloperProfile({
    id: req.params.id,
    payload: req.body || {},
    updatedBy: req.user?.id || null
  });
  res.status(StatusCodes.OK).json({ success: true, data });
});

const deleteDevDeveloper = asyncHandler(async (req, res) => {
  const data = await adminService.deleteDeveloperProfile({ id: req.params.id });
  res.status(StatusCodes.OK).json({ success: true, data });
});

module.exports = {
  getDashboard,
  getDevTools,
  updateAppConfig,
  uploadDevAppApk,
  listDevDevelopers,
  createDevDeveloper,
  updateDevDeveloper,
  deleteDevDeveloper,
  updateDevUserCredentials,
  deleteDevUser
};
