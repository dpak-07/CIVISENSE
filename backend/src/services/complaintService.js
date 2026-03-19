const { StatusCodes } = require('http-status-codes');
const mongoose = require('mongoose');
const Complaint = require('../models/Complaint');
const MunicipalOffice = require('../models/MunicipalOffice');
const Notification = require('../models/Notification');
const User = require('../models/User');
const UserMisuseReport = require('../models/UserMisuseReport');
const BlacklistedUser = require('../models/BlacklistedUser');
const ApiError = require('../utils/ApiError');
const { ROLES } = require('../constants/roles');
const { detectDuplicate } = require('./duplicateDetectionService');
const { autoRouteComplaint } = require('./geoRoutingService');
const { incrementWorkload, decrementWorkload } = require('./workloadService');
const { sendNotification, sendNotificationToOffice } = require('./notification.service');
const {
  COMPLAINT_STATUS,
  COMPLAINT_STATUS_VALUES,
  TERMINAL_STATUS,
  AI_PROCESSING_STATUS
} = require('../constants/complaint');

const MISUSE_REPORT_THRESHOLD = Math.max(Number(process.env.MISUSE_REPORT_THRESHOLD) || 3, 1);


const complaintPopulate = [
  { path: 'reportedBy', select: 'name email role isActive isBlacklisted misuseReportCount' },
  { path: 'assignedMunicipalOffice', select: 'name type zone workload maxCapacity isActive' },
  { path: 'duplicateInfo.masterComplaintId', select: 'title status category' },
  {
    path: 'statusHistory.updatedBy',
    select: 'name email role municipalOfficeId',
    populate: { path: 'municipalOfficeId', select: 'name type zone' }
  }
];

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

const buildAssignmentNotificationMessage = (assignedOfficeName) => {
  if (assignedOfficeName) {
    return `Your complaint has been assigned to municipal office: ${assignedOfficeName}.`;
  }

  return 'Your complaint has been assigned to a municipal office.';
};

const toStatusText = (status) =>
  String(status || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const buildOfficeAssignmentMessage = ({ complaintTitle, assignedOfficeName }) => {
  const officeText = assignedOfficeName ? ` to ${assignedOfficeName}` : ' to your office';
  return `A new complaint "${complaintTitle}" has been assigned${officeText}.`;
};

const buildOfficeStatusMessage = ({ complaintTitle, status }) =>
  `Complaint "${complaintTitle}" updated to ${toStatusText(status)}.`;

const resolveLocationPayload = ({ location, longitude, latitude }) => {
  if (location) {
    return location;
  }

  if (typeof longitude === 'undefined' || typeof latitude === 'undefined') {
    return null;
  }

  const lng = Number(longitude);
  const lat = Number(latitude);

  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    return null;
  }

  return {
    type: 'Point',
    coordinates: [lng, lat]
  };
};

const validateComplaintLocation = (location) => {
  if (
    !location ||
    location.type !== 'Point' ||
    !Array.isArray(location.coordinates) ||
    location.coordinates.length !== 2
  ) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Location must be a GeoJSON Point with [longitude, latitude] coordinates'
    );
  }

  const [lng, lat] = location.coordinates;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Location coordinates must be numeric values');
  }

  return [lng, lat];
};

const buildComplaintImages = (uploadedImageUrl) =>
  uploadedImageUrl
    ? [
        {
          url: uploadedImageUrl,
          uploadedAt: new Date()
        }
      ]
    : [];

const getComplaintOrThrow = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid complaint id');
  }

  const complaint = await Complaint.findById(id);
  if (!complaint) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Complaint not found');
  }

  return complaint;
};

