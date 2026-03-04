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
  const result = await complaintService.getComplaints(req.query, req.user);
  res.status(StatusCodes.OK).json({
    success: true,
    data: result.items,
    pagination: result.pagination
  });
});

const getComplaintById = asyncHandler(async (req, res) => {
  const complaint = await complaintService.getComplaintById(req.params.id, req.user);
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
  deleteComplaint
};
