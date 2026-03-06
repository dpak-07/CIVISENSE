const bcrypt = require('bcryptjs');
const { StatusCodes } = require('http-status-codes');
const Complaint = require('../models/Complaint');
const User = require('../models/User');
const MunicipalOffice = require('../models/MunicipalOffice');
const SystemConfig = require('../models/SystemConfig');
const DeveloperProfile = require('../models/DeveloperProfile');
const { COMPLAINT_STATUS } = require('../constants/complaint');
const { ROLES } = require('../constants/roles');
const ApiError = require('../utils/ApiError');
const { normalizeEmail, ensureDefaultDomainEmail } = require('../utils/email');

const SALT_ROUNDS = 12;
const APP_CONFIG_KEY = 'app_distribution';

const DEFAULT_APP_CONFIG = Object.freeze({
  androidApkUrl: 'https://github.com/dpak-07/CIVISENCE/releases',
  iosNote:
    'iOS build is coming soon. Apple dev tools asked for money, our startup wallet said "buffering...".'
});

const DEFAULT_DEVELOPER_PROFILES = Object.freeze([
  {
    profileType: 'team',
    name: 'Deepak S',
    role: 'Team Lead - Cloud, Backend, Mobile App, Website',
    description:
      'Deepak leads the development and architecture of the CiviSense platform. He built the backend services, cloud infrastructure, and integrations between the mobile app and web platform to ensure a scalable civic reporting system.',
    skills: ['System Architecture', 'Backend APIs', 'Cloud Deployment', 'Mobile Integration'],
    highlights: ['Platform architecture leadership', 'Backend and cloud infrastructure'],
    socials: { github: '#', linkedin: '#', portfolio: '#' },
    displayOrder: 1,
    isActive: true
  },
  {
    profileType: 'team',
    name: 'Lokesh',
    role: 'Idea Architect - Research Lead',
    description:
      'Lokesh proposed the initial concept behind the CiviSense platform and researched real civic infrastructure problems to shape the direction of the project.',
    skills: [],
    highlights: ['Project ideation', 'Civic problem research'],
    socials: { github: '#', linkedin: '#', portfolio: '#' },
    displayOrder: 2,
    isActive: true
  },
  {
    profileType: 'team',
    name: 'Bala Vignesh',
    role: 'Research Contributor',
    description:
      'Bala Vignesh supported the research phase of the CiviSense project by exploring the feasibility of AI-based civic issue detection and contributing to early project studies.',
    skills: [],
    highlights: ['AI research support', 'Project feasibility analysis'],
    socials: { github: '#', linkedin: '#', portfolio: '#' },
    displayOrder: 3,
    isActive: true
  },
  {
    profileType: 'team',
    name: 'Priya Dharshini',
    role: 'UI/UX Designer - Mobile App Design',
    description:
      'Priya Dharshini designed the user interface and user experience for the CiviSense mobile app and dashboards, focusing on simple and intuitive civic reporting flows.',
    skills: ['UI Design', 'UX Research', 'Mobile Interface Design'],
    highlights: ['Mobile app interface design', 'Citizen reporting UX'],
    socials: { github: '#', linkedin: '#', portfolio: '#' },
    displayOrder: 4,
    isActive: true
  },
  {
    profileType: 'mentor',
    name: 'Mrs. Vijiyalakshmi',
    role: 'Assistant Professor - Project Guide',
    description:
      'Mrs. Vijiyalakshmi from Velammal Engineering College provided academic mentorship and guidance throughout the development of the CiviSense project.',
    skills: [],
    highlights: ['Academic mentorship', 'Project supervision'],
    socials: { github: '#', linkedin: '#', portfolio: '#' },
    displayOrder: 5,
    isActive: true
  }
]);

const sanitizeDevUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  isActive: user.isActive,
  misuseReportCount: Number(user.misuseReportCount || 0),
  isBlacklisted: Boolean(user.isBlacklisted),
  blacklistedAt: user.blacklistedAt || null,
  blacklistReason: user.blacklistReason || null,
  municipalOfficeId: user.municipalOfficeId?._id || user.municipalOfficeId || null,
  officeName: user.municipalOfficeId?.name || null,
  updatedAt: user.updatedAt
});

const sanitizeStringList = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .slice(0, 20);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .slice(0, 20);
  }

  return [];
};