const createComplaint = async (payload, reportedBy, options = {}) => {
  const { title, description, category, severityScore = 0, longitude, latitude } = payload;
  const location = resolveLocationPayload({ location: payload.location, longitude, latitude });
  const images = buildComplaintImages(options.uploadedImageUrl);

  if (!title || !description || !category || !location) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'title, description, category and location (or longitude + latitude) are required'
    );
  }

  const coordinates = validateComplaintLocation(location);

  const duplicateResult = await detectDuplicate({
    reportedBy,
    category,
    coordinates
  });

  if (duplicateResult.type === 'same_user_recent') {
    throw new ApiError(
      StatusCodes.CONFLICT,
      'Similar complaint already submitted by this user in the last 24 hours'
    );
  }

  if (duplicateResult.type === 'cross_user_duplicate') {
    const masterComplaint = duplicateResult.masterComplaint || duplicateResult.existingComplaint;

    const duplicateComplaint = await Complaint.create({
      title,
      description,
      category,
      images,
      location,
      status: masterComplaint.assignedMunicipalOffice
        ? COMPLAINT_STATUS.ASSIGNED
        : COMPLAINT_STATUS.UNASSIGNED,
      severityScore,
      priority: {
        score: 0,
        level: 'low',
        reason: null,
        aiProcessed: false,
        aiProcessingStatus: AI_PROCESSING_STATUS.PENDING
      },
      duplicateInfo: {
        isDuplicate: true,
        masterComplaintId: masterComplaint._id,
        duplicateCount: 0
      },
      assignedMunicipalOffice: masterComplaint.assignedMunicipalOffice || null,
      assignedOfficeType: masterComplaint.assignedOfficeType || null,
      routingDistanceMeters: masterComplaint.routingDistanceMeters || null,
      routingReason: `Duplicate linked to master complaint ${masterComplaint._id.toString()}`,
      reportedBy,
      statusHistory: [
        {
          status: masterComplaint.assignedMunicipalOffice
            ? COMPLAINT_STATUS.ASSIGNED
            : COMPLAINT_STATUS.UNASSIGNED,
          updatedBy: reportedBy,
          updatedByRole: ROLES.CITIZEN
        }
      ]
    });

    await Complaint.findByIdAndUpdate(masterComplaint._id, {
      $inc: { 'duplicateInfo.duplicateCount': 1 }
    });

    const created = await Complaint.findById(duplicateComplaint._id)
      .populate(complaintPopulate)
      .lean();

    if (duplicateComplaint.status === COMPLAINT_STATUS.ASSIGNED) {
      const assignedOfficeName = await resolveAssignedOfficeName(created?.assignedMunicipalOffice);
      await sendNotification(
        reportedBy,
        'Complaint assigned',
        buildAssignmentNotificationMessage(assignedOfficeName),
        duplicateComplaint._id
      );
      await sendNotificationToOffice({
        officeId: duplicateComplaint.assignedMunicipalOffice,
        title: 'New complaint assigned',
        message: buildOfficeAssignmentMessage({
          complaintTitle: duplicateComplaint.title,
          assignedOfficeName
        }),
        complaintId: duplicateComplaint._id
      });
    }

    return {
      complaint: created,
      duplicateDetected: true,
      masterComplaintId: masterComplaint._id
    };
  }

  const routing = await autoRouteComplaint({ coordinates });

  const complaint = await Complaint.create({
    title,
    description,
    category,
    images,
    location,
    status: routing.isAssigned ? COMPLAINT_STATUS.ASSIGNED : COMPLAINT_STATUS.UNASSIGNED,
    severityScore,
    priority: {
      score: 0,
      level: 'low',
      reason: null,
      aiProcessed: false,
      aiProcessingStatus: AI_PROCESSING_STATUS.PENDING
    },
    duplicateInfo: {
      isDuplicate: false,
      masterComplaintId: null,
      duplicateCount: 0
    },
    assignedMunicipalOffice: routing.officeId,
    assignedOfficeType: routing.officeType,
    routingDistanceMeters: routing.distanceMeters,
    routingReason: routing.reason,
    reportedBy,
    statusHistory: [
      {
        status: routing.isAssigned ? COMPLAINT_STATUS.ASSIGNED : COMPLAINT_STATUS.UNASSIGNED,
        updatedBy: reportedBy,
        updatedByRole: ROLES.CITIZEN
      }
    ]
  });

  if (routing.isAssigned && routing.officeId) {
    await incrementWorkload(routing.officeId);
  }

  const created = await Complaint.findById(complaint._id).populate(complaintPopulate).lean();

  if (routing.isAssigned) {
    const assignedOfficeName = await resolveAssignedOfficeName(created?.assignedMunicipalOffice);
    await sendNotification(
      reportedBy,
      'Complaint assigned',
      buildAssignmentNotificationMessage(assignedOfficeName),
      complaint._id
    );
    await sendNotificationToOffice({
      officeId: complaint.assignedMunicipalOffice,
      title: 'New complaint assigned',
      message: buildOfficeAssignmentMessage({
        complaintTitle: complaint.title,
        assignedOfficeName
      }),
      complaintId: complaint._id
    });
  }

  return {
    complaint: created,
    duplicateDetected: false,
    masterComplaintId: null
  };
};

