const { StatusCodes } = require('http-status-codes');
const mongoose = require('mongoose');
const SensitiveLocation = require('../models/SensitiveLocation');
const ApiError = require('../utils/ApiError');
const {
  normalizeCoordinates,
  parseCoordinatesFromMapLink,
  buildGoogleMapsLink
} = require('../utils/mapLink');

const DEFAULT_PRIORITY_WEIGHT = 1;
const DEFAULT_RADIUS_METERS = 150;

const toTrimmedString = (value) => {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
};

const toOptionalTrimmedString = (value) => {
  const normalized = toTrimmedString(value);
  return normalized.length > 0 ? normalized : null;
};

const toNormalizedType = (payload, existing = null) => {
  const payloadType = toTrimmedString(payload.type || payload.category);
  if (payloadType) {
    return payloadType;
  }

  const existingType = toTrimmedString(existing?.type || existing?.category);
  return existingType || '';
};

const parseRadius = (value, fallback = DEFAULT_RADIUS_METERS) => {
  if (typeof value === 'undefined' || value === null || value === '') {
    return fallback;
  }

  const radius = Number(value);
  if (!Number.isFinite(radius) || radius < 10 || radius > 10000) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'radiusMeters must be between 10 and 10000'
    );
  }

  return radius;
};

const parsePriorityWeight = (value, fallback = DEFAULT_PRIORITY_WEIGHT) => {
  if (typeof value === 'undefined' || value === null || value === '') {
    return fallback;
  }

  const priorityWeight = Number(value);
  if (!Number.isInteger(priorityWeight) || priorityWeight < 1 || priorityWeight > 10) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'priorityWeight must be an integer between 1 and 10');
  }

  return priorityWeight;
};

const toSafePriorityWeight = (value) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10) {
    return DEFAULT_PRIORITY_WEIGHT;
  }
  return parsed;
};

const toSafeRadius = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 10 || parsed > 10000) {
    return DEFAULT_RADIUS_METERS;
  }
  return parsed;
};

const resolveCoordinatesFromPayload = (payload) => {
  if (
    payload.location &&
    payload.location.type === 'Point' &&
    Array.isArray(payload.location.coordinates) &&
    payload.location.coordinates.length === 2
  ) {
    return normalizeCoordinates({
      longitude: payload.location.coordinates[0],
      latitude: payload.location.coordinates[1]
    });
  }

  if (typeof payload.longitude !== 'undefined' || typeof payload.latitude !== 'undefined') {
    const normalized = normalizeCoordinates({
      longitude: payload.longitude,
      latitude: payload.latitude
    });

    if (!normalized) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Valid longitude and latitude are required');
    }

    return normalized;
  }

  const mapLink = toTrimmedString(payload.mapLink);
  if (mapLink) {
    const coordinates = parseCoordinatesFromMapLink(mapLink);
    if (!coordinates) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Google Maps link must include valid coordinates');
    }
    return coordinates;
  }

  return null;
};

const resolveLocationPayload = (payload, fallback = {}) => {
  const coordinates =
    resolveCoordinatesFromPayload(payload) ||
    normalizeCoordinates({
      longitude: fallback?.location?.coordinates?.[0],
      latitude: fallback?.location?.coordinates?.[1]
    });

  if (!coordinates) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Location coordinates are required');
  }

  const [longitude, latitude] = coordinates;
  const mapLink =
    toTrimmedString(payload.mapLink) ||
    toTrimmedString(fallback.mapLink) ||
    buildGoogleMapsLink({ longitude, latitude });

  return {
    location: {
      type: 'Point',
      coordinates
    },
    mapLink: mapLink || null
  };
};

const toResponseShape = (document) => {
  if (!document) {
    return document;
  }

  const type = toTrimmedString(document.type || document.category);
  return {
    ...document,
    type,
    category: type,
    priorityWeight: toSafePriorityWeight(document.priorityWeight),
    radiusMeters: toSafeRadius(document.radiusMeters),
    mapLink:
      toTrimmedString(document.mapLink) ||
      buildGoogleMapsLink({
        longitude: document.location?.coordinates?.[0],
        latitude: document.location?.coordinates?.[1]
      })
  };
};

