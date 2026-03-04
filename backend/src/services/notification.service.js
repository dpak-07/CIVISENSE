let admin = null;
const path = require('path');
try {
  // Optional dependency in environments where push delivery is enabled.
  // Notifications are still persisted even if this package is not installed.
  // eslint-disable-next-line global-require
  admin = require('firebase-admin');
} catch (_error) {
  admin = null;
}
const User = require('../models/User');
const Notification = require('../models/Notification');
const logger = require('../config/logger');

let firebaseInitialized = false;

const initFirebase = () => {
  if (firebaseInitialized) {
    return true;
  }

  if (!admin) {
    return false;
  }

  if (admin.apps.length > 0) {
    firebaseInitialized = true;
    return true;
  }

  try {
    const credentialJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const credentialPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

    if (credentialJson) {
      const parsed = JSON.parse(credentialJson);
      if (parsed.private_key) {
        parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
      }
      admin.initializeApp({
        credential: admin.credential.cert(parsed)
      });
      firebaseInitialized = true;
      logger.info('Firebase initialized using FIREBASE_SERVICE_ACCOUNT_JSON');
      return true;
    }

    if (credentialPath) {
      const resolvedCredentialPath = path.isAbsolute(credentialPath)
        ? credentialPath
        : path.resolve(process.cwd(), credentialPath);
      // eslint-disable-next-line global-require, import/no-dynamic-require
      const parsed = require(resolvedCredentialPath);
      if (parsed.private_key) {
        parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
      }
      admin.initializeApp({
        credential: admin.credential.cert(parsed)
      });
      firebaseInitialized = true;
      logger.info('Firebase initialized using FIREBASE_SERVICE_ACCOUNT_PATH');
      return true;
    }
  } catch (error) {
    logger.warn(`Failed to initialize Firebase Admin SDK: ${error.message}`);
  }

  return false;
};

const findExistingRecentNotification = async ({ userId, complaintId, title, message }) => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  return Notification.findOne({
    userId,
    complaintId: complaintId || null,
    title,
    message,
    createdAt: { $gte: oneHourAgo }
  }).lean();
};

const sendPushIfPossible = async ({ deviceToken, title, message, complaintId }) => {
  if (!deviceToken) {
    return { sent: false, reason: 'missing_device_token' };
  }

  if (!initFirebase()) {
    return { sent: false, reason: 'firebase_not_configured' };
  }

  try {
    await admin.messaging().send({
      token: deviceToken,
      notification: { title, body: message },
      data: complaintId
        ? {
            complaintId: String(complaintId)
          }
        : {}
    });
    return { sent: true, reason: null };
  } catch (error) {
    logger.warn(`FCM push failed for token ${deviceToken}: ${error.message}`);
    return { sent: false, reason: 'fcm_send_failed' };
  }
};

const sendNotification = async (userId, title, message, complaintId = null) => {
  if (!userId || !title || !message) {
    return { stored: false, pushSent: false, reason: 'missing_required_fields' };
  }

  const existing = await findExistingRecentNotification({ userId, complaintId, title, message });
  if (existing) {
    return { stored: false, pushSent: false, reason: 'duplicate_recent_notification' };
  }

  const [user, notification] = await Promise.all([
    User.findById(userId).select('deviceToken').lean(),
    Notification.create({
      userId,
      complaintId,
      title,
      message,
      read: false
    })
  ]);

  const pushResult = await sendPushIfPossible({
    deviceToken: user?.deviceToken || null,
    title,
    message,
    complaintId
  });

  return {
    stored: true,
    pushSent: pushResult.sent,
    reason: pushResult.reason,
    notificationId: notification._id
  };
};

const getUserNotifications = async (userId, options = {}) => {
  const pageRaw = Number(options.page);
  const pageSizeRaw = Number(options.pageSize);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const pageSizeCandidate = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? Math.floor(pageSizeRaw) : 20;
  const pageSize = Math.min(pageSizeCandidate, 100);
  const skip = (page - 1) * pageSize;

  const [items, total] = await Promise.all([
    Notification.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(pageSize).lean(),
    Notification.countDocuments({ userId })
  ]);

  return {
    items,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize)
    }
  };
};

const markNotificationRead = async ({ notificationId, userId }) =>
  Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { $set: { read: true } },
    { new: true }
  ).lean();

module.exports = {
  sendNotification,
  getUserNotifications,
  markNotificationRead,
  initFirebase
};