const getComplaints = async (filters, requester = null) => {
  const query = {};
  const scope = String(filters.scope || '').toLowerCase();
  const allowAllScope = scope === 'all';

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.category) {
    query.category = filters.category;
  }

  if (filters.reportedBy) {
    query.reportedBy = filters.reportedBy;
  }

  if (typeof filters.isDuplicate !== 'undefined') {
    query['duplicateInfo.isDuplicate'] = filters.isDuplicate === 'true';
  }

  if (requester?.role === ROLES.CITIZEN && !query.reportedBy && !allowAllScope) {
    query.reportedBy = requester.id;
  }

  if (requester?.role === ROLES.OFFICER) {
    const officer = await User.findById(requester.id).select('municipalOfficeId').lean();
    if (!officer?.municipalOfficeId) {
      return [];
    }
    query.assignedMunicipalOffice = officer.municipalOfficeId;
  }

  return Complaint.find(query)
    .populate(complaintPopulate)
    .sort({ createdAt: -1 })
    .lean();
};

const getComplaintById = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid complaint id');
  }

  const complaint = await Complaint.findById(id).populate(complaintPopulate).lean();
  if (!complaint) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Complaint not found');
  }

  return complaint;
};

const toOptionalTrimmedText = (value) => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const buildStatusUpdateNotificationMessage = ({ status, remark, rejectionReason }) => {
  if (status === COMPLAINT_STATUS.RESOLVED) {
    return remark
      ? `Your complaint has been resolved. Remark: ${remark}`
      : 'Your complaint has been marked as resolved.';
  }

  if (status === COMPLAINT_STATUS.REJECTED) {
    return rejectionReason
      ? `Your complaint was rejected. Reason: ${rejectionReason}`
      : 'Your complaint has been rejected.';
  }

  if (remark) {
    return `Complaint status updated to ${status.replace(/_/g, ' ')}. Note: ${remark}`;
  }

  return `Complaint status updated to ${status.replace(/_/g, ' ')}.`;
};

const buildMisuseWarningMessage = ({ reportCount, threshold }) => {
  const remaining = Math.max(threshold - reportCount, 0);
  if (remaining <= 0) {
    return `Your account has been blacklisted after receiving ${reportCount} misuse reports.`;
  }

  const plural = remaining === 1 ? 'report' : 'reports';
  return `A misuse report was filed on your account. ${remaining} more ${plural} can result in blacklisting.`;
};

