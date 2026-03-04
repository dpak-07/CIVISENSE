const { StatusCodes } = require('http-status-codes');
const mongoose = require('mongoose');
const Complaint = require('../models/Complaint');
const MunicipalOffice = require('../models/MunicipalOffice');
const Notification = require('../models/Notification');
const SensitiveLocation = require('../models/SensitiveLocation');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const { ROLES } = require('../constants/roles');
const { detectDuplicate } = require('./duplicateDetectionService');
const { autoRouteComplaint } = require('./geoRoutingService');
const { incrementWorkload, decrementWorkload } = require('./workloadService');
const { sendNotification } = require('./notification.service');
const {
  COMPLAINT_STATUS,
  COMPLAINT_STATUS_VALUES,
  TERMINAL_STATUS,
  AI_PROCESSING_STATUS
} = require('../constants/complaint');

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
let isTransactionSupportedCache = null;

const complaintPopulate = [
  { path: 'reportedBy', select: 'name email role isActive' },
  { path: 'assignedMunicipalOffice', select: 'name type zone workload maxCapacity isActive' },
  {
    path: 'sensitiveLocation',
    select: 'name type category priorityWeight radiusMeters mapLink location'
  },
  { path: 'duplicateInfo.masterComplaintId', select: 'title status category' },
  {
    path: 'statusHistory.updatedBy',
    select: 'name email role municipalOfficeId',
    populate: { path: 'municipalOfficeId', select: 'name type zone' }
  }
];

const isAdminRole = (role) => role === ROLES.ADMIN || role === ROLES.SUPER_ADMIN;

const toObjectIdString = (value) => {
  if (!value) {
    return null;
  }
  if (typeof value === 'object' && value._id) {
    return String(value._id);
  }
  return String(value);
};

const resolvePagination = (filters = {}) => {
  const pageRaw = Number(filters.page);
  const pageSizeRaw = Number(filters.pageSize);

  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : DEFAULT_PAGE;
  const pageSizeCandidate =
    Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? Math.floor(pageSizeRaw) : DEFAULT_PAGE_SIZE;
  const pageSize = Math.min(pageSizeCandidate, MAX_PAGE_SIZE);
  const skip = (page - 1) * pageSize;

  return { page, pageSize, skip };
};

const isTransactionSupported = async () => {
  if (typeof isTransactionSupportedCache === 'boolean') {
    return isTransactionSupportedCache;
  }

  try {
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    isTransactionSupportedCache = Boolean(hello.setName);
  } catch (_error) {
    isTransactionSupportedCache = false;
  }

  return isTransactionSupportedCache;
};

const executeWithOptionalTransaction = async (operation) => {
  if (!(await isTransactionSupported())) {
    return operation(null);
  }

  const session = await mongoose.startSession();
  try {
    let operationResult = null;
    await session.withTransaction(async () => {
      operationResult = await operation(session);
    });
    return operationResult;
  } finally {
    await session.endSession();
  }
};

const ensureComplaintReadAccess = (complaint, requester, officerMunicipalOfficeId = null) => {
  if (!requester) {
    return;
  }

  if (isAdminRole(requester.role)) {
    return;
  }

  if (requester.role === ROLES.CITIZEN) {
    if (toObjectIdString(complaint.reportedBy) !== String(requester.id)) {
      throw new ApiError(StatusCodes.FORBIDDEN, 'You do not have access to this complaint');
    }
    return;
  }

  if (requester.role === ROLES.OFFICER) {
    if (!officerMunicipalOfficeId) {
      throw new ApiError(StatusCodes.FORBIDDEN, 'Officer is not linked to a municipal office');
    }

    if (toObjectIdString(complaint.assignedMunicipalOffice) !== String(officerMunicipalOfficeId)) {
      throw new ApiError(StatusCodes.FORBIDDEN, 'You do not have access to this complaint');
    }
  }
};

const ensureComplaintStatusUpdateAccess = (
  complaint,
  requesterRole,
  requesterOfficeId = null
) => {
  if (isAdminRole(requesterRole)) {
    return;
  }

  if (requesterRole !== ROLES.OFFICER) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Insufficient permissions to update complaint status');
  }

  if (!requesterOfficeId) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'Officer is not linked to a municipal office');
  }

  if (toObjectIdString(complaint.assignedMunicipalOffice) !== String(requesterOfficeId)) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      'Officers can only update complaints assigned to their municipal office'
    );
  }
};

