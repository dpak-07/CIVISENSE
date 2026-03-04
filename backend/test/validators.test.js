const test = require('node:test');
const assert = require('node:assert/strict');
const {
  validateRegister,
  validateRegisterWithOtp,
  validateLogin
} = require('../src/validators/authValidators');
const {
  validateCreateComplaint,
  validateUpdateComplaintStatus
} = require('../src/validators/complaintValidators');

test('validateRegister accepts valid payload', () => {
  const req = {
    body: {
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123'
    }
  };

  assert.equal(validateRegister(req), null);
});

test('validateRegisterWithOtp rejects invalid OTP', () => {
  const req = {
    body: {
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
      otp: '12'
    }
  };

  const result = validateRegisterWithOtp(req);
  assert.equal(result.message, 'otp must be 6 digits');
});

test('validateLogin rejects missing password', () => {
  const req = {
    body: {
      email: 'test@example.com'
    }
  };

  const result = validateLogin(req);
  assert.equal(result.message, 'email and password are required');
});

test('validateCreateComplaint accepts coordinate payload', () => {
  const req = {
    body: {
      title: 'Pothole near school',
      description: 'Large pothole at junction',
      category: 'road_damage',
      city: 'Chennai',
      longitude: 80.2,
      latitude: 13.1
    }
  };

  assert.equal(validateCreateComplaint(req), null);
});

test('validateUpdateComplaintStatus rejects invalid status', () => {
  const req = {
    body: {
      status: 'invalid_status'
    }
  };

  const result = validateUpdateComplaintStatus(req);
  assert.equal(result.message, 'status is invalid');
});
