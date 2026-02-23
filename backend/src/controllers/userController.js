const { StatusCodes } = require('http-status-codes');
const asyncHandler = require('../utils/asyncHandler');
const userService = require('../services/userService');

const updateProfilePhoto = asyncHandler(async (req, res) => {
  const user = await userService.updateProfilePhoto({
    userId: req.user.id,
    profilePhotoUrl: req.uploadedProfilePhotoUrl || null
  });

  res.status(StatusCodes.OK).json({ success: true, data: user });
});

const removeProfilePhoto = asyncHandler(async (req, res) => {
  const user = await userService.removeProfilePhoto({ userId: req.user.id });
  res.status(StatusCodes.OK).json({ success: true, data: user });
});

const updateLanguagePreference = asyncHandler(async (req, res) => {
  const user = await userService.updateLanguagePreference({
    userId: req.user.id,
    language: req.body?.language
  });
  res.status(StatusCodes.OK).json({ success: true, data: user });
});

const deleteAccount = asyncHandler(async (req, res) => {
  const result = await userService.deleteAccount({ userId: req.user.id });
  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Account deleted',
    data: result
  });
});

module.exports = {
  updateProfilePhoto,
  removeProfilePhoto,
  updateLanguagePreference,
  deleteAccount
};