const createSensitiveLocation = async (payload, createdBy) => {
  const name = toTrimmedString(payload.name);
  const type = toNormalizedType(payload);

  if (!name || !type) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'name and type are required');
  }

  const locationPayload = resolveLocationPayload(payload);
  const document = await SensitiveLocation.create({
    name,
    type,
    category: type,
    description: toOptionalTrimmedString(payload.description),
    location: locationPayload.location,
    mapLink: locationPayload.mapLink,
    priorityWeight: parsePriorityWeight(payload.priorityWeight, DEFAULT_PRIORITY_WEIGHT),
    radiusMeters: parseRadius(payload.radiusMeters, DEFAULT_RADIUS_METERS),
    isActive: typeof payload.isActive === 'boolean' ? payload.isActive : true,
    createdBy: createdBy || null
  });

  const created = await SensitiveLocation.findById(document._id)
    .populate('createdBy', 'name email role')
    .lean();

  return toResponseShape(created);
};

const getSensitiveLocations = async (filters = {}) => {
  const query = {};

  if (typeof filters.isActive !== 'undefined') {
    query.isActive = filters.isActive === 'true';
  }

  const type = toTrimmedString(filters.type || filters.category);
  if (type) {
    query.$or = [{ type }, { category: type }];
  }

  const search = toTrimmedString(filters.search);
  if (search) {
    query.$and = query.$and || [];
    query.$and.push({
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { type: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } }
      ]
    });
  }

  const locations = await SensitiveLocation.find(query)
    .populate('createdBy', 'name email role')
    .sort({ priorityWeight: -1, createdAt: -1 })
    .lean();

  return locations.map(toResponseShape);
};

const getPublicSensitiveLocations = async (filters = {}) => {
  const query = { isActive: true };

  const type = toTrimmedString(filters.type || filters.category);
  if (type) {
    query.$or = [{ type }, { category: type }];
  }

  const search = toTrimmedString(filters.search);
  if (search) {
    query.$and = query.$and || [];
    query.$and.push({
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { type: { $regex: search, $options: 'i' } }
      ]
    });
  }

  const limit = Number(filters.limit);
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(500, Math.floor(limit)) : 250;

  const locations = await SensitiveLocation.find(query)
    .select('name type category priorityWeight location mapLink radiusMeters updatedAt')
    .sort({ priorityWeight: -1, name: 1 })
    .limit(safeLimit)
    .lean();

  return locations.map(toResponseShape);
};

const updateSensitiveLocation = async (locationId, payload) => {
  if (!mongoose.Types.ObjectId.isValid(locationId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid sensitive location id');
  }

  const existing = await SensitiveLocation.findById(locationId).lean();
  if (!existing) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Sensitive location not found');
  }

  const update = {};

  if (typeof payload.name !== 'undefined') {
    const name = toTrimmedString(payload.name);
    if (!name) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'name cannot be empty');
    }
    update.name = name;
  }

  if (typeof payload.type !== 'undefined' || typeof payload.category !== 'undefined') {
    const type = toNormalizedType(payload, existing);
    if (!type) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'type cannot be empty');
    }
    update.type = type;
    update.category = type;
  }

  if (typeof payload.description !== 'undefined') {
    update.description = toOptionalTrimmedString(payload.description);
  }

  if (typeof payload.priorityWeight !== 'undefined') {
    update.priorityWeight = parsePriorityWeight(payload.priorityWeight, existing.priorityWeight);
  }

  if (typeof payload.radiusMeters !== 'undefined') {
    update.radiusMeters = parseRadius(payload.radiusMeters, existing.radiusMeters);
  }

  if (typeof payload.isActive === 'boolean') {
    update.isActive = payload.isActive;
  }

  const shouldUpdateLocation =
    typeof payload.mapLink !== 'undefined' ||
    typeof payload.longitude !== 'undefined' ||
    typeof payload.latitude !== 'undefined' ||
    typeof payload.location !== 'undefined';

  if (shouldUpdateLocation) {
    const locationPayload = resolveLocationPayload(payload, existing);
    update.location = locationPayload.location;
    update.mapLink = locationPayload.mapLink;
  }

  const updated = await SensitiveLocation.findByIdAndUpdate(locationId, update, {
    new: true,
    runValidators: true
  })
    .populate('createdBy', 'name email role')
    .lean();

  if (!updated) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Sensitive location not found');
  }

  return toResponseShape(updated);
};

const deleteSensitiveLocation = async (locationId) => {
  if (!mongoose.Types.ObjectId.isValid(locationId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid sensitive location id');
  }

  const deleted = await SensitiveLocation.findByIdAndDelete(locationId).lean();
  if (!deleted) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Sensitive location not found');
  }

  return {
    deleted: true,
    locationId
  };
};

module.exports = {
  createSensitiveLocation,
  getSensitiveLocations,
  getPublicSensitiveLocations,
  updateSensitiveLocation,
  deleteSensitiveLocation
};
