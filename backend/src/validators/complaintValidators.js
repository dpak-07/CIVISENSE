const { COMPLAINT_STATUS_VALUES } = require('../constants/complaint');

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

const parseNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const validateCreateComplaint = (req) => {
  const {
    title,
    description,
    category,
    city,
    sensitiveLocationId,
    location,
    longitude,
    latitude,
    severityScore
  } = req.body || {};

  if (!isNonEmptyString(title) || !isNonEmptyString(description) || !isNonEmptyString(category)) {
    return { message: 'title, description and category are required' };
  }

  if (typeof city !== 'undefined' && city !== null && !String(city).trim()) {
    return { message: 'city cannot be empty when provided' };
  }

  if (typeof sensitiveLocationId !== 'undefined' && sensitiveLocationId !== null && !String(sensitiveLocationId).trim()) {
    return { message: 'sensitiveLocationId cannot be empty when provided' };
  }

  if (typeof severityScore !== 'undefined' && parseNumber(severityScore) === null) {
    return { message: 'severityScore must be numeric' };
  }

  const hasGeoJson =
    location &&
    location.type === 'Point' &&
    Array.isArray(location.coordinates) &&
    location.coordinates.length === 2;

  const lng = parseNumber(longitude);
  const lat = parseNumber(latitude);
  const hasCoords = lng !== null && lat !== null;

  if (!hasGeoJson && !hasCoords) {
    return { message: 'location (GeoJSON Point) or longitude+latitude is required' };
  }

  return null;
};

const validateUpdateComplaintStatus = (req) => {
  const { status, remark, rejectionReason } = req.body || {};
  if (!isNonEmptyString(status)) {
    return { message: 'status is required' };
  }
  if (!COMPLAINT_STATUS_VALUES.includes(status)) {
    return { message: 'status is invalid' };
  }

  if (typeof remark !== 'undefined' && typeof remark !== 'string') {
    return { message: 'remark must be a string' };
  }

  if (typeof rejectionReason !== 'undefined' && typeof rejectionReason !== 'string') {
    return { message: 'rejectionReason must be a string' };
  }

  return null;
};

const validateComplaintQuery = (req) => {
  const pageRaw = req.query?.page;
  const pageSizeRaw = req.query?.pageSize;

  if (typeof pageRaw !== 'undefined') {
    const page = Number(pageRaw);
    if (!Number.isFinite(page) || page <= 0) {
      return { message: 'page must be a positive number' };
    }
    req.query.page = String(Math.floor(page));
  }

  if (typeof pageSizeRaw !== 'undefined') {
    const pageSize = Number(pageSizeRaw);
    if (!Number.isFinite(pageSize) || pageSize <= 0) {
      return { message: 'pageSize must be a positive number' };
    }
    req.query.pageSize = String(Math.floor(pageSize));
  }

  return null;
};

module.exports = {
  validateCreateComplaint,
  validateUpdateComplaintStatus,
  validateComplaintQuery
};
