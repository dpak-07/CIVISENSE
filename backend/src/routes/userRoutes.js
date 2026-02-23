const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const uploadProfilePhoto = require('../middlewares/uploadProfilePhoto.middleware');
const userController = require('../controllers/userController');

const router = express.Router();

router.use(authMiddleware);

router.post('/profile-photo', uploadProfilePhoto, userController.updateProfilePhoto);
router.delete('/profile-photo', userController.removeProfilePhoto);
router.patch('/preferences/language', userController.updateLanguagePreference);
router.delete('/account', userController.deleteAccount);

module.exports = router;
