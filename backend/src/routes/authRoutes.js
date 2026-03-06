const express = require('express');
const authController = require('../controllers/authController');
const uploadProfilePhoto = require('../middlewares/uploadProfilePhoto.middleware');

const router = express.Router();

router.post('/register/request-otp', authController.requestRegisterOtp);
router.post('/register/verify-otp', uploadProfilePhoto, authController.registerWithOtp);
router.post('/register', uploadProfilePhoto, authController.register);
router.post('/login', authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', authController.logout);

module.exports = router;