const getOfficerMunicipalOfficeId = async (officerId) => {
  const officer = await User.findById(officerId).select('municipalOfficeId').lean();
  return officer?.municipalOfficeId ? String(officer.municipalOfficeId) : null;
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

const buildAssignmentNotificationMessage = (assignedOfficeName) => {
  if (assignedOfficeName) {
    return `Your complaint has been assigned to municipal office: ${assignedOfficeName}.`;
  }

  return 'Your complaint has been assigned to a municipal office.';
};

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

const resolveSensitiveLocationReference = async (value) => {
  const normalized =
    typeof value === 'string' ? value.trim() : value ? String(value).trim() : '';

  if (!normalized) {
    return null;
  }

  if (!mongoose.Types.ObjectId.isValid(normalized)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid sensitiveLocationId');
  }

  const location = await SensitiveLocation.findById(normalized).select('_id').lean();
  if (!location) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Sensitive location not found');
  }

  return location._id;
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

const getComplaintOrThrow = async (id, options = {}) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid complaint id');
  }

  const complaint = await Complaint.findById(id).session(options.session || null);
  if (!complaint) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Complaint not found');
  }

  return complaint;
};

const createComplaint = async (payload, reportedBy, options = {}) => {
  const { title, description, category, severityScore = 0, longitude, latitude } = payload;
  const location = resolveLocationPayload({ location: payload.location, longitude, latitude });
  const city = typeof payload.city === 'string' ? payload.city.trim() : '';
  const normalizedCity = city || null;
  const sensitiveLocation = await resolveSensitiveLocationReference(payload.sensitiveLocationId);
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
    const duplicateComplaintId = await executeWithOptionalTransaction(async (session) => {
      let createdId = null;
      const createOptions = session ? { session } : {};

      const [duplicateComplaint] = await Complaint.create(
        [
          {
            title,
            description,
            category,
            images,
            location,
            city: normalizedCity,
            sensitiveLocation,
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
          }
        ],
        createOptions
      );
      createdId = duplicateComplaint._id;

      await Complaint.findByIdAndUpdate(
        masterComplaint._id,
        { $inc: { 'duplicateInfo.duplicateCount': 1 } },
        createOptions
      );

      return createdId;
    });

    const created = await Complaint.findById(duplicateComplaintId).populate(complaintPopulate).lean();

    if (created?.status === COMPLAINT_STATUS.ASSIGNED) {
      const assignedOfficeName = await resolveAssignedOfficeName(created.assignedMunicipalOffice);
      await sendNotification(
        reportedBy,
        'Complaint assigned',
        buildAssignmentNotificationMessage(assignedOfficeName),
        duplicateComplaintId
      );
    }

    return {
      complaint: created,
      duplicateDetected: true,
      masterComplaintId: masterComplaint._id
    };
  }

  const routing = await autoRouteComplaint({ coordinates });
  const complaintId = await executeWithOptionalTransaction(async (session) => {
    const createOptions = session ? { session } : {};

    const [complaint] = await Complaint.create(
      [
        {
          title,
          description,
          category,
          images,
          location,
          city: normalizedCity,
          sensitiveLocation,
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
        }
      ],
      createOptions
    );

    if (routing.isAssigned && routing.officeId) {
      await incrementWorkload(routing.officeId, { session });
    }

    return complaint._id;
  });

  const created = await Complaint.findById(complaintId).populate(complaintPopulate).lean();

  if (routing.isAssigned) {
    const assignedOfficeName = await resolveAssignedOfficeName(created?.assignedMunicipalOffice);
    await sendNotification(
      reportedBy,
      'Complaint assigned',
      buildAssignmentNotificationMessage(assignedOfficeName),
      complaintId
    );
  }

  return {
    complaint: created,
    duplicateDetected: false,
    masterComplaintId: null
  };
};

