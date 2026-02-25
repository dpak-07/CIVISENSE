const bcrypt = require('bcryptjs');
const { StatusCodes } = require('http-status-codes');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken
} = require('../utils/jwt');

const SALT_ROUNDS = 12;

const sanitizeUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  municipalOfficeId: user.municipalOfficeId || null,
  language: user.language || 'en',
  isActive: user.isActive,
  profilePhotoUrl: user.profilePhotoUrl || null,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt
});

const issueTokens = async (user) => {
  const tokenPayload = { userId: user._id.toString(), role: user.role };
  const accessToken = signAccessToken(tokenPayload);
  const refreshToken = signRefreshToken(tokenPayload);
  const refreshTokenHash = await bcrypt.hash(refreshToken, SALT_ROUNDS);

  await User.findByIdAndUpdate(user._id, { refreshTokenHash });

  return { accessToken, refreshToken };
};

const register = async ({ name, email, password, profilePhotoUrl }) => {
  if (!name || !email || !password) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Name, email and password are required');
  }

  if (password.length < 8) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Password must be at least 8 characters');
  }

  const existingUser = await User.findOne({ email: email.toLowerCase() }).lean();
  if (existingUser) {
    throw new ApiError(StatusCodes.CONFLICT, 'Email already registered');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const createdUser = await User.create({
    name,
    email,
    passwordHash,
    role: 'citizen',
    profilePhotoUrl: profilePhotoUrl || null
  });

  const tokens = await issueTokens(createdUser);

  return {
    user: sanitizeUser(createdUser),
    ...tokens
  };
};

const login = async ({ email, password }) => {
  if (!email || !password) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Email and password are required');
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash +refreshTokenHash');
  if (!user) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid credentials');
  }

  if (!user.isActive) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'User account is inactive');
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid credentials');
  }

  const tokens = await issueTokens(user);

  return {
    user: sanitizeUser(user),
    ...tokens
  };
};

const refreshAuthToken = async ({ refreshToken }) => {
  if (!refreshToken) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Refresh token is required');
  }

  let decoded;

  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch (_error) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid or expired refresh token');
  }

  if (decoded.type !== 'refresh') {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid refresh token type');
  }

  const user = await User.findById(decoded.sub).select('+refreshTokenHash');
  if (!user || !user.isActive || !user.refreshTokenHash) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid refresh token');
  }

  const isRefreshTokenValid = await bcrypt.compare(refreshToken, user.refreshTokenHash);
  if (!isRefreshTokenValid) {
    throw new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid refresh token');
  }

  const tokens = await issueTokens(user);

  return {
    user: sanitizeUser(user),
    ...tokens
  };
};

const logout = async ({ refreshToken }) => {
  if (!refreshToken) {
    return;
  }

  try {
    const decoded = verifyRefreshToken(refreshToken);
    await User.findByIdAndUpdate(decoded.sub, { refreshTokenHash: null });
  } catch (_error) {
    // Ignore invalid refresh tokens to keep logout idempotent.
  }
};

module.exports = {
  register,
  login,
  refreshAuthToken,
  logout
};
