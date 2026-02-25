const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

const SALT_ROUNDS = 12;

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

const normalizeText = (value) =>
  typeof value === 'string' ? value.trim() : '';

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

const loadUserSeedData = () => {
  const adminFile = resolveFilePath('database/main_admin.json');
  const municipalFile = resolveFilePath('database/municipal_users.json');

  if (!fs.existsSync(adminFile)) {
    throw new Error(`Missing file: ${adminFile}`);
  }
  if (!fs.existsSync(municipalFile)) {
    throw new Error(`Missing file: ${municipalFile}`);
  }

  const admins = readJsonArray(adminFile);
  const municipalUsers = readJsonArray(municipalFile);
  return {
    admins,
    municipalUsers
  };
};

const buildUserPayload = async ({ entry, municipalOfficeId }) => {
  const email = normalizeText(entry.email).toLowerCase();
  const name = normalizeText(entry.name);
  const password = String(entry.password || '').trim();
  const role = normalizeText(entry.role) || 'officer';
  const language = normalizeText(entry.language) || 'en';
  const isActive = entry.isActive !== false;

  if (!email || !name || !password || !role) {
    throw new Error(`Invalid user entry: ${JSON.stringify(entry)}`);
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  return {
    name,
    email,
    passwordHash,
    role,
    language,
    isActive,
    municipalOfficeId: municipalOfficeId || null,
    refreshTokenHash: null
  };
};

const main = async () => {
  const mongoUri = resolveMongoUri();
  const { admins, municipalUsers } = loadUserSeedData();

  await mongoose.connect(mongoUri);

  const User = require('../src/models/User');
  const MunicipalOffice = require('../src/models/MunicipalOffice');

  const officeIndex = new Map();
  const offices = await MunicipalOffice.find({}, { name: 1 }).lean();
  for (const office of offices) {
    officeIndex.set(normalizeText(office.name).toLowerCase(), office._id);
  }

  let upserted = 0;
  let skipped = 0;

  for (const entry of admins) {
    const payload = await buildUserPayload({ entry, municipalOfficeId: null });
    await User.findOneAndUpdate(
      { email: payload.email },
      { $set: payload },
      { upsert: true, new: true, runValidators: true }
    );
    upserted += 1;
  }

  for (const entry of municipalUsers) {
    const officeName = normalizeText(entry.municipalOfficeName).toLowerCase();
    const municipalOfficeId = officeIndex.get(officeName);
    if (!municipalOfficeId) {
      skipped += 1;
      continue;
    }

    const payload = await buildUserPayload({ entry, municipalOfficeId });
    await User.findOneAndUpdate(
      { email: payload.email },
      { $set: payload },
      { upsert: true, new: true, runValidators: true }
    );
    upserted += 1;
  }

  console.log('User seed completed');
  console.log(`Upserted users: ${upserted}`);
  console.log(`Skipped municipal users (missing office mapping): ${skipped}`);
};

main()
  .catch((error) => {
    console.error('Seed users failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close().catch(() => {});
  });
