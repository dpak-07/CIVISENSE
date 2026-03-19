const Complaint = require('../models/Complaint');
const User = require('../models/User');
const logger = require('../config/logger');
const { sendNotification, sendNotificationToOffice, sendNotificationToUsers } = require('./notification.service');
const { COMPLAINT_STATUS, TERMINAL_STATUS } = require('../constants/complaint');
const { ROLES } = require('../constants/roles');

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const ESCALATION_INTERVAL_MS = Number(process.env.PRIORITY_ESCALATE_INTERVAL_MS)
  || 30 * 60 * 1000;

const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const UNPROCESSED_THRESHOLDS = [
  {
    days: toNumber(process.env.PRIORITY_ESCALATE_UNPROCESSED_DAY1, 1),
    level: 'medium',
    stage: 'unprocessed_1d',
    scoreBoost: 10
  },
  {
    days: toNumber(process.env.PRIORITY_ESCALATE_UNPROCESSED_DAY2, 2),
    level: 'high',
    stage: 'unprocessed_2d',
    scoreBoost: 20
  }
];

const IN_PROGRESS_THRESHOLDS = [
  {
    days: toNumber(process.env.PRIORITY_ESCALATE_INPROGRESS_DAY1, 3),
    level: 'high',
    stage: 'in_progress_3d',
    scoreBoost: 20
  },
  {
    days: toNumber(process.env.PRIORITY_ESCALATE_INPROGRESS_DAY2, 5),
    level: 'critical',
    stage: 'in_progress_5d',
    scoreBoost: 30
  }
];

const PRIORITY_ORDER = ['low', 'medium', 'high', 'critical'];

let escalationTimer = null;
let isRunning = false;

const getPriorityRank = (level) => {
  const index = PRIORITY_ORDER.indexOf(String(level || 'low').toLowerCase());
  return index >= 0 ? index : 0;
};

const diffDays = (from, to) => Math.floor((from.getTime() - to.getTime()) / MS_PER_DAY);

const getStatusSince = (complaint, status) => {
  const history = Array.isArray(complaint.statusHistory) ? complaint.statusHistory : [];
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const entry = history[index];
    if (entry?.status === status && entry?.updatedAt) {
      return new Date(entry.updatedAt);
    }
  }
  return null;
};

const pickThreshold = (thresholds, daysOpen) => {
  let selected = null;
  thresholds.forEach((threshold) => {
    if (daysOpen >= threshold.days) {
      selected = threshold;
    }
  });
  return selected;
};

const buildEscalationMessage = ({ complaint, level, type, daysOpen }) => {
  const title = complaint?.title ? `"${complaint.title}"` : 'A complaint';
  if (type === 'in_progress') {
    return `${title} has been in progress for ${daysOpen} day(s) without resolution. Priority auto-escalated to ${level}.`;
  }
  return `${title} has not been marked in progress for ${daysOpen} day(s). Priority auto-escalated to ${level}.`;
};

const notifyAdmins = async ({ complaintId, message }) => {
  const admins = await User.find({
    role: { $in: [ROLES.ADMIN, ROLES.SUPER_ADMIN] },
    isActive: true
  })
    .select('_id')
    .lean();

  const adminIds = admins.map((admin) => admin._id);
  if (adminIds.length === 0) {
    return;
  }

  await sendNotificationToUsers({
    userIds: adminIds,
    title: 'Complaint priority escalated',
    message,
    complaintId
  });
};

