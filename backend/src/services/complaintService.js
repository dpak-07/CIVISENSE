const { StatusCodes } = require('http-status-codes');
const mongoose = require('mongoose');
const Complaint = require('../models/Complaint');
const MunicipalOffice = require('../models/MunicipalOffice');
const Notification = require('../models/Notification');
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


const complaintPopulate = [
  { path: 'reportedBy', select: 'name email role isActive' },
  { path: 'assignedMunicipalOffice', select: 'name type zone workload maxCapacity isActive' },
  { path: 'duplicateInfo.masterComplaintId', select: 'title status category' }
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
      reportedBy
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
    reportedBy
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
  }

  return {
    complaint: created,
    duplicateDetected: false,
    masterComplaintId: null
  };
};

const getComplaints = async (filters) => {
  const query = {};

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

const updateComplaintStatus = async ({ complaintId, status }) => {
  if (!COMPLAINT_STATUS_VALUES.includes(status)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid complaint status');
  }

  const complaint = await getComplaintOrThrow(complaintId);
  const previousStatus = complaint.status;

  complaint.status = status;
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
      'Your complaint has been marked as resolved.',
      complaint._id
    );
  }

  return Complaint.findById(complaint._id).populate(complaintPopulate).lean();
};

const deleteComplaint = async ({ complaintId, requesterId, requesterRole }) => {
  const complaint = await getComplaintOrThrow(complaintId);

  const isAdmin = requesterRole === ROLES.ADMIN;
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
  deleteComplaint
};

