const bcrypt = require('bcryptjs');
const { StatusCodes } = require('http-status-codes');
const Complaint = require('../models/Complaint');
const User = require('../models/User');
const MunicipalOffice = require('../models/MunicipalOffice');
const SystemConfig = require('../models/SystemConfig');
const { COMPLAINT_STATUS } = require('../constants/complaint');
const { ROLES } = require('../constants/roles');
const ApiError = require('../utils/ApiError');

const SALT_ROUNDS = 12;
const APP_CONFIG_KEY = 'app_distribution';

const DEFAULT_APP_CONFIG = Object.freeze({
  androidApkUrl: 'https://github.com/dpak-07/CIVISENCE/releases',
  iosNote:
    'iOS build is coming soon. Apple dev tools asked for money, our startup wallet said "buffering...".'
});

const sanitizeDevUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  isActive: user.isActive,
  municipalOfficeId: user.municipalOfficeId?._id || user.municipalOfficeId || null,
  officeName: user.municipalOfficeId?.name || null,
  updatedAt: user.updatedAt
});

const toAppConfigResponse = (config) => ({
  androidApkUrl: config?.androidApkUrl || DEFAULT_APP_CONFIG.androidApkUrl,
  iosNote: config?.iosNote || DEFAULT_APP_CONFIG.iosNote,
  updatedAt: config?.updatedAt || null
});

const getOrCreateAppConfig = async () => {
  let config = await SystemConfig.findOne({ key: APP_CONFIG_KEY });
  if (config) return config;

  config = await SystemConfig.create({
    key: APP_CONFIG_KEY,
    androidApkUrl: DEFAULT_APP_CONFIG.androidApkUrl,
    iosNote: DEFAULT_APP_CONFIG.iosNote
  });

  return config;
};

const getDashboardMetrics = async () => {
  const [
    totalComplaints,
    assignedOrInProgressComplaints,
    resolvedComplaints,
    rejectedComplaints,
    reportedComplaints,
    inProgressComplaints,
    unassignedComplaints,
    totalUsers,
    activeUsers,
    totalOffices,
    activeOffices,
    topCategories,
    resolutionStats,
    priorityBreakdown
  ] = await Promise.all([
    Complaint.countDocuments(),
    Complaint.countDocuments({
      status: { $in: [COMPLAINT_STATUS.ASSIGNED, COMPLAINT_STATUS.IN_PROGRESS] }
    }),
    Complaint.countDocuments({ status: COMPLAINT_STATUS.RESOLVED }),
    Complaint.countDocuments({ status: COMPLAINT_STATUS.REJECTED }),
    Complaint.countDocuments({ status: COMPLAINT_STATUS.REPORTED }),
    Complaint.countDocuments({ status: COMPLAINT_STATUS.IN_PROGRESS }),
    Complaint.countDocuments({ status: COMPLAINT_STATUS.UNASSIGNED }),
    User.countDocuments(),
    User.countDocuments({ isActive: true }),
    MunicipalOffice.countDocuments(),
    MunicipalOffice.countDocuments({ isActive: true }),
    Complaint.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 8 }
    ]),
    Complaint.aggregate([
      { $match: { status: COMPLAINT_STATUS.RESOLVED } },
      {
        $project: {
          resolutionTimeMs: { $subtract: ['$updatedAt', '$createdAt'] }
        }
      },
      {
        $group: {
          _id: null,
          averageResolutionTimeMs: { $avg: '$resolutionTimeMs' }
        }
      }
    ]),
    Complaint.aggregate([
      {
        $group: {
          _id: '$priority.level',
          count: { $sum: 1 }
        }
      }
    ])
  ]);

  const priorityMap = priorityBreakdown.reduce((acc, entry) => {
    const key = entry._id || 'low';
    acc[key] = entry.count;
    return acc;
  }, {});

  const averageResolutionTimeMs = resolutionStats[0]?.averageResolutionTimeMs || 0;
  const pendingComplaints = totalComplaints - resolvedComplaints - rejectedComplaints;
  const assignedComplaints = Math.max(assignedOrInProgressComplaints - inProgressComplaints, 0);

  const statusBreakdown = {
    reported: reportedComplaints,
    assigned: assignedComplaints,
    in_progress: inProgressComplaints,
    resolved: resolvedComplaints,
    rejected: rejectedComplaints,
    unassigned: unassignedComplaints
  };

  return {
    totalReports: totalComplaints,
    resolvedReports: resolvedComplaints,
    rejectedReports: rejectedComplaints,
    pendingReports: pendingComplaints,
    totalUsers,
    activeUsers,
    totalOffices,
    activeOffices,
    resolutionRate: totalComplaints ? Number(((resolvedComplaints / totalComplaints) * 100).toFixed(2)) : 0,
    statusBreakdown,
    topCategories,
    priorityBreakdown: {
      critical: priorityMap.critical || 0,
      high: priorityMap.high || 0,
      medium: priorityMap.medium || 0,
      low: priorityMap.low || 0
    },
    avgResolutionHours: Number((averageResolutionTimeMs / (1000 * 60 * 60)).toFixed(2)),

    // Backward-compatible fields used by existing pages.
    totalComplaints,
    resolvedComplaints,
    pendingComplaints,
    assigned: assignedOrInProgressComplaints,
    resolved: resolvedComplaints,
    unassigned: unassignedComplaints,
    averageResolutionTimeMs,
    averageResolutionTimeHours: Number((averageResolutionTimeMs / (1000 * 60 * 60)).toFixed(2))
  };
};

