const express = require('express');
const sensitiveLocationController = require('../controllers/sensitiveLocationController');
const authMiddleware = require('../middlewares/authMiddleware');
const allowRoles = require('../middlewares/roleMiddleware');
const uploadSpreadsheet = require('../middlewares/uploadSpreadsheet.middleware');
const { ROLES } = require('../constants/roles');

const router = express.Router();

router.use(authMiddleware);

router.get(
  '/',
  allowRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  sensitiveLocationController.getSensitiveLocations
);
router.post(
  '/import',
  allowRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  uploadSpreadsheet,
  sensitiveLocationController.importSensitiveLocations
);
router.get(
  '/import-template',
  allowRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  sensitiveLocationController.downloadSensitiveLocationTemplate
);
router.post(
  '/',
  allowRoles(ROLES.SUPER_ADMIN),
  sensitiveLocationController.createSensitiveLocation
);
router.patch(
  '/:id',
  allowRoles(ROLES.SUPER_ADMIN),
  sensitiveLocationController.updateSensitiveLocation
);
router.delete(
  '/:id',
  allowRoles(ROLES.SUPER_ADMIN),
  sensitiveLocationController.deleteSensitiveLocation
);

module.exports = router;
