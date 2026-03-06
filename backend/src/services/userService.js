const { StatusCodes } = require('http-status-codes');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Complaint = require('../models/Complaint');
const Notification = require('../models/Notification');
const UserMisuseReport = require('../models/UserMisuseReport');
const BlacklistedUser = require('../models/BlacklistedUser');
const ApiError = require('../utils/ApiError');

const sanitizeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  municipalOfficeId: user.municipalOfficeId || null,
  language: user.language || 'en',
  isActive: user.isActive,
  misuseReportCount: user.misuseReportCount || 0,
  isBlacklisted: Boolean(user.isBlacklisted),
  blacklistedAt: user.blacklistedAt || null,
  blacklistReason: user.blacklistReason || null,
  profilePhotoUrl: user.profilePhotoUrl || null,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
});

const ALLOWED_LANGUAGES = new Set(['en', 'ta', 'hi']);

const updateProfilePhoto = async ({ userId, profilePhotoUrl }) => {
  if (!profilePhotoUrl) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Profile photo is required');
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { profilePhotoUrl },
    { new: true }
  );

  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');
  }

  return sanitizeUser(user);
};

const removeProfilePhoto = async ({ userId }) => {
  const user = await User.findByIdAndUpdate(
    userId,
    { profilePhotoUrl: null },
    { new: true }
  );

  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');
  }

  return sanitizeUser(user);
};

const updateLanguagePreference = async ({ userId, language }) => {
  const normalizedLanguage = String(language || '').trim().toLowerCase();
  if (!ALLOWED_LANGUAGES.has(normalizedLanguage)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Unsupported language');
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { language: normalizedLanguage },
    { new: true }
  );

  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');
  }

  return sanitizeUser(user);
};

const deleteAccount = async ({ userId }) => {
  const user = await User.findById(userId).select('+passwordHash +refreshTokenHash');

  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');
  }

  const complaintIds = await Complaint.find({ reportedBy: userId }).distinct('_id');

  if (complaintIds.length > 0) {
    await Notification.deleteMany({ complaintId: { $in: complaintIds } });
  }

  await Notification.deleteMany({ userId });
  await UserMisuseReport.deleteMany({
    $or: [{ reportedUserId: userId }, { reportedBy: userId }]
  });
  await BlacklistedUser.deleteMany({ userId });

  const deletedTag = `${Date.now()}_${userId}`;
  const anonymizedEmail = `deleted+${deletedTag}@civisense.local`;
  const placeholderPasswordHash = await bcrypt.hash(`deleted:${deletedTag}`, 10);

  user.name = 'Deleted User';
  user.email = anonymizedEmail;
  user.passwordHash = placeholderPasswordHash;
  user.language = 'en';
  user.isActive = false;
  user.misuseReportCount = 0;
  user.isBlacklisted = false;
  user.blacklistedAt = null;
  user.blacklistReason = null;
  user.deviceToken = null;
  user.profilePhotoUrl = null;
  user.refreshTokenHash = null;
  await user.save({ validateModifiedOnly: true });

  return { deleted: true };
};

module.exports = {
  updateProfilePhoto,
  removeProfilePhoto,
  updateLanguagePreference,
  deleteAccount
};
