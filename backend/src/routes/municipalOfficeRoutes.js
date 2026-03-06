const express = require('express');
const municipalOfficeController = require('../controllers/municipalOfficeController');
const authMiddleware = require('../middlewares/authMiddleware');
const allowRoles = require('../middlewares/roleMiddleware');
const { ROLES } = require('../constants/roles');

const router = express.Router();

router.use(authMiddleware);

router.post(
  '/',
  allowRoles(ROLES.SUPER_ADMIN),
  municipalOfficeController.createMunicipalOffice
);
router.get('/', municipalOfficeController.getMunicipalOffices);
router.patch(
  '/:id',
  allowRoles(ROLES.SUPER_ADMIN),
  municipalOfficeController.updateMunicipalOffice
);
router.delete(
  '/:id',
  allowRoles(ROLES.SUPER_ADMIN),
  municipalOfficeController.deleteMunicipalOffice
);

module.exports = router;
