const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

const resolveFilePath = (relativePath) =>
  path.resolve(__dirname, '..', '..', relativePath);

const readJsonArray = (filePath) => {
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`${path.basename(filePath)} must contain a JSON array`);
  }
  return parsed;
};

const resolveMongoUri = () => {
  const candidates = [
    resolveFilePath('backend/.env'),
    resolveFilePath('database/.env'),
    resolveFilePath('.env')
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      dotenv.config({ path: candidate, override: false });
    }
  }

  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is required (set in backend/.env or database/.env)');
  }

  return process.env.MONGO_URI;
};

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value || '').trim());

const normalizeImages = (images, now) => {
  if (Array.isArray(images) && images.length > 0) {
    return images
      .filter((image) => typeof image === 'object' && image !== null)
      .map((image) => ({
        url: String(image.url || '').trim(),
        uploadedAt: image.uploadedAt ? new Date(image.uploadedAt) : now
      }))
      .filter((image) => image.url);
  }
  return [];
};

const normalizeComplaint = (raw, now) => {
  const title = String(raw.title || '').trim();
  const description = String(raw.description || '').trim();
  const category = String(raw.category || '').trim();

  const location = raw.location && typeof raw.location === 'object' ? raw.location : null;
  const coordinates = location?.coordinates;

  const images = normalizeImages(raw.images, now);

  const duplicateInfo = raw.duplicateInfo && typeof raw.duplicateInfo === 'object' ? raw.duplicateInfo : {};

  return {
    title,
    description,
    category,
    location: {
      type: 'Point',
      coordinates
    },
    status: 'reported',
    severityScore: 0,
    priority: {
      score: 0,
      level: 'low',
      reason: '',
      reasonSentence: null,
      aiProcessed: false,
      aiProcessingStatus: 'pending'
    },
    duplicateInfo: {
      isDuplicate: Boolean(duplicateInfo.isDuplicate),
      masterComplaintId: isValidObjectId(duplicateInfo.masterComplaintId)
        ? duplicateInfo.masterComplaintId
        : null,
      duplicateCount: Number(duplicateInfo.duplicateCount || 0)
    },
    assignedMunicipalOffice: isValidObjectId(raw.assignedMunicipalOffice)
      ? raw.assignedMunicipalOffice
      : null,
    assignedOfficeType: raw.assignedOfficeType || null,
    routingDistanceMeters:
      typeof raw.routingDistanceMeters === 'number' ? raw.routingDistanceMeters : null,
    routingReason: raw.routingReason || null,
    reportedBy: isValidObjectId(raw.reportedBy) ? raw.reportedBy : null,
    images: images.length > 0 ? images : [{ url: '', uploadedAt: now }],
    createdAt: raw.createdAt ? new Date(raw.createdAt) : now,
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : now
  };
};

const validateComplaint = (doc) => {
  if (!doc.title) {
    throw new Error('Complaint title cannot be empty');
  }
  if (!doc.description) {
    throw new Error(`Complaint '${doc.title}' has empty description`);
  }
  const allowedCategories = new Set(['pothole', 'garbage', 'drainage', 'streetlight', 'water_leak']);
  if (!allowedCategories.has(doc.category)) {
    throw new Error(`Complaint '${doc.title}' has invalid category: ${doc.category}`);
  }
  if (!doc.location || doc.location.type !== 'Point') {
    throw new Error(`Complaint '${doc.title}' has invalid GeoJSON type`);
  }
  const coordinates = doc.location.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length !== 2) {
    throw new Error(`Complaint '${doc.title}' coordinates must be [lng, lat]`);
  }
  const [lng, lat] = coordinates;
  if (typeof lng !== 'number' || typeof lat !== 'number') {
    throw new Error(`Complaint '${doc.title}' coordinates must be numeric`);
  }
  if (!doc.reportedBy) {
    throw new Error(`Complaint '${doc.title}' is missing reportedBy`);
  }
};

const main = async () => {
  const mongoUri = resolveMongoUri();
  const dataFile = resolveFilePath('database/complaints_test_chennai.json');

  if (!fs.existsSync(dataFile)) {
    throw new Error(`Missing file: ${dataFile}`);
  }

  const records = readJsonArray(dataFile);

  await mongoose.connect(mongoUri);

  const Complaint = require('../src/models/Complaint');

  let inserted = 0;
  let skipped = 0;

  for (const raw of records) {
    if (!raw || typeof raw !== 'object') {
      throw new Error('Each complaint record must be an object');
    }

    const now = new Date();
    const doc = normalizeComplaint(raw, now);
    validateComplaint(doc);

    const [lng, lat] = doc.location.coordinates;
    const duplicate = await Complaint.findOne(
      {
        title: doc.title,
        'location.type': 'Point',
        'location.coordinates': [lng, lat]
      },
      { _id: 1 }
    ).lean();

    if (duplicate) {
      skipped += 1;
      continue;
    }

    await Complaint.create(doc);
    inserted += 1;
  }

  console.log('Complaint test data import completed');
  console.log(`total inserted: ${inserted}`);
  console.log(`duplicates skipped: ${skipped}`);
};

main()
  .catch((error) => {
    console.error('Seed complaints failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close().catch(() => {});
  });