const sanitizeDeveloperProfile = (profile) => ({
  id: profile._id,
  profileType: profile.profileType || 'team',
  name: profile.name || '',
  role: profile.role || '',
  description: profile.description || '',
  photoUrl: profile.photoUrl || null,
  skills: sanitizeStringList(profile.skills),
  highlights: sanitizeStringList(profile.highlights),
  socials: {
    github: profile.socials?.github || '#',
    linkedin: profile.socials?.linkedin || '#',
    portfolio: profile.socials?.portfolio || '#'
  },
  displayOrder: Number(profile.displayOrder || 0),
  isActive: profile.isActive !== false,
  updatedAt: profile.updatedAt || null
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

const getOrSeedDeveloperProfiles = async () => {
  const existingCount = await DeveloperProfile.countDocuments();
  if (existingCount > 0) return;

  await DeveloperProfile.insertMany(DEFAULT_DEVELOPER_PROFILES);
};

const getDashboardMetrics = async () => {
  const trendStartDate = new Date();
  trendStartDate.setDate(trendStartDate.getDate() - 13);
  trendStartDate.setHours(0, 0, 0, 0);

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
    categoryBreakdown,
    resolutionStats,
    priorityBreakdown,
    dailyTrend
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
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
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
    ]),
    Complaint.aggregate([
      { $match: { createdAt: { $gte: trendStartDate } } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          total: { $sum: 1 },
          resolved: {
            $sum: {
              $cond: [{ $eq: ['$status', COMPLAINT_STATUS.RESOLVED] }, 1, 0]
            }
          },
          highPriority: {
            $sum: {
              $cond: [{ $in: ['$priority.level', ['critical', 'high']] }, 1, 0]
            }
          }
        }
      },
      { $sort: { _id: 1 } }
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

  const dailyTrendSeries = dailyTrend.map((entry) => ({
    day: entry._id,
    total: entry.total || 0,
    resolved: entry.resolved || 0,
    highPriority: entry.highPriority || 0
  }));

  return {
    snapshotAt: new Date().toISOString(),
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
    categoryBreakdown,
    dailyTrend: dailyTrendSeries,
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

const listDeveloperProfiles = async ({ activeOnly = false } = {}) => {
  await getOrSeedDeveloperProfiles();

  const filter = activeOnly ? { isActive: true } : {};
  const profiles = await DeveloperProfile.find(filter).sort({ profileType: 1, displayOrder: 1, createdAt: 1 }).lean();
  return profiles.map(sanitizeDeveloperProfile);
};

const getPublicDevelopers = async () => {
  const profiles = await listDeveloperProfiles({ activeOnly: true });

  const team = profiles.filter((profile) => profile.profileType === 'team');
  const mentor = profiles.find((profile) => profile.profileType === 'mentor') || null;

  return {
    team,
    mentor,
    profiles
  };
};

const getDevToolsData = async () => {
  const [config, admins, officers, citizens, developers] = await Promise.all([
    getOrCreateAppConfig(),
    User.find({ role: { $in: [ROLES.ADMIN, ROLES.SUPER_ADMIN] } })
      .sort({ createdAt: 1 })
      .lean(),
    User.find({ role: ROLES.OFFICER })
      .populate({ path: 'municipalOfficeId', select: 'name zone type' })
      .sort({ createdAt: 1 })
      .lean(),
    User.find({ role: ROLES.CITIZEN })
      .sort({ createdAt: -1 })
      .lean(),
    listDeveloperProfiles()
  ]);

  return {
    appConfig: toAppConfigResponse(config),
    admins: admins.map(sanitizeDevUser),
    officers: officers.map(sanitizeDevUser),
    citizens: citizens.map(sanitizeDevUser),
    developers
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

const buildDeveloperUpdatePayload = (payload = {}, { isCreate = false } = {}) => {
  const update = {};

  if (typeof payload.profileType !== 'undefined') {
    const profileType = String(payload.profileType || '').trim().toLowerCase();
    if (!['team', 'mentor'].includes(profileType)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'profileType must be team or mentor');
    }
    update.profileType = profileType;
  } else if (isCreate) {
    update.profileType = 'team';
  }

  if (typeof payload.name !== 'undefined') {
    const name = String(payload.name || '').trim();
    if (!name) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'name is required');
    }
    update.name = name;
  } else if (isCreate) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'name is required');
  }

  if (typeof payload.role !== 'undefined') {
    const role = String(payload.role || '').trim();
    if (!role) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'role is required');
    }
    update.role = role;
  } else if (isCreate) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'role is required');
  }

  if (typeof payload.description !== 'undefined') {
    const description = String(payload.description || '').trim();
    if (!description) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'description is required');
    }
    update.description = description;
  } else if (isCreate) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'description is required');
  }

  if (typeof payload.photoUrl !== 'undefined') {
    const photoUrl = String(payload.photoUrl || '').trim();
    update.photoUrl = photoUrl || null;
  }

  if (typeof payload.skills !== 'undefined') {
    update.skills = sanitizeStringList(payload.skills);
  } else if (isCreate) {
    update.skills = [];
  }

  if (typeof payload.highlights !== 'undefined') {
    update.highlights = sanitizeStringList(payload.highlights);
  } else if (isCreate) {
    update.highlights = [];
  }

  if (typeof payload.socials !== 'undefined' && payload.socials && typeof payload.socials === 'object') {
    update.socials = {
      github: String(payload.socials.github || '#').trim() || '#',
      linkedin: String(payload.socials.linkedin || '#').trim() || '#',
      portfolio: String(payload.socials.portfolio || '#').trim() || '#'
    };
  } else if (isCreate) {
    update.socials = { github: '#', linkedin: '#', portfolio: '#' };
  }

  if (typeof payload.displayOrder !== 'undefined') {
    const orderValue = Number(payload.displayOrder);
    if (!Number.isFinite(orderValue) || orderValue < 0) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'displayOrder must be a non-negative number');
    }
    update.displayOrder = Math.round(orderValue);
  } else if (isCreate) {
    update.displayOrder = 100;
  }

  if (typeof payload.isActive !== 'undefined') {
    update.isActive = Boolean(payload.isActive);
  } else if (isCreate) {
    update.isActive = true;
  }

  return update;
};

