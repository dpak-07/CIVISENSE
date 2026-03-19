const express = require('express');
const logsController = require('../controllers/logsController');
const authMiddleware = require('../middlewares/authMiddleware');
const allowRoles = require('../middlewares/roleMiddleware');
const { ROLES } = require('../constants/roles');

const router = express.Router();

router.get(
  '/overview',
  authMiddleware,
  allowRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  logsController.getOverview
);

router.get(
  '/recent',
  authMiddleware,
  allowRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  logsController.getRecent
);

router.get(
  '/ai/overview',
  authMiddleware,
  allowRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  logsController.getAiOverview
);

router.get(
  '/ai/recent',
  authMiddleware,
  allowRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  logsController.getAiRecent
);

router.post('/client', logsController.ingestClientLog);

module.exports = router;
