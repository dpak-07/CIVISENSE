const { StatusCodes } = require('http-status-codes');
const ApiError = require('../utils/ApiError');

const validateRequest = (validator) => (req, _res, next) => {
  try {
    const result = validator(req);
    if (result?.message) {
      return next(new ApiError(StatusCodes.BAD_REQUEST, result.message));
    }
    return next();
  } catch (error) {
    return next(new ApiError(StatusCodes.BAD_REQUEST, error.message || 'Invalid request payload'));
  }
};

module.exports = validateRequest;