const updateComplaintStatus = async ({
  complaintId,
  status,
  remark,
  rejectionReason,
  updatedBy,
  updatedByRole
}) => {
  if (!COMPLAINT_STATUS_VALUES.includes(status)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid complaint status');
  }

  const complaint = await getComplaintOrThrow(complaintId);
  const previousStatus = complaint.status;
  const remarkText = toOptionalTrimmedText(remark);
  const rejectionReasonText = toOptionalTrimmedText(rejectionReason);

  if (status === COMPLAINT_STATUS.RESOLVED && !remarkText) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Resolution remark is required when resolving a complaint');
  }

  if (status === COMPLAINT_STATUS.REJECTED && !rejectionReasonText) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Rejection reason is required when rejecting a complaint');
  }

  complaint.status = status;
  complaint.resolutionRemark = status === COMPLAINT_STATUS.RESOLVED ? remarkText : null;
  complaint.rejectionReason = status === COMPLAINT_STATUS.REJECTED ? rejectionReasonText : null;
  complaint.statusHistory.push({
    status,
    remark: remarkText,
    rejectionReason: rejectionReasonText,
    updatedBy: updatedBy || null,
    updatedByRole: updatedByRole || null,
    updatedAt: new Date()
  });
  await complaint.save();

  const transitionedToTerminal =
    !TERMINAL_STATUS.includes(previousStatus) && TERMINAL_STATUS.includes(status);

  if (
    transitionedToTerminal &&
    complaint.assignedMunicipalOffice &&
    !complaint.duplicateInfo?.isDuplicate
  ) {
    await decrementWorkload(complaint.assignedMunicipalOffice);
  }

  if (status === COMPLAINT_STATUS.ASSIGNED) {
    const assignedOfficeName = await resolveAssignedOfficeName(complaint.assignedMunicipalOffice);
    await sendNotification(
      complaint.reportedBy,
      'Complaint assigned',
      buildAssignmentNotificationMessage(assignedOfficeName),
      complaint._id
    );
  }

  if (status === COMPLAINT_STATUS.RESOLVED) {
    await sendNotification(
      complaint.reportedBy,
      'Complaint resolved',
      buildStatusUpdateNotificationMessage({
        status,
        remark: remarkText,
        rejectionReason: rejectionReasonText
      }),
      complaint._id
    );
  }

  if (status === COMPLAINT_STATUS.REJECTED) {
    await sendNotification(
      complaint.reportedBy,
      'Complaint rejected',
      buildStatusUpdateNotificationMessage({
        status,
        remark: remarkText,
        rejectionReason: rejectionReasonText
      }),
      complaint._id
    );
  }

  if (![COMPLAINT_STATUS.ASSIGNED, COMPLAINT_STATUS.RESOLVED, COMPLAINT_STATUS.REJECTED].includes(status)) {
    await sendNotification(
      complaint.reportedBy,
      'Complaint status updated',
      buildStatusUpdateNotificationMessage({
        status,
        remark: remarkText,
        rejectionReason: rejectionReasonText
      }),
      complaint._id
    );
  }

  if (complaint.assignedMunicipalOffice) {
    const assignedOfficeName = await resolveAssignedOfficeName(complaint.assignedMunicipalOffice);
    const officeTitle =
      status === COMPLAINT_STATUS.ASSIGNED ? 'New complaint assigned' : 'Complaint updated';
    const officeMessage =
      status === COMPLAINT_STATUS.ASSIGNED
        ? buildOfficeAssignmentMessage({
          complaintTitle: complaint.title,
          assignedOfficeName
        })
        : buildOfficeStatusMessage({ complaintTitle: complaint.title, status });

    await sendNotificationToOffice({
      officeId: complaint.assignedMunicipalOffice,
      title: officeTitle,
      message: officeMessage,
      complaintId: complaint._id,
      excludeUserId: updatedBy || null
    });
  }

  return Complaint.findById(complaint._id).populate(complaintPopulate).lean();
};

