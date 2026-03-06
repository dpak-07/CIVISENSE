const { StatusCodes } = require('http-status-codes');
const asyncHandler = require('../utils/asyncHandler');
const authService = require('../services/authService');

const requestRegisterOtp = asyncHandler(async (req, res) => {
  const result = await authService.requestRegisterOtp(req.body);
  res.status(StatusCodes.OK).json({ success: true, data: result });
});

const registerWithOtp = asyncHandler(async (req, res) => {
  const result = await authService.registerWithOtp({
    ...req.body,
    profilePhotoUrl: req.uploadedProfilePhotoUrl || null
  });
  res.status(StatusCodes.CREATED).json({ success: true, data: result });
});

const register = asyncHandler(async (req, res) => {
  const result = await authService.register({
    ...req.body,
    profilePhotoUrl: req.uploadedProfilePhotoUrl || null
  });
  res.status(StatusCodes.CREATED).json({ success: true, data: result });
});

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  res.status(StatusCodes.OK).json({ success: true, data: result });
});

const refresh = asyncHandler(async (req, res) => {
  const result = await authService.refreshAuthToken(req.body);
  res.status(StatusCodes.OK).json({ success: true, data: result });
});

const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.body);
  res.status(StatusCodes.NO_CONTENT).send();
});

module.exports = {
  requestRegisterOtp,
  registerWithOtp,
  register,
  login,
  refresh,
  logout
};