const getComplaints = async (filters, requester = null) => {
  const query = {};
  const { page, pageSize, skip } = resolvePagination(filters);

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.category) {
    query.category = filters.category;
  }

  if (filters.city) {
    query.city = filters.city;
  }

  if (filters.reportedBy) {
    query.reportedBy = filters.reportedBy;
  }

  if (typeof filters.isDuplicate !== 'undefined') {
    query['duplicateInfo.isDuplicate'] = filters.isDuplicate === 'true';
  }

  if (requester?.role === ROLES.CITIZEN) {
    query.reportedBy = requester.id;
  }

  if (requester?.role === ROLES.OFFICER) {
    const officerMunicipalOfficeId = await getOfficerMunicipalOfficeId(requester.id);
    if (!officerMunicipalOfficeId) {
      return {
        items: [],
        pagination: {
          page,
          pageSize,
          total: 0,
          totalPages: 0
        }
      };
    }
    query.assignedMunicipalOffice = officerMunicipalOfficeId;
  }

  const [items, total] = await Promise.all([
    Complaint.find(query)
      .populate(complaintPopulate)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),
    Complaint.countDocuments(query)
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

const getComplaintById = async (id, requester = null) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid complaint id');
  }

  const complaint = await Complaint.findById(id).populate(complaintPopulate).lean();
  if (!complaint) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Complaint not found');
  }

  let officerMunicipalOfficeId = null;
  if (requester?.role === ROLES.OFFICER) {
    officerMunicipalOfficeId = await getOfficerMunicipalOfficeId(requester.id);
  }

  ensureComplaintReadAccess(complaint, requester, officerMunicipalOfficeId);

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

  const requesterOfficeId =
    updatedByRole === ROLES.OFFICER ? await getOfficerMunicipalOfficeId(updatedBy) : null;
  let complaintSnapshot = null;
  let remarkText = null;
  let rejectionReasonText = null;
  complaintSnapshot = await executeWithOptionalTransaction(async (session) => {
    const complaint = await getComplaintOrThrow(complaintId, { session });
    ensureComplaintStatusUpdateAccess(complaint, updatedByRole, requesterOfficeId);

    const previousStatus = complaint.status;
    remarkText = toOptionalTrimmedText(remark);
    rejectionReasonText = toOptionalTrimmedText(rejectionReason);

    if (status === COMPLAINT_STATUS.RESOLVED && !remarkText) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        'Resolution remark is required when resolving a complaint'
      );
    }

    if (status === COMPLAINT_STATUS.REJECTED && !rejectionReasonText) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        'Rejection reason is required when rejecting a complaint'
      );
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
    if (session) {
      await complaint.save({ session });
    } else {
      await complaint.save();
    }

    const transitionedToTerminal =
      !TERMINAL_STATUS.includes(previousStatus) && TERMINAL_STATUS.includes(status);

    if (
      transitionedToTerminal &&
      complaint.assignedMunicipalOffice &&
      !complaint.duplicateInfo?.isDuplicate
    ) {
      await decrementWorkload(complaint.assignedMunicipalOffice, { session });
    }

    return {
      _id: complaint._id,
      reportedBy: complaint.reportedBy,
      assignedMunicipalOffice: complaint.assignedMunicipalOffice
    };
  });

  if (!complaintSnapshot) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Complaint not found');
  }

  if (status === COMPLAINT_STATUS.ASSIGNED) {
    const assignedOfficeName = await resolveAssignedOfficeName(complaintSnapshot.assignedMunicipalOffice);
    await sendNotification(
      complaintSnapshot.reportedBy,
      'Complaint assigned',
      buildAssignmentNotificationMessage(assignedOfficeName),
      complaintSnapshot._id
    );
  }

  if (status === COMPLAINT_STATUS.RESOLVED) {
    await sendNotification(
      complaintSnapshot.reportedBy,
      'Complaint resolved',
      buildStatusUpdateNotificationMessage({
        status,
        remark: remarkText,
        rejectionReason: rejectionReasonText
      }),
      complaintSnapshot._id
    );
  }

  if (status === COMPLAINT_STATUS.REJECTED) {
    await sendNotification(
      complaintSnapshot.reportedBy,
      'Complaint rejected',
      buildStatusUpdateNotificationMessage({
        status,
        remark: remarkText,
        rejectionReason: rejectionReasonText
      }),
      complaintSnapshot._id
    );
  }

  if (![COMPLAINT_STATUS.ASSIGNED, COMPLAINT_STATUS.RESOLVED, COMPLAINT_STATUS.REJECTED].includes(status)) {
    await sendNotification(
      complaintSnapshot.reportedBy,
      'Complaint status updated',
      buildStatusUpdateNotificationMessage({
        status,
        remark: remarkText,
        rejectionReason: rejectionReasonText
      }),
      complaintSnapshot._id
    );
  }

  return Complaint.findById(complaintSnapshot._id).populate(complaintPopulate).lean();
};

const deleteComplaint = async ({ complaintId, requesterId, requesterRole }) => {
  const complaint = await getComplaintOrThrow(complaintId);

  const isAdmin = isAdminRole(requesterRole);
  if (!isAdmin && complaint.reportedBy.toString() !== requesterId) {
    throw new ApiError(StatusCodes.FORBIDDEN, 'You can only delete your own complaint');
  }

  if (!complaint.duplicateInfo?.isDuplicate && (complaint.duplicateInfo?.duplicateCount || 0) > 0) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      'Cannot delete a master complaint while it has linked duplicates'
    );
  }

  await executeWithOptionalTransaction(async (session) => {
      const queryWithSession = (query) => (session ? query.session(session) : query);

      if (
        complaint.assignedMunicipalOffice &&
        !complaint.duplicateInfo?.isDuplicate &&
        !TERMINAL_STATUS.includes(complaint.status)
      ) {
        await decrementWorkload(complaint.assignedMunicipalOffice, { session });
      }

      if (complaint.duplicateInfo?.isDuplicate && complaint.duplicateInfo.masterComplaintId) {
        await Complaint.findByIdAndUpdate(
          complaint.duplicateInfo.masterComplaintId,
          { $inc: { 'duplicateInfo.duplicateCount': -1 } },
          session ? { session } : {}
        );
      }

      await queryWithSession(Notification.deleteMany({ complaintId: complaint._id }));
      await queryWithSession(Complaint.findByIdAndDelete(complaint._id));
    });

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
  deleteComplaint
};