const reportComplaintUserMisuse = async ({
  complaintId,
  reason,
  note,
  reportedBy,
  reportedByRole
}) => {
  const reasonText = toOptionalTrimmedText(reason);
  if (!reasonText) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Misuse report reason is required');
  }

  const noteText = toOptionalTrimmedText(note);
  const complaint = await getComplaintOrThrow(complaintId);

  if (!complaint.reportedBy) {
    throw new ApiError(StatusCodes.CONFLICT, 'Complaint does not have a valid reported user');
  }

  if (String(complaint.reportedBy) === String(reportedBy)) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'You cannot report your own account');
  }

  if (reportedByRole === ROLES.OFFICER) {
    const reviewer = await User.findById(reportedBy).select('municipalOfficeId role').lean();
    if (!reviewer || reviewer.role !== ROLES.OFFICER) {
      throw new ApiError(StatusCodes.FORBIDDEN, 'Only office officers can use this action');
    }

    if (
      !reviewer.municipalOfficeId ||
      !complaint.assignedMunicipalOffice ||
      String(reviewer.municipalOfficeId) !== String(complaint.assignedMunicipalOffice)
    ) {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        'You can report misuse only for complaints assigned to your office'
      );
    }
  }

  const reportedUser = await User.findById(complaint.reportedBy)
    .select('name email isBlacklisted misuseReportCount')
    .lean();
  if (!reportedUser) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Reported user not found');
  }

  if (reportedUser.isBlacklisted) {
    throw new ApiError(StatusCodes.CONFLICT, 'User is already blacklisted');
  }

  let createdReport;
  try {
    createdReport = await UserMisuseReport.create({
      complaintId: complaint._id,
      reportedUserId: reportedUser._id,
      reportedBy,
      reportedByRole,
      reason: reasonText,
      note: noteText
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw new ApiError(
        StatusCodes.CONFLICT,
        'You have already submitted a misuse report for this complaint'
      );
    }
    throw error;
  }

  const reportCount = await UserMisuseReport.countDocuments({
    reportedUserId: reportedUser._id
  });

  let blacklistTriggered = false;

  const userUpdate = {
    misuseReportCount: reportCount
  };

  if (reportCount >= MISUSE_REPORT_THRESHOLD) {
    blacklistTriggered = true;
    const blacklistReason = `Auto-blacklisted after ${reportCount} misuse reports.`;
    const blacklistedAt = new Date();
    userUpdate.isBlacklisted = true;
    userUpdate.blacklistedAt = blacklistedAt;
    userUpdate.blacklistReason = blacklistReason;
    userUpdate.isActive = false;

    await User.findByIdAndUpdate(reportedUser._id, { $set: userUpdate });

    await BlacklistedUser.findOneAndUpdate(
      { userId: reportedUser._id },
      {
        $set: {
          reason: blacklistReason,
          reportCount,
          threshold: MISUSE_REPORT_THRESHOLD,
          latestReportId: createdReport._id,
          source: 'misuse_report_threshold',
          createdBy: reportedBy || null,
          blacklistedAt,
          notifiedAt: blacklistedAt,
          isActive: true
        },
        $addToSet: {
          reportIds: createdReport._id
        }
      },
      { upsert: true, new: true, runValidators: true }
    );

    await sendNotification(
      reportedUser._id,
      'Account blacklisted',
      `Your account has been blacklisted after ${reportCount} misuse reports. Contact support for review.`,
      complaint._id
    );
  } else {
    await User.findByIdAndUpdate(reportedUser._id, { $set: userUpdate });
    await sendNotification(
      reportedUser._id,
      'Misuse warning',
      buildMisuseWarningMessage({
        reportCount,
        threshold: MISUSE_REPORT_THRESHOLD
      }),
      complaint._id
    );
  }

  return {
    complaintId: complaint._id.toString(),
    reportedUserId: reportedUser._id.toString(),
    reportCount,
    threshold: MISUSE_REPORT_THRESHOLD,
    blacklistTriggered,
    report: {
      id: createdReport._id.toString(),
      reason: createdReport.reason,
      note: createdReport.note,
      reportedBy: createdReport.reportedBy.toString(),
      reportedByRole: createdReport.reportedByRole,
      createdAt: createdReport.createdAt
    }
  };
};

const deleteComplaint = async ({ complaintId, requesterId, requesterRole }) => {
  const complaint = await getComplaintOrThrow(complaintId);

  const isAdmin = requesterRole === ROLES.ADMIN || requesterRole === ROLES.SUPER_ADMIN;
  if (!isAdmin && complaint.reportedBy.toString() !== requesterId) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'You can only delete your own complaint');
  }

  if (!complaint.duplicateInfo?.isDuplicate && (complaint.duplicateInfo?.duplicateCount || 0) > 0) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      'Cannot delete a master complaint while it has linked duplicates'
    );
  }

  if (
    complaint.assignedMunicipalOffice &&
    !complaint.duplicateInfo?.isDuplicate &&
    !TERMINAL_STATUS.includes(complaint.status)
  ) {
    await decrementWorkload(complaint.assignedMunicipalOffice);
  }

  if (complaint.duplicateInfo?.isDuplicate && complaint.duplicateInfo.masterComplaintId) {
    await Complaint.findByIdAndUpdate(complaint.duplicateInfo.masterComplaintId, {
      $inc: { 'duplicateInfo.duplicateCount': -1 }
    });
  }

  await Notification.deleteMany({ complaintId: complaint._id });
  await Complaint.findByIdAndDelete(complaint._id);

  return {
    deleted: true,
    complaintId: complaint._id.toString()
  };
};

module.exports = {
  createComplaint,
  getComplaints,
  getComplaintById,
  updateComplaintStatus,
  reportComplaintUserMisuse,
  deleteComplaint
};

