const express = require('express');
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middlewares/authMiddleware');
const allowRoles = require('../middlewares/roleMiddleware');
const uploadApkBuild = require('../middlewares/uploadApk.middleware');
const { ROLES } = require('../constants/roles');

const router = express.Router();

router.use(authMiddleware);
router.get(
  '/dashboard',
  allowRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  adminController.getDashboard
);
router.get('/dev-tools', allowRoles(ROLES.SUPER_ADMIN), adminController.getDevTools);
router.patch(
  '/dev-tools/app-config',
  allowRoles(ROLES.SUPER_ADMIN),
  adminController.updateAppConfig
);
router.post(
  '/dev-tools/app-config/upload-apk',
  allowRoles(ROLES.SUPER_ADMIN),
  uploadApkBuild,
  adminController.uploadDevAppApk
);
router.get('/dev-tools/developers', allowRoles(ROLES.SUPER_ADMIN), adminController.listDevDevelopers);
router.post('/dev-tools/developers', allowRoles(ROLES.SUPER_ADMIN), adminController.createDevDeveloper);
router.patch('/dev-tools/developers/:id', allowRoles(ROLES.SUPER_ADMIN), adminController.updateDevDeveloper);
router.delete('/dev-tools/developers/:id', allowRoles(ROLES.SUPER_ADMIN), adminController.deleteDevDeveloper);
router.patch(
  '/dev-tools/users/:id',
  allowRoles(ROLES.SUPER_ADMIN),
  adminController.updateDevUserCredentials
);
router.delete(
  '/dev-tools/users/:id',
  allowRoles(ROLES.SUPER_ADMIN),
  adminController.deleteDevUser
);

module.exports = router;
