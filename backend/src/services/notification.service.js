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
const { ROLES } = require('../constants/roles');

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

const sendNotificationToUsers = async ({
  userIds = [],
  title,
  message,
  complaintId = null,
  excludeUserId = null
} = {}) => {
  if (!Array.isArray(userIds) || !title || !message) {
    return { total: 0, stored: 0, pushSent: 0, reason: 'invalid_payload' };
  }

  const uniqueIds = Array.from(
    new Set(userIds.map((id) => String(id)).filter(Boolean))
  );

  if (excludeUserId) {
    const excludeId = String(excludeUserId);
    const index = uniqueIds.indexOf(excludeId);
    if (index >= 0) uniqueIds.splice(index, 1);
  }

  if (uniqueIds.length === 0) {
    return { total: 0, stored: 0, pushSent: 0, reason: 'no_targets' };
  }

  const results = await Promise.allSettled(
    uniqueIds.map((id) => sendNotification(id, title, message, complaintId))
  );

  let stored = 0;
  let pushSent = 0;

  results.forEach((result) => {
    if (result.status === 'fulfilled') {
      if (result.value?.stored) stored += 1;
      if (result.value?.pushSent) pushSent += 1;
    }
  });

  return { total: uniqueIds.length, stored, pushSent };
};

const sendNotificationToOffice = async ({
  officeId,
  title,
  message,
  complaintId = null,
  excludeUserId = null
} = {}) => {
  if (!officeId) {
    return { total: 0, stored: 0, pushSent: 0, reason: 'missing_office' };
  }

  const officers = await User.find({
    role: ROLES.OFFICER,
    municipalOfficeId: officeId,
    isActive: true
  })
    .select('_id')
    .lean();

  const officerIds = officers.map((officer) => officer._id);
  return sendNotificationToUsers({ userIds: officerIds, title, message, complaintId, excludeUserId });
};

const getUserNotifications = async (userId) =>
  Notification.find({ userId }).sort({ createdAt: -1 }).lean();

const markNotificationRead = async ({ notificationId, userId }) =>
  Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { $set: { read: true } },
    { new: true }
  ).lean();

module.exports = {
  sendNotification,
  sendNotificationToUsers,
  sendNotificationToOffice,
  getUserNotifications,
  markNotificationRead,
  initFirebase
};