const getPublicAppConfig = async () => {
  const config = await getOrCreateAppConfig();
  return toAppConfigResponse(config);
};

const getDevToolsData = async () => {
  const [config, admins, officers] = await Promise.all([
    getOrCreateAppConfig(),
    User.find({ role: { $in: [ROLES.ADMIN, ROLES.SUPER_ADMIN] } })
      .sort({ createdAt: 1 })
      .lean(),
    User.find({ role: ROLES.OFFICER })
      .populate({ path: 'municipalOfficeId', select: 'name zone type' })
      .sort({ createdAt: 1 })
      .lean()
  ]);

  return {
    appConfig: toAppConfigResponse(config),
    admins: admins.map(sanitizeDevUser),
    officers: officers.map(sanitizeDevUser)
  };
};

const updateAppConfig = async ({ androidApkUrl, iosNote, updatedBy }) => {
  const update = {};
  if (typeof androidApkUrl !== 'undefined') {
    const trimmedUrl = String(androidApkUrl || '').trim();
    if (!trimmedUrl) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'androidApkUrl is required');
    }
    update.androidApkUrl = trimmedUrl;
  }

  if (typeof iosNote !== 'undefined') {
    const trimmedNote = String(iosNote || '').trim();
    if (!trimmedNote) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'iosNote is required');
    }
    update.iosNote = trimmedNote;
  }

  if (Object.keys(update).length === 0) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'No app config fields provided');
  }

  update.updatedBy = updatedBy || null;

  const config = await SystemConfig.findOneAndUpdate(
    { key: APP_CONFIG_KEY },
    { $set: update, $setOnInsert: { ...DEFAULT_APP_CONFIG, key: APP_CONFIG_KEY } },
    { new: true, upsert: true, runValidators: true }
  );

  return toAppConfigResponse(config);
};

const updateDevUserCredentials = async ({ userId, payload }) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');
  }

  if (![ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.OFFICER].includes(user.role)) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Only admin and office accounts can be updated from developer tools'
    );
  }

  const update = {};

  if (typeof payload.name !== 'undefined') {
    const name = String(payload.name || '').trim();
    if (!name) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Name cannot be empty');
    }
    update.name = name;
  }

  if (typeof payload.email !== 'undefined') {
    const email = String(payload.email || '').trim().toLowerCase();
    if (!email) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Email cannot be empty');
    }

    const existing = await User.findOne({ email, _id: { $ne: userId } }).lean();
    if (existing) {
      throw new ApiError(StatusCodes.CONFLICT, 'Email is already used by another account');
    }

    update.email = email;
  }

  if (typeof payload.password !== 'undefined') {
    const password = String(payload.password || '');
    if (password.length < 4) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Password must be at least 4 characters');
    }
    update.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  }

  if (typeof payload.isActive !== 'undefined') {
    update.isActive = Boolean(payload.isActive);
  }

  if (Object.keys(update).length === 0) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'No user fields provided');
  }

  const updated = await User.findByIdAndUpdate(userId, { $set: update }, { new: true, runValidators: true })
    .populate({ path: 'municipalOfficeId', select: 'name zone type' })
    .lean();

  return sanitizeDevUser(updated);
};

const deleteDevUser = async ({ userId, requestedBy }) => {
  const user = await User.findById(userId).lean();
  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');
  }

  if (![ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.OFFICER].includes(user.role)) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Only admin and office accounts can be deleted from developer tools'
    );
  }

  if (String(user._id) === String(requestedBy || '')) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'You cannot delete your own account');
  }

  if (user.role === ROLES.SUPER_ADMIN) {
    const activeSuperAdminCount = await User.countDocuments({
      role: ROLES.SUPER_ADMIN,
      isActive: true
    });
    if (activeSuperAdminCount <= 1) {
      throw new ApiError(StatusCodes.CONFLICT, 'At least one active super admin must remain');
    }
  }

  await User.findByIdAndDelete(userId);

  return {
    deleted: true,
    userId: userId.toString(),
    role: user.role
  };
};

module.exports = {
  getDashboardMetrics,
  getPublicAppConfig,
  getDevToolsData,
  updateAppConfig,
  updateDevUserCredentials,
  deleteDevUser
};
