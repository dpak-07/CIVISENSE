const mongoose = require('mongoose');
const Complaint = require('../models/Complaint');
const MunicipalOffice = require('../models/MunicipalOffice');
const logger = require('../config/logger');
const { sendNotification } = require('./notification.service');

let changeStream = null;
let pollingTimer = null;
let lastPolledAt = new Date(Date.now() - 60 * 1000);
const AI_PRIORITY_NOTIFICATION_WINDOW_MS = 2 * 60 * 1000;

const FLAG_REASONS = [
  'image does not match reported issue',
  'duplicate image detected',
  'user under review'
];

const parseDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
};

const isPriorityReady = (complaint) =>
  Boolean(
    complaint?.priority?.aiProcessed &&
      complaint?.priority?.aiProcessingStatus === 'done' &&
      complaint?.priority?.level
  );

const wasRecentlyProcessedByAi = (complaint) => {
  const updatedAt = parseDate(complaint?.updatedAt);
  const processedAt = parseDate(complaint?.aiMeta?.processedAt);

  if (!updatedAt || !processedAt) {
    return false;
  }

  const deltaMs = Math.abs(updatedAt.getTime() - processedAt.getTime());
  return deltaMs <= AI_PRIORITY_NOTIFICATION_WINDOW_MS;
};

const shorten = (value, max = 320) => {
  const text = String(value || '').trim();
  if (!text) {
    return '';
  }
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max - 3)}...`;
};

const buildPriorityTitle = (priorityLevel) => {
  const level = String(priorityLevel || 'low').trim().toLowerCase();
  return `Priority set to ${level.charAt(0).toUpperCase()}${level.slice(1)}`;
};

const resolveAssignedOfficeName = async (assignedMunicipalOffice) => {
  if (!assignedMunicipalOffice) {
    return null;
  }

  if (typeof assignedMunicipalOffice === 'object' && assignedMunicipalOffice.name) {
    return assignedMunicipalOffice.name;
  }

  if (!mongoose.Types.ObjectId.isValid(String(assignedMunicipalOffice))) {
    return null;
  }

  const office = await MunicipalOffice.findById(assignedMunicipalOffice).select('name').lean();
  return office?.name || null;
};

const buildPriorityMessage = ({ complaint, assignedOfficeName }) => {
  const reasonSentence = shorten(complaint?.priority?.reasonSentence, 380);
  const technicalReason = shorten(complaint?.priority?.reason, 420);

  const reasonParts = [];
  if (reasonSentence) {
    reasonParts.push(reasonSentence);
  }
  if (technicalReason && technicalReason !== reasonSentence) {
    reasonParts.push(`Details: ${technicalReason}`);
  }

  const reasonText =
    reasonParts.length > 0
      ? reasonParts.join(' ')
      : 'AI completed priority analysis for your complaint.';

  if (assignedOfficeName) {
    return `${reasonText} Assigned municipal office: ${assignedOfficeName}.`;
  }

  return `${reasonText} Municipal office assignment is pending.`;
};

const isFlaggedComplaint = (complaint) => {
  const reason = String(complaint?.priority?.reason || '').toLowerCase();
  if (FLAG_REASONS.some((keyword) => reason.includes(keyword))) {
    return true;
  }

  return Boolean(complaint?.aiMeta?.reviewRequired || complaint?.aiMeta?.isAIDuplicate);
};

const processComplaint = async (complaint) => {
  if (!complaint || !complaint.reportedBy) {
    return;
  }

  if (isPriorityReady(complaint) && wasRecentlyProcessedByAi(complaint)) {
    const assignedOfficeName = await resolveAssignedOfficeName(complaint.assignedMunicipalOffice);
    await sendNotification(
      complaint.reportedBy,
      buildPriorityTitle(complaint.priority?.level),
      buildPriorityMessage({ complaint, assignedOfficeName }),
      complaint._id
    );
  }

  if (isFlaggedComplaint(complaint)) {
    await sendNotification(
      complaint.reportedBy,
      'Complaint flagged',
      'Your complaint was flagged by AI for manual review.',
      complaint._id
    );
  }
};

const startPolling = () => {
  if (pollingTimer) {
    return;
  }

  pollingTimer = setInterval(async () => {
    const windowStart = lastPolledAt;
    lastPolledAt = new Date();
    try {
      const complaints = await Complaint.find({ updatedAt: { $gte: windowStart } })
        .select('_id reportedBy priority aiMeta assignedMunicipalOffice updatedAt')
        .sort({ updatedAt: 1 })
        .lean();

      for (const complaint of complaints) {
        // Best-effort dedupe is handled in notification service.
        // Polling fallback is used when replica set change streams are unavailable.
        await processComplaint(complaint);
      }
    } catch (error) {
      logger.warn(`AI notification polling error: ${error.message}`);
    }
  }, 30 * 1000);

  logger.info('AI complaint watcher started in polling mode');
};

const startChangeStream = async () => {
  changeStream = Complaint.watch(
    [{ $match: { operationType: { $in: ['insert', 'update', 'replace'] } } }],
    { fullDocument: 'updateLookup' }
  );

  changeStream.on('change', async (change) => {
    try {
      await processComplaint(change.fullDocument);
    } catch (error) {
      logger.warn(`AI complaint watcher change handling error: ${error.message}`);
    }
  });

  changeStream.on('error', (error) => {
    logger.warn(`AI complaint watcher stream error: ${error.message}`);
    stopComplaintAiWatcher();
    startPolling();
  });

  logger.info('AI complaint watcher started in change-stream mode');
};

const startComplaintAiWatcher = async () => {
  try {
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    if (!hello.setName) {
      startPolling();
      return;
    }

    await startChangeStream();
  } catch (error) {
    logger.warn(`AI complaint watcher initialization fallback to polling: ${error.message}`);
    startPolling();
  }
};

const stopComplaintAiWatcher = async () => {
  if (pollingTimer) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }

  if (changeStream) {
    try {
      await changeStream.close();
    } catch (_error) {
      // ignore on shutdown
    }
    changeStream = null;
  }
};

module.exports = {
  startComplaintAiWatcher,
  stopComplaintAiWatcher
};
