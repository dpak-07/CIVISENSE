const { StatusCodes } = require('http-status-codes');
const logger = require('../config/logger');

const notFoundHandler = (req, _res, next) => {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  error.statusCode = StatusCodes.NOT_FOUND;
  next(error);
};

const normalizeError = (err) => {
  if (err.name === 'ValidationError') {
    return {
      statusCode: StatusCodes.BAD_REQUEST,
      message: 'Validation failed',
      details: Object.values(err.errors).map((item) => item.message)
    };
  }

  if (err.name === 'CastError') {
    return {
      statusCode: StatusCodes.BAD_REQUEST,
      message: `Invalid value for ${err.path}`
    };
  }

  if (err.code === 11000) {
    return {
      statusCode: StatusCodes.CONFLICT,
      message: 'Duplicate value violates unique constraint',
      details: err.keyValue || null
    };
  }

  if (err.message === 'CORS origin denied') {
    return {
      statusCode: StatusCodes.FORBIDDEN,
      message: 'Request origin is not allowed by CORS policy'
    };
  }

  return {
    statusCode: err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR,
    message: err.message || 'Internal server error',
    details: err.details || null
  };
};

const errorHandler = (err, _req, res, _next) => {
  const normalized = normalizeError(err);
  const statusCode = normalized.statusCode;

  if (statusCode >= 500) {
    logger.error({ message: normalized.message, stack: err.stack });
  } else {
    logger.warn({ message: normalized.message, details: normalized.details });
  }

  res.status(statusCode).json({
    success: false,
    message: normalized.message,
    ...(normalized.details ? { details: normalized.details } : {})
  });
};

module.exports = {
  notFoundHandler,
  errorHandler
};