const createDeveloperProfile = async ({ payload, createdBy }) => {
  const update = buildDeveloperUpdatePayload(payload, { isCreate: true });
  update.createdBy = createdBy || null;
  update.updatedBy = createdBy || null;

  const created = await DeveloperProfile.create(update);
  return sanitizeDeveloperProfile(created.toObject());
};

const updateDeveloperProfile = async ({ id, payload, updatedBy }) => {
  const existing = await DeveloperProfile.findById(id).lean();
  if (!existing) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Developer profile not found');
  }

  const update = buildDeveloperUpdatePayload(payload, { isCreate: false });
  if (Object.keys(update).length === 0) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'No developer fields provided');
  }

  update.updatedBy = updatedBy || null;

  const result = await DeveloperProfile.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true }).lean();
  return sanitizeDeveloperProfile(result);
};

const deleteDeveloperProfile = async ({ id }) => {
  const existing = await DeveloperProfile.findById(id).lean();
  if (!existing) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Developer profile not found');
  }

  await DeveloperProfile.findByIdAndDelete(id);
  return { deleted: true, id: String(id) };
};

const updateDevUserCredentials = async ({ userId, payload }) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');
  }

  if (![ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.OFFICER, ROLES.CITIZEN].includes(user.role)) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Only app user accounts can be updated from developer tools'
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
    const email =
      user.role === ROLES.OFFICER
        ? ensureDefaultDomainEmail(payload.email, { defaultDomain: 'gmail.com' })
        : normalizeEmail(payload.email);
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

  if (typeof payload.isBlacklisted !== 'undefined') {
    if (user.role !== ROLES.CITIZEN) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Only citizen accounts can be blacklisted');
    }

    const nextIsBlacklisted = Boolean(payload.isBlacklisted);
    update.isBlacklisted = nextIsBlacklisted;

    if (nextIsBlacklisted) {
      update.blacklistedAt = user.blacklistedAt || new Date();
      update.blacklistReason =
        String(payload.blacklistReason || '').trim() ||
        user.blacklistReason ||
        'Blacklisted by super admin from developer tools';
      update.isActive = false;
    } else {
      update.blacklistedAt = null;
      update.blacklistReason = null;
      if (typeof payload.isActive === 'undefined') {
        update.isActive = true;
      }
    }
  } else if (typeof payload.blacklistReason !== 'undefined' && user.role === ROLES.CITIZEN) {
    const reason = String(payload.blacklistReason || '').trim();
    if (reason) {
      update.blacklistReason = reason;
    }
  }

  if (Object.keys(update).length === 0) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'No user fields provided');
  }

  const updated = await User.findByIdAndUpdate(userId, { $set: update }, { new: true, runValidators: true })
    .populate({ path: 'municipalOfficeId', select: 'name zone type' })
    .lean();

  if (updated?.role === ROLES.OFFICER && updated?.municipalOfficeId) {
    const officeId = updated.municipalOfficeId?._id || updated.municipalOfficeId;
    const office = await MunicipalOffice.findById(officeId).select('officerCredentials').lean();
    if (office) {
      const existingSnapshot = office.officerCredentials || {};
      const nextSnapshot = {
        officerName: updated.name || existingSnapshot.officerName || null,
        officerEmail: updated.email || existingSnapshot.officerEmail || null,
        officerPassword:
          typeof payload.password !== 'undefined'
            ? String(payload.password || '').trim() || existingSnapshot.officerPassword || '1234'
            : existingSnapshot.officerPassword || '1234'
      };
      await MunicipalOffice.findByIdAndUpdate(
        officeId,
        { $set: { officerCredentials: nextSnapshot } },
        { runValidators: true }
      );
    }
  }

  return sanitizeDevUser(updated);
};

const deleteDevUser = async ({ userId, requestedBy }) => {
  const user = await User.findById(userId).lean();
  if (!user) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'User not found');
  }

  if (![ROLES.ADMIN, ROLES.SUPER_ADMIN, ROLES.OFFICER, ROLES.CITIZEN].includes(user.role)) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Only app user accounts can be deleted from developer tools'
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
  getPublicDevelopers,
  listDeveloperProfiles,
  getDevToolsData,
  updateAppConfig,
  createDeveloperProfile,
  updateDeveloperProfile,
  deleteDeveloperProfile,
  updateDevUserCredentials,
  deleteDevUser
};
