const { StatusCodes } = require('http-status-codes');
const ApiError = require('../utils/ApiError');
const { verifyAccessToken } = require('../utils/jwt');
const User = require('../models/User');

const authMiddleware = async (req, _res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new ApiError(StatusCodes.UNAUTHORIZED, 'Authorization token is required'));
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verifyAccessToken(token);

    const user = await User.findById(payload.sub)
      .select('role isActive isBlacklisted blacklistReason')
      .lean();

    if (!user) {
      return next(new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid or expired access token'));
    }

    if (!user.isActive) {
      return next(new ApiError(StatusCodes.FORBIDDEN, 'User account is inactive'));
    }

    if (user.isBlacklisted) {
      return next(
        new ApiError(
          StatusCodes.FORBIDDEN,
          user.blacklistReason || 'User account is blacklisted due to misuse reports'
        )
      );
    }

    req.user = {
      id: payload.sub,
      role: user.role
    };

    return next();
  } catch (_error) {
    return next(new ApiError(StatusCodes.UNAUTHORIZED, 'Invalid or expired access token'));
  }
};

module.exports = authMiddleware;
