const express = require('express');
const authController = require('../controllers/authController');
const uploadProfilePhoto = require('../middlewares/uploadProfilePhoto.middleware');
const validateRequest = require('../middlewares/validateRequest');
const {
  validateRequestRegisterOtp,
  validateRegister,
  validateRegisterWithOtp,
  validateLogin,
  validateRefreshOrLogout
} = require('../validators/authValidators');

const router = express.Router();

router.post('/register/request-otp', validateRequest(validateRequestRegisterOtp), authController.requestRegisterOtp);
router.post(
  '/register/verify-otp',
  uploadProfilePhoto,
  validateRequest(validateRegisterWithOtp),
  authController.registerWithOtp
);
router.post('/register', uploadProfilePhoto, validateRequest(validateRegister), authController.register);
router.post('/login', validateRequest(validateLogin), authController.login);
router.post('/refresh', validateRequest(validateRefreshOrLogout), authController.refresh);
router.post('/logout', validateRequest(validateRefreshOrLogout), authController.logout);

module.exports = router;
