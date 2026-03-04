const express = require('express');
const complaintController = require('../controllers/complaintController');
const authMiddleware = require('../middlewares/authMiddleware');
const allowRoles = require('../middlewares/roleMiddleware');
const uploadComplaintImage = require('../middlewares/upload.middleware');
const validateRequest = require('../middlewares/validateRequest');
const {
  validateCreateComplaint,
  validateUpdateComplaintStatus,
  validateComplaintQuery
} = require('../validators/complaintValidators');
const { ROLES } = require('../constants/roles');

const router = express.Router();

router.use(authMiddleware);

router.post('/', uploadComplaintImage, validateRequest(validateCreateComplaint), complaintController.createComplaint);
router.get('/', validateRequest(validateComplaintQuery), complaintController.getComplaints);
router.get('/:id', complaintController.getComplaintById);
router.delete('/:id', complaintController.deleteComplaint);
router.patch(
  '/:id/status',
  allowRoles(ROLES.OFFICER, ROLES.ADMIN, ROLES.SUPER_ADMIN),
  validateRequest(validateUpdateComplaintStatus),
  complaintController.updateComplaintStatus
);

module.exports = router;
