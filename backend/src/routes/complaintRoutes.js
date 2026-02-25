const express = require('express');
const complaintController = require('../controllers/complaintController');
const authMiddleware = require('../middlewares/authMiddleware');
const allowRoles = require('../middlewares/roleMiddleware');
const uploadComplaintImage = require('../middlewares/upload.middleware');
const { ROLES } = require('../constants/roles');

const router = express.Router();

router.use(authMiddleware);

router.post('/', uploadComplaintImage, complaintController.createComplaint);
router.get('/', complaintController.getComplaints);
router.get('/:id', complaintController.getComplaintById);
router.delete('/:id', complaintController.deleteComplaint);
router.patch(
  '/:id/status',
  allowRoles(ROLES.OFFICER, ROLES.ADMIN, ROLES.SUPER_ADMIN),
  complaintController.updateComplaintStatus
);

module.exports = router;
