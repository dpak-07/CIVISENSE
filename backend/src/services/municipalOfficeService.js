const bcrypt = require('bcryptjs');
const { StatusCodes } = require('http-status-codes');
const mongoose = require('mongoose');
const MunicipalOffice = require('../models/MunicipalOffice');
const User = require('../models/User');
const Complaint = require('../models/Complaint');
const ApiError = require('../utils/ApiError');
const { buildGoogleMapsLink, normalizeCoordinates, parseCoordinatesFromMapLink } = require('../utils/mapLink');
const { ROLES } = require('../constants/roles');

const SALT_ROUNDS = 12;

const buildLocationPayload = (payload, fallback = {}) => {
  const directCoordinates =
    typeof payload.longitude !== 'undefined' || typeof payload.latitude !== 'undefined'
      ? normalizeCoordinates({
          longitude: payload.longitude,
          latitude: payload.latitude
        })
      : null;

  if (
    (typeof payload.longitude !== 'undefined' || typeof payload.latitude !== 'undefined') &&
    !directCoordinates
  ) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Valid longitude and latitude are required');
  }

  const mapLinkFromPayload =
    typeof payload.mapLink === 'string' ? payload.mapLink.trim() : '';
  const mapCoordinates = mapLinkFromPayload ? parseCoordinatesFromMapLink(mapLinkFromPayload) : null;

  if (mapLinkFromPayload && !mapCoordinates) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Google Maps link must include valid coordinates');
  }

  let coordinates = null;
  if (
    payload.location &&
    payload.location.type === 'Point' &&
    Array.isArray(payload.location.coordinates) &&
    payload.location.coordinates.length === 2
  ) {
    coordinates = normalizeCoordinates({
      longitude: payload.location.coordinates[0],
      latitude: payload.location.coordinates[1]
    });
  }

  if (!coordinates) {
    coordinates = directCoordinates || mapCoordinates || fallback.coordinates || null;
  }

  if (!coordinates) {
    return null;
  }

  const [longitude, latitude] = coordinates;
  return {
    location: {
      type: 'Point',
      coordinates
    },
    mapLink:
      mapLinkFromPayload ||
      fallback.mapLink ||
      buildGoogleMapsLink({ longitude, latitude })
  };
};

const buildLocation = (payload, fallback = {}) => {
  if (
    payload.location &&
    payload.location.type === 'Point' &&
    Array.isArray(payload.location.coordinates) &&
    payload.location.coordinates.length === 2
  ) {
    const built = buildLocationPayload(payload, fallback);
    return built;
  }

  return buildLocationPayload(payload, fallback);
};

const sanitizeOfficer = (officer) => {
  if (!officer) return null;
  return {
    id: officer._id,
    name: officer.name,
    email: officer.email,
    isActive: officer.isActive
  };
};

const attachOfficerAccounts = async (offices) => {
  if (!Array.isArray(offices) || offices.length === 0) {
    return offices;
  }

  const officeIds = offices.map((office) => office._id);
  const officers = await User.find({
    role: ROLES.OFFICER,
    municipalOfficeId: { $in: officeIds }
  })
    .select('name email isActive municipalOfficeId')
    .sort({ updatedAt: -1 })
    .lean();

  const officerMap = new Map();
  officers.forEach((officer) => {
    const officeId = String(officer.municipalOfficeId || '');
    if (!officeId || officerMap.has(officeId)) {
      return;
    }
    officerMap.set(officeId, officer);
  });

  return offices.map((office) => ({
    ...office,
    officerAccount: sanitizeOfficer(officerMap.get(String(office._id)) || null)
  }));
};

const normalizeOfficerPayload = (payload, officeName) => {
  const officerName = String(payload.officerName || '').trim() || `${officeName} Officer`;
  const officerEmail = String(payload.officerEmail || '')
    .trim()
    .toLowerCase();
  const officerPassword = String(payload.officerPassword || '');
  const officerIsActive = typeof payload.officerIsActive === 'undefined' ? true : Boolean(payload.officerIsActive);

  return {
    officerName,
    officerEmail,
    officerPassword,
    officerIsActive
  };
};

const ensureOfficerEmailAvailable = async ({ email, excludeUserId = null }) => {
  const query = { email };
  if (excludeUserId) {
    query._id = { $ne: excludeUserId };
  }

  const existing = await User.findOne(query).lean();
  if (existing) {
    throw new ApiError(StatusCodes.CONFLICT, 'Officer email is already in use');
  }
};

const createMunicipalOffice = async (payload) => {
  const { name, type, zone } = payload;
  const locationPayload = buildLocation(payload);
  const maxCapacity = Number(payload.maxCapacity);

  if (!name || !type || !zone || !locationPayload || !Number.isFinite(maxCapacity) || maxCapacity < 1) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'name, type, zone, mapLink/coordinates and maxCapacity are required'
    );
  }

  const officerPayload = normalizeOfficerPayload(payload, name);
  if (!officerPayload.officerEmail || officerPayload.officerPassword.length < 4) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'officerEmail and officerPassword (minimum 4 characters) are required'
    );
  }

  await ensureOfficerEmailAvailable({ email: officerPayload.officerEmail });

  const office = await MunicipalOffice.create({
    name,
    type,
    zone,
    location: locationPayload.location,
    mapLink: locationPayload.mapLink,
    maxCapacity
  });

  try {
    const passwordHash = await bcrypt.hash(officerPayload.officerPassword, SALT_ROUNDS);
    await User.create({
      name: officerPayload.officerName,
      email: officerPayload.officerEmail,
      passwordHash,
      role: ROLES.OFFICER,
      isActive: officerPayload.officerIsActive,
      municipalOfficeId: office._id
    });
  } catch (error) {
    await MunicipalOffice.findByIdAndDelete(office._id);
    throw error;
  }

  const [withOfficer] = await attachOfficerAccounts([office.toObject()]);
  return withOfficer;
};

