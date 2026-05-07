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

const normalizeMunicipalOffice = (raw) => {
  const name = normalizeText(raw.name);
  const type = normalizeText(raw.type);
  const zone = normalizeText(raw.zone);
  const location = raw.location && typeof raw.location === 'object' ? raw.location : null;

  return {
    name,
    type,
    zone,
    location: {
      type: 'Point',
      coordinates: Array.isArray(location?.coordinates) ? location.coordinates.map(Number) : []
    },
    mapLink: normalizeText(raw.mapLink) || null,
    workload: Number.isFinite(Number(raw.workload)) ? Number(raw.workload) : 0,
    maxCapacity: Number.isFinite(Number(raw.maxCapacity)) ? Number(raw.maxCapacity) : 200,
    isActive: raw.isActive !== false
  };
};

const validateMunicipalOffice = (document) => {
  if (!document.name) {
    throw new Error('Municipal office entry must include a name');
  }
  if (!document.type) {
    throw new Error(`Municipal office '${document.name}' must include a type`);
  }
  if (!document.zone) {
    throw new Error(`Municipal office '${document.name}' must include a zone`);
  }
  if (!isValidLocation(document.location)) {
    throw new Error(`Municipal office '${document.name}' has invalid location`);
  }
  if (document.maxCapacity < 1) {
    throw new Error(`Municipal office '${document.name}' maxCapacity must be >= 1`);
  }
  if (document.workload < 0) {
    throw new Error(`Municipal office '${document.name}' workload must be >= 0`);
  }
};

const main = async () => {
  const mongoUri = resolveMongoUri();
  const dataFile = resolveFilePath('database/municipal_offices_chennai.json');

  if (!fs.existsSync(dataFile)) {
    throw new Error(`Missing file: ${dataFile}`);
  }

  const records = readJsonArray(dataFile);
  await mongoose.connect(mongoUri);

  const MunicipalOffice = require('../src/models/MunicipalOffice');

  await MunicipalOffice.createIndexes();

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const raw of records) {
    if (!raw || typeof raw !== 'object') {
      throw new Error('Each municipal office record must be an object');
    }

    const document = normalizeMunicipalOffice(raw);
    validateMunicipalOffice(document);

    const result = await MunicipalOffice.findOneAndUpdate(
      { name: document.name, zone: document.zone, type: document.type },
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

  console.log('Municipal office seed completed');
  console.log(`Inserted: ${inserted}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
};

main()
  .catch((error) => {
    console.error('Seed municipal offices failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close().catch(() => {});
  });