const processComplaint = async (complaint, now) => {
  if (!complaint || TERMINAL_STATUS.includes(complaint.status)) {
    return null;
  }

  const isInProgress = complaint.status === COMPLAINT_STATUS.IN_PROGRESS;
  const since = isInProgress
    ? getStatusSince(complaint, COMPLAINT_STATUS.IN_PROGRESS) || complaint.updatedAt || complaint.createdAt
    : complaint.createdAt;

  if (!since) {
    return null;
  }

  const daysOpen = diffDays(now, new Date(since));
  if (daysOpen <= 0) {
    return null;
  }

  const thresholds = isInProgress ? IN_PROGRESS_THRESHOLDS : UNPROCESSED_THRESHOLDS;
  const target = pickThreshold(thresholds, daysOpen);
  if (!target) {
    return null;
  }

  const currentLevel = String(complaint.priority?.level || 'low').toLowerCase();
  if (getPriorityRank(currentLevel) >= getPriorityRank(target.level)) {
    return null;
  }

  const currentStage = complaint.priority?.escalation?.stage;
  if (currentStage === target.stage) {
    return null;
  }

  const currentScore = Number(complaint.priority?.score || 0);
  const nextScore = currentScore + (target.scoreBoost || 0);
  const reasonText = isInProgress
    ? `Auto-escalated after ${daysOpen} day(s) in progress without resolution.`
    : `Auto-escalated after ${daysOpen} day(s) without being marked in progress.`;

  const message = buildEscalationMessage({
    complaint,
    level: target.level,
    type: isInProgress ? 'in_progress' : 'unprocessed',
    daysOpen
  });

  const update = {
    'priority.level': target.level,
    'priority.score': nextScore,
    'priority.escalation.stage': target.stage,
    'priority.escalation.lastEscalatedAt': now,
    'priority.escalation.reason': reasonText
  };

  if (!complaint.priority?.reasonSentence) {
    update['priority.reasonSentence'] = reasonText;
  }

  if (!complaint.priority?.reason) {
    update['priority.reason'] = 'auto_escalation';
  }

  await Complaint.updateOne({ _id: complaint._id }, { $set: update });

  if (complaint.reportedBy) {
    await sendNotification(
      complaint.reportedBy,
      'Complaint priority escalated',
      message,
      complaint._id
    );
  }

  if (complaint.assignedMunicipalOffice) {
    await sendNotificationToOffice({
      officeId: complaint.assignedMunicipalOffice,
      title: 'Complaint priority escalated',
      message,
      complaintId: complaint._id
    });
  }

  await notifyAdmins({ complaintId: complaint._id, message });

  return target.stage;
};

const runEscalation = async () => {
  if (isRunning) {
    return;
  }
  isRunning = true;

  const now = new Date();
  const minUnprocessed = Math.min(...UNPROCESSED_THRESHOLDS.map((t) => t.days));
  const minInProgress = Math.min(...IN_PROGRESS_THRESHOLDS.map((t) => t.days));
  const oldestUnprocessed = new Date(now.getTime() - minUnprocessed * MS_PER_DAY);
  const oldestInProgress = new Date(now.getTime() - minInProgress * MS_PER_DAY);

  try {
    const candidates = await Complaint.find({
      status: { $nin: TERMINAL_STATUS },
      $or: [
        { status: COMPLAINT_STATUS.IN_PROGRESS, updatedAt: { $lte: oldestInProgress } },
        { status: { $ne: COMPLAINT_STATUS.IN_PROGRESS }, createdAt: { $lte: oldestUnprocessed } }
      ]
    })
      .select('_id title status createdAt updatedAt priority statusHistory reportedBy assignedMunicipalOffice')
      .lean();

    let escalatedCount = 0;
    for (const complaint of candidates) {
      // eslint-disable-next-line no-await-in-loop
      const result = await processComplaint(complaint, now);
      if (result) {
        escalatedCount += 1;
      }
    }

    if (escalatedCount > 0) {
      logger.info(`Priority escalation applied to ${escalatedCount} complaint(s).`);
    }
  } catch (error) {
    logger.warn(`Priority escalation error: ${error.message}`);
  } finally {
    isRunning = false;
  }
};

const startComplaintPriorityEscalation = () => {
  if (escalationTimer) {
    return;
  }

  escalationTimer = setInterval(() => {
    runEscalation().catch((error) => {
      logger.warn(`Priority escalation interval error: ${error.message}`);
    });
  }, ESCALATION_INTERVAL_MS);

  logger.info('Complaint priority escalation scheduler started');
  runEscalation().catch((error) => {
    logger.warn(`Priority escalation initial run error: ${error.message}`);
  });
};

const stopComplaintPriorityEscalation = async () => {
  if (escalationTimer) {
    clearInterval(escalationTimer);
    escalationTimer = null;
  }
};

module.exports = {
  startComplaintPriorityEscalation,
  stopComplaintPriorityEscalation,
  runEscalation
};
