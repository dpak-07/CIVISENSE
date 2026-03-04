const { StatusCodes } = require('http-status-codes');
const asyncHandler = require('../utils/asyncHandler');
const env = require('../config/env');
const authService = require('../services/authService');
const { REFRESH_TOKEN_COOKIE_NAME, getCookieValue } = require('../utils/cookies');

const parseDurationToMs = (duration, fallbackMs) => {
  const value = String(duration || '').trim();
  const match = value.match(/^(\d+)([smhd])$/i);
  if (!match) {
    return fallbackMs;
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (!Number.isFinite(amount) || amount <= 0) {
    return fallbackMs;
  }

  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
  };

  return amount * (multipliers[unit] || fallbackMs);
};

const refreshCookieOptions = {
  httpOnly: true,
  secure: env.cookie.secure,
  sameSite: env.cookie.sameSite,
  path: '/api/auth',
  maxAge: parseDurationToMs(env.jwt.refreshExpiresIn, 7 * 24 * 60 * 60 * 1000),
  ...(env.cookie.domain ? { domain: env.cookie.domain } : {})
};

const setRefreshTokenCookie = (res, refreshToken) => {
  res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, refreshCookieOptions);
};

const clearRefreshTokenCookie = (res) => {
  res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, refreshCookieOptions);
};

const resolveRefreshTokenFromRequest = (req) =>
  req.body?.refreshToken || getCookieValue(req.headers.cookie, REFRESH_TOKEN_COOKIE_NAME);

const requestRegisterOtp = asyncHandler(async (req, res) => {
  const result = await authService.requestRegisterOtp(req.body);
  res.status(StatusCodes.OK).json({ success: true, data: result });
});

const registerWithOtp = asyncHandler(async (req, res) => {
  const result = await authService.registerWithOtp({
    ...req.body,
    profilePhotoUrl: req.uploadedProfilePhotoUrl || null
  });
  setRefreshTokenCookie(res, result.refreshToken);
  res.status(StatusCodes.CREATED).json({ success: true, data: result });
});

const register = asyncHandler(async (req, res) => {
  const result = await authService.register({
    ...req.body,
    profilePhotoUrl: req.uploadedProfilePhotoUrl || null
  });
  setRefreshTokenCookie(res, result.refreshToken);
  res.status(StatusCodes.CREATED).json({ success: true, data: result });
});

const login = asyncHandler(async (req, res) => {
  const result = await authService.login(req.body);
  setRefreshTokenCookie(res, result.refreshToken);
  res.status(StatusCodes.OK).json({ success: true, data: result });
});

const refresh = asyncHandler(async (req, res) => {
  const refreshToken = resolveRefreshTokenFromRequest(req);
  const result = await authService.refreshAuthToken({ refreshToken });
  setRefreshTokenCookie(res, result.refreshToken);
  res.status(StatusCodes.OK).json({ success: true, data: result });
});

const logout = asyncHandler(async (req, res) => {
  const refreshToken = resolveRefreshTokenFromRequest(req);
  await authService.logout({ refreshToken });
  clearRefreshTokenCookie(res);
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
