const { StatusCodes } = require('http-status-codes');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const env = require('../config/env');
const logsService = require('../services/logsService');
const User = require('../models/User');
const BlacklistedUser = require('../models/BlacklistedUser');

const AI_REQUEST_TIMEOUT_MS = 4000;

const fetchAiService = async (path, params = {}) => {
  if (!env.aiServiceBaseUrl) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'AI service base URL not configured');
  }

  const url = new URL(path, env.aiServiceBaseUrl);
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    url.searchParams.set(key, String(value));
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new ApiError(
        StatusCodes.BAD_GATEWAY,
        `AI service responded with ${response.status}${body ? `: ${body}` : ''}`
      );
    }
    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new ApiError(StatusCodes.GATEWAY_TIMEOUT, 'AI service request timed out');
    }
    if (error.statusCode) {
      throw error;
    }
    throw new ApiError(StatusCodes.BAD_GATEWAY, 'AI service unavailable');
  } finally {
    clearTimeout(timeoutId);
  }
};

const getOverview = asyncHandler(async (_req, res) => {
  const [totalUsers, activeUsers, blacklistedUsers, blacklistedRecords] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ isActive: true }),
    User.countDocuments({ isBlacklisted: true }),
    BlacklistedUser.countDocuments({ isActive: true })
  ]);

  const overview = logsService.getOverview();
  if (!overview.system) {
    overview.system = logsService.getSystemMetrics();
  }

  res.status(StatusCodes.OK).json({
    success: true,
    data: {
      ...overview,
      users: {
        total: totalUsers,
        active: activeUsers,
        blacklisted: blacklistedUsers,
        blacklistedRecords
      }
    }
  });
});

const getRecent = asyncHandler(async (req, res) => {
  const type = String(req.query?.type || 'all').toLowerCase();
  const limit = Number(req.query?.limit || 80);
  const data = logsService.getRecent({ type, limit });

  res.status(StatusCodes.OK).json({ success: true, data });
});

const ingestClientLog = asyncHandler(async (req, res) => {
  const entry = logsService.recordClientLog({ req, payload: req.body || {} });

  if (!entry) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid log payload');
  }

  res.status(StatusCodes.CREATED).json({ success: true, data: entry });
});

const getAiOverview = asyncHandler(async (_req, res) => {
  const data = await fetchAiService('/logs/overview');
  res.status(StatusCodes.OK).json({ success: true, data });
});

const getAiRecent = asyncHandler(async (req, res) => {
  const limit = Number(req.query?.limit || 120);
  const level = req.query?.level ? String(req.query.level) : undefined;
  const data = await fetchAiService('/logs/recent', { limit, level });
  res.status(StatusCodes.OK).json({ success: true, data });
});

module.exports = {
  getOverview,
  getRecent,
  ingestClientLog,
  getAiOverview,
  getAiRecent
};
