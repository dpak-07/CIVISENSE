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

const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '');

const isValidLocation = (location) => {
  if (!location || typeof location !== 'object') {
    return false;
  }
  if (location.type !== 'Point' || !Array.isArray(location.coordinates) || location.coordinates.length !== 2) {
    return false;
  }
  return location.coordinates.every((coordinate) => typeof coordinate === 'number');
};

const normalizeSensitiveLocation = (raw) => {
  const name = normalizeText(raw.name);
  const type = normalizeText(raw.type || raw.category);
  const category = normalizeText(raw.category || raw.type);
  const location = raw.location && typeof raw.location === 'object' ? raw.location : null;

  return {
    name,
    type,
    category: category || type || null,
    priorityWeight: Number.isFinite(Number(raw.priorityWeight)) ? Number(raw.priorityWeight) : 1,
    description: normalizeText(raw.description) || null,
    location: {
      type: 'Point',
      coordinates: Array.isArray(location?.coordinates) ? location.coordinates.map(Number) : []
    },
    radiusMeters: Number.isFinite(Number(raw.radiusMeters)) ? Number(raw.radiusMeters) : 150,
    mapLink: normalizeText(raw.mapLink) || null,
    isActive: raw.isActive !== false,
    createdBy: null
  };
};

const validateSensitiveLocation = (document) => {
  if (!document.name) {
    throw new Error('Sensitive location entry must include a name');
  }
  if (!document.type) {
    throw new Error(`Sensitive location '${document.name}' must include a type or category`);
  }
  if (!isValidLocation(document.location)) {
    throw new Error(`Sensitive location '${document.name}' has invalid location`);
  }
  if (document.priorityWeight < 1 || document.priorityWeight > 10) {
    throw new Error(`Sensitive location '${document.name}' priorityWeight must be between 1 and 10`);
  }
  if (document.radiusMeters < 10) {
    throw new Error(`Sensitive location '${document.name}' radiusMeters must be at least 10`);
  }
};

const main = async () => {
  const mongoUri = resolveMongoUri();
  const dataFile = resolveFilePath('database/sensitive_locations_chennai.json');

  if (!fs.existsSync(dataFile)) {
    throw new Error(`Missing file: ${dataFile}`);
  }

  const records = readJsonArray(dataFile);
  await mongoose.connect(mongoUri);

  const SensitiveLocation = require('../src/models/SensitiveLocation');

  await SensitiveLocation.createIndexes();

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const raw of records) {
    if (!raw || typeof raw !== 'object') {
      throw new Error('Each sensitive location record must be an object');
    }

    const document = normalizeSensitiveLocation(raw);
    validateSensitiveLocation(document);

    const result = await SensitiveLocation.findOneAndUpdate(
      { name: document.name, type: document.type },
      { $set: document, $setOnInsert: { createdAt: new Date() } },
      { upsert: true, new: true, runValidators: true }
    ).lean();

    if (result) {
      if (result.createdAt && result.updatedAt && result.createdAt.getTime() === result.updatedAt.getTime()) {
        inserted += 1;
      } else {
        updated += 1;
      }
    } else {
      skipped += 1;
    }
  }

  console.log('Sensitive location seed completed');
  console.log(`Inserted: ${inserted}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
};

main()
  .catch((error) => {
    console.error('Seed sensitive locations failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close().catch(() => {});
  });
