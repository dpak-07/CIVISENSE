const { StatusCodes } = require('http-status-codes');
const asyncHandler = require('../utils/asyncHandler');
const complaintService = require('../services/complaintService');

const createComplaint = asyncHandler(async (req, res) => {
  const result = await complaintService.createComplaint(req.body, req.user.id, {
    uploadedImageUrl: req.uploadedImageUrl || null
  });
  res.status(StatusCodes.CREATED).json({
    success: true,
    message: result.duplicateDetected ? 'Complaint recorded as duplicate' : 'Complaint created',
    data: result
  });
});

const getComplaints = asyncHandler(async (req, res) => {
  const complaints = await complaintService.getComplaints(req.query, req.user);
  res.status(StatusCodes.OK).json({ success: true, data: complaints });
});

const getComplaintById = asyncHandler(async (req, res) => {
  const complaint = await complaintService.getComplaintById(req.params.id);
  res.status(StatusCodes.OK).json({ success: true, data: complaint });
});

const updateComplaintStatus = asyncHandler(async (req, res) => {
  const complaint = await complaintService.updateComplaintStatus({
    complaintId: req.params.id,
    status: req.body.status,
    remark: req.body.remark,
    rejectionReason: req.body.rejectionReason,
    updatedBy: req.user.id,
    updatedByRole: req.user.role
  });

  res.status(StatusCodes.OK).json({ success: true, data: complaint });
});

const reportComplaintUserMisuse = asyncHandler(async (req, res) => {
  const result = await complaintService.reportComplaintUserMisuse({
    complaintId: req.params.id,
    reason: req.body?.reason,
    note: req.body?.note,
    reportedBy: req.user.id,
    reportedByRole: req.user.role
  });

  res.status(StatusCodes.CREATED).json({
    success: true,
    message: result.blacklistTriggered
      ? 'User reported and blacklisted after threshold'
      : 'User misuse report submitted',
    data: result
  });
});

const deleteComplaint = asyncHandler(async (req, res) => {
  const result = await complaintService.deleteComplaint({
    complaintId: req.params.id,
    requesterId: req.user.id,
    requesterRole: req.user.role
  });

  res.status(StatusCodes.OK).json({
    success: true,
    message: 'Complaint deleted',
    data: result
  });
});

module.exports = {
  createComplaint,
  getComplaints,
  getComplaintById,
  updateComplaintStatus,
  reportComplaintUserMisuse,
  deleteComplaint
};
