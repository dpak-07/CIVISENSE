const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { ensureDefaultDomainEmail } = require('../src/utils/email');
const { ROLES } = require('../src/constants/roles');

const SALT_ROUNDS = 12;
const DEFAULT_PASSWORD = process.env.MUNICIPAL_OFFICER_DEFAULT_PASSWORD || '1234';
const DEFAULT_DATA_FILE = 'database/municipal_offices_tamil_nadu.json';

const resolveFilePath = (relativePath) => path.resolve(__dirname, '..', '..', relativePath);

const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '');

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
    throw new Error('MONGO_URI is required (set in backend/.env, database/.env, or repo .env)');
  }

  return process.env.MONGO_URI;
};

const slugify = (value, fallback = 'municipaloffice') => {
  const slug = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
  return slug || fallback;
};

const buildOfficerCredentials = (office) => {
  const localPart = slugify(`${office.zone} ${office.name}`);
  const officerEmail = ensureDefaultDomainEmail(localPart, {
    defaultDomain: 'gmail.com',
    fallbackLocal: localPart
  });

  return {
    officerName: `${office.name} Officer`,
    officerEmail,
    officerPassword: DEFAULT_PASSWORD
  };
};

const normalizeOffice = (raw) => {
  const location = raw.location && typeof raw.location === 'object' ? raw.location : {};
  return {
    name: normalizeText(raw.name),
    type: normalizeText(raw.type).toLowerCase(),
    zone: normalizeText(raw.zone),
    location: {
      type: 'Point',
      coordinates: Array.isArray(location.coordinates) ? location.coordinates.map(Number) : []
    },
    mapLink: normalizeText(raw.mapLink) || null,
    workload: Number.isFinite(Number(raw.workload)) ? Number(raw.workload) : 0,
    maxCapacity: Number.isFinite(Number(raw.maxCapacity)) ? Number(raw.maxCapacity) : 200,
    isActive: raw.isActive !== false
  };
};

const validateOffice = (office) => {
  if (!office.name || !office.type || !office.zone) {
    throw new Error(`Invalid office row: ${JSON.stringify(office)}`);
  }
  if (
    office.location.type !== 'Point' ||
    !Array.isArray(office.location.coordinates) ||
    office.location.coordinates.length !== 2 ||
    office.location.coordinates.some((coordinate) => !Number.isFinite(coordinate))
  ) {
    throw new Error(`Municipal office '${office.name}' has invalid [longitude, latitude] coordinates`);
  }
  if (office.maxCapacity < 1) {
    throw new Error(`Municipal office '${office.name}' maxCapacity must be >= 1`);
  }
};

const main = async () => {
  const mongoUri = resolveMongoUri();
  const dataFile = resolveFilePath(process.argv[2] || process.env.MUNICIPAL_OFFICES_SEED_FILE || DEFAULT_DATA_FILE);

  if (!fs.existsSync(dataFile)) {
    throw new Error(`Missing file: ${dataFile}`);
  }

  const records = readJsonArray(dataFile);
  await mongoose.connect(mongoUri);

  const MunicipalOffice = require('../src/models/MunicipalOffice');
  const User = require('../src/models/User');

  await Promise.all([MunicipalOffice.createIndexes(), User.createIndexes()]);

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);
  const seenEmails = new Set();
  let officesUpserted = 0;
  let usersUpserted = 0;

  for (const raw of records) {
    const officePayload = normalizeOffice(raw);
    validateOffice(officePayload);

    const credentials = buildOfficerCredentials(officePayload);
    let officerEmail = credentials.officerEmail;
    if (seenEmails.has(officerEmail)) {
      officerEmail = ensureDefaultDomainEmail(`${slugify(officePayload.zone)}${slugify(officePayload.name)}${seenEmails.size}`, {
        defaultDomain: 'gmail.com'
      });
    }
    seenEmails.add(officerEmail);

    const office = await MunicipalOffice.findOneAndUpdate(
      { name: officePayload.name, zone: officePayload.zone, type: officePayload.type },
      {
        $set: {
          ...officePayload,
          officerCredentials: {
            ...credentials,
            officerEmail
          }
        }
      },
      { upsert: true, new: true, runValidators: true }
    );
    officesUpserted += 1;

    const officerPayload = {
      name: credentials.officerName,
      email: officerEmail,
      passwordHash,
      role: ROLES.OFFICER,
      language: 'en',
      isActive: true,
      municipalOfficeId: office._id,
      refreshTokenHash: null
    };

    const existingOfficer = await User.findOne({
      $or: [
        { role: ROLES.OFFICER, municipalOfficeId: office._id },
        { email: officerEmail }
      ]
    });

    if (existingOfficer) {
      await User.findByIdAndUpdate(existingOfficer._id, { $set: officerPayload }, { runValidators: true });
    } else {
      await User.create(officerPayload);
    }
    usersUpserted += 1;
  }

  console.log('Municipal offices and officer users seed completed');
  console.log(`Source file: ${dataFile}`);
  console.log(`Offices upserted: ${officesUpserted}`);
  console.log(`Officer users upserted: ${usersUpserted}`);
  console.log(`Default officer password: ${DEFAULT_PASSWORD}`);
};

main()
  .catch((error) => {
    console.error('Seed municipal offices and users failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close().catch(() => {});
  });
