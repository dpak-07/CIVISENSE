const { StatusCodes } = require('http-status-codes');
const mongoose = require('mongoose');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const notificationService = require('../services/notification.service');

const getNotifications = asyncHandler(async (req, res) => {
  const result = await notificationService.getUserNotifications(req.user.id, req.query);
  res.status(StatusCodes.OK).json({
    success: true,
    data: result.items,
    pagination: result.pagination
  });
});

const markAsRead = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid notification id');
  }

  const updated = await notificationService.markNotificationRead({
    notificationId: id,
    userId: req.user.id
  });

  if (!updated) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Notification not found');
  }

  res.status(StatusCodes.OK).json({ success: true, data: updated });
});

module.exports = {
  getNotifications,
  markAsRead
};
