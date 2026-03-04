const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { StatusCodes } = require('http-status-codes');
const User = require('../models/User');
const EmailOtp = require('../models/EmailOtp');
const ApiError = require('../utils/ApiError');
const { sendOtpEmail } = require('./emailService');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken
} = require('../utils/jwt');

const SALT_ROUNDS = 12;
const OTP_LENGTH = 6;
const OTP_EXPIRES_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_COOLDOWN_SECONDS = 60;

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const isValidOtp = (otp) => /^[0-9]{6}$/.test(String(otp || '').trim());

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

  const cleanEmail = normalizeEmail(email);

  const existingUser = await User.findOne({ email: cleanEmail }).lean();
  if (existingUser) {
    throw new ApiError(StatusCodes.CONFLICT, 'Email already registered');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const createdUser = await User.create({
    name,
    email: cleanEmail,
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

const requestRegisterOtp = async ({ email }) => {
  const cleanEmail = normalizeEmail(email);

  if (!cleanEmail) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Email is required');
  }

  const existingUser = await User.findOne({ email: cleanEmail }).lean();
  if (existingUser) {
    throw new ApiError(StatusCodes.CONFLICT, 'Email already registered');
  }

  const latestOtp = await EmailOtp.findOne({ email: cleanEmail }).sort({ createdAt: -1 }).lean();
  if (latestOtp?.createdAt) {
    const secondsSinceLastOtp = Math.floor((Date.now() - new Date(latestOtp.createdAt).getTime()) / 1000);
    if (secondsSinceLastOtp < OTP_RESEND_COOLDOWN_SECONDS) {
      throw new ApiError(
        StatusCodes.TOO_MANY_REQUESTS,
        `Please wait ${OTP_RESEND_COOLDOWN_SECONDS - secondsSinceLastOtp}s before requesting another OTP`
      );
    }
  }

  const otp = String(crypto.randomInt(10 ** (OTP_LENGTH - 1), 10 ** OTP_LENGTH));
  const otpHash = await bcrypt.hash(otp, SALT_ROUNDS);
  const expiresAt = new Date(Date.now() + OTP_EXPIRES_MINUTES * 60 * 1000);

  await EmailOtp.deleteMany({ email: cleanEmail });

  await EmailOtp.create({
    email: cleanEmail,
    otpHash,
    expiresAt
  });

  await sendOtpEmail({ email: cleanEmail, otp, expiresInMinutes: OTP_EXPIRES_MINUTES });

  return { delivered: true, expiresInMinutes: OTP_EXPIRES_MINUTES };
};

const registerWithOtp = async ({ name, email, password, otp, profilePhotoUrl }) => {
  const cleanEmail = normalizeEmail(email);

  if (!name || !cleanEmail || !password || !otp) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Name, email, password and OTP are required'
    );
  }

  if (!isValidOtp(otp)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'OTP must be 6 digits');
  }

  const otpRecord = await EmailOtp.findOne({ email: cleanEmail })
    .select('+otpHash')
    .sort({ createdAt: -1 });

  if (!otpRecord) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'OTP not found or expired');
  }

  if (otpRecord.expiresAt < new Date()) {
    await EmailOtp.deleteMany({ email: cleanEmail });
    throw new ApiError(StatusCodes.BAD_REQUEST, 'OTP not found or expired');
  }

  if (otpRecord.attempts >= OTP_MAX_ATTEMPTS) {
    await EmailOtp.deleteMany({ email: cleanEmail });
    throw new ApiError(StatusCodes.TOO_MANY_REQUESTS, 'OTP attempts exceeded');
  }

  const isMatch = await bcrypt.compare(String(otp), otpRecord.otpHash);
  if (!isMatch) {
    otpRecord.attempts += 1;
    await otpRecord.save();
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid OTP');
  }

  await EmailOtp.deleteMany({ email: cleanEmail });

  return register({ name, email: cleanEmail, password, profilePhotoUrl });
};

const login = async ({ email, password }) => {
  if (!email || !password) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Email and password are required');
  }

  const user = await User.findOne({ email: normalizeEmail(email) }).select(
    '+passwordHash +refreshTokenHash'
  );
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
  requestRegisterOtp,
  registerWithOtp,
  login,
  refreshAuthToken,
  logout
};