const getMunicipalOffices = async (filters) => {
  const query = {};

  if (typeof filters.isActive !== 'undefined') {
    query.isActive = filters.isActive === 'true';
  }

  if (filters.type) {
    query.type = filters.type;
  }

  if (filters.zone) {
    query.zone = filters.zone;
  }

  const offices = await MunicipalOffice.find(query).sort({ createdAt: -1 }).lean();
  return attachOfficerAccounts(offices);
};

const updateOfficerAccount = async ({ officeId, payload, officeName }) => {
  const hasOfficerUpdates =
    typeof payload.officerName !== 'undefined' ||
    typeof payload.officerEmail !== 'undefined' ||
    typeof payload.officerPassword !== 'undefined' ||
    typeof payload.officerIsActive !== 'undefined';

  if (!hasOfficerUpdates) {
    return null;
  }

  const currentOfficer = await User.findOne({
    role: ROLES.OFFICER,
    municipalOfficeId: officeId
  });

  const normalized = normalizeOfficerPayload(payload, officeName);
  const nextEmail = normalized.officerEmail || currentOfficer?.email || '';

  if (!nextEmail) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'officerEmail is required to update officer account');
  }

  await ensureOfficerEmailAvailable({
    email: nextEmail,
    excludeUserId: currentOfficer?._id || null
  });

  if (!currentOfficer && normalized.officerPassword.length < 4) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'officerPassword (minimum 4 characters) is required when creating officer account'
    );
  }

  const update = {
    name: normalized.officerName,
    email: nextEmail,
    isActive: normalized.officerIsActive,
    municipalOfficeId: officeId,
    role: ROLES.OFFICER
  };

  if (normalized.officerPassword) {
    if (normalized.officerPassword.length < 4) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'officerPassword must be at least 4 characters');
    }
    update.passwordHash = await bcrypt.hash(normalized.officerPassword, SALT_ROUNDS);
  }

  if (currentOfficer) {
    await User.findByIdAndUpdate(currentOfficer._id, { $set: update }, { runValidators: true });
    return currentOfficer._id;
  }

  const placeholderPasswordHash = update.passwordHash;
  delete update.passwordHash;

  const created = await User.create({
    ...update,
    passwordHash: placeholderPasswordHash
  });

  return created._id;
};

const updateMunicipalOffice = async (officeId, payload) => {
  if (!mongoose.Types.ObjectId.isValid(officeId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid municipal office id');
  }

  const update = { ...payload };

  const existingOffice = await MunicipalOffice.findById(officeId).lean();
  if (!existingOffice) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Municipal office not found');
  }

  const shouldUpdateLocation =
    typeof payload.mapLink !== 'undefined' ||
    typeof payload.longitude !== 'undefined' ||
    typeof payload.latitude !== 'undefined' ||
    typeof payload.location !== 'undefined';

  if (shouldUpdateLocation) {
    const locationPayload = buildLocation(payload, {
      coordinates: existingOffice.location?.coordinates || null,
      mapLink: existingOffice.mapLink || null
    });

    if (!locationPayload) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Unable to resolve office location');
    }

    update.location = locationPayload.location;
    update.mapLink = locationPayload.mapLink;
  }

  if (typeof update.maxCapacity !== 'undefined') {
    const parsedMax = Number(update.maxCapacity);
    if (!Number.isFinite(parsedMax) || parsedMax < 1) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'maxCapacity must be at least 1');
    }
    update.maxCapacity = parsedMax;
  }

  delete update.longitude;
  delete update.latitude;
  delete update.officerName;
  delete update.officerEmail;
  delete update.officerPassword;
  delete update.officerIsActive;

  const office = await MunicipalOffice.findByIdAndUpdate(officeId, update, {
    new: true,
    runValidators: true
  }).lean();

  await updateOfficerAccount({
    officeId: office._id,
    payload,
    officeName: office.name
  });

  const [withOfficer] = await attachOfficerAccounts([office]);
  return withOfficer;
};

const deleteMunicipalOffice = async (officeId) => {
  if (!mongoose.Types.ObjectId.isValid(officeId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Invalid municipal office id');
  }

  const office = await MunicipalOffice.findById(officeId).lean();
  if (!office) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Municipal office not found');
  }

  const assignedComplaintCount = await Complaint.countDocuments({
    assignedMunicipalOffice: officeId
  });

  if (assignedComplaintCount > 0) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      'Cannot delete office with linked complaints. Reassign complaints first.'
    );
  }

  await Promise.all([
    User.deleteMany({ role: ROLES.OFFICER, municipalOfficeId: officeId }),
    MunicipalOffice.findByIdAndDelete(officeId)
  ]);

  return {
    deleted: true,
    officeId: officeId.toString()
  };
};

module.exports = {
  createMunicipalOffice,
  getMunicipalOffices,
  updateMunicipalOffice,
  deleteMunicipalOffice
};
