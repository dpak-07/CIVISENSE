const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

const validateRequestRegisterOtp = (req) => {
  if (!isNonEmptyString(req.body?.email)) {
    return { message: 'email is required' };
  }
  return null;
};

const validateRegister = (req) => {
  const { name, email, password } = req.body || {};
  if (!isNonEmptyString(name) || !isNonEmptyString(email) || !isNonEmptyString(password)) {
    return { message: 'name, email and password are required' };
  }

  if (String(password).length < 8) {
    return { message: 'password must be at least 8 characters' };
  }

  return null;
};

const validateRegisterWithOtp = (req) => {
  const registerValidation = validateRegister(req);
  if (registerValidation) {
    return registerValidation;
  }

  const { otp } = req.body || {};
  if (!/^\d{6}$/.test(String(otp || '').trim())) {
    return { message: 'otp must be 6 digits' };
  }

  return null;
};

const validateLogin = (req) => {
  const { email, password } = req.body || {};
  if (!isNonEmptyString(email) || !isNonEmptyString(password)) {
    return { message: 'email and password are required' };
  }
  return null;
};

const validateRefreshOrLogout = (req) => {
  const refreshToken = req.body?.refreshToken;
  if (typeof refreshToken !== 'undefined' && !isNonEmptyString(refreshToken)) {
    return { message: 'refreshToken must be a non-empty string when provided' };
  }
  return null;
};

module.exports = {
  validateRequestRegisterOtp,
  validateRegister,
  validateRegisterWithOtp,
  validateLogin,
  validateRefreshOrLogout
};
