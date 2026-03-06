const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

const resolveFilePath = (relativePath) =>
  path.resolve(__dirname, '..', '..', relativePath);

const normalizeText = (value) =>
  typeof value === 'string' ? value.trim() : '';

const toStringList = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeText(String(item || '')))
      .filter(Boolean)
      .slice(0, 20);
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => normalizeText(item))
      .filter(Boolean)
      .slice(0, 20);
  }

  return [];
};

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

const loadDeveloperSeedData = () => {
  const developerFile = resolveFilePath('database/developers.json');
  if (!fs.existsSync(developerFile)) {
    throw new Error(`Missing file: ${developerFile}`);
  }
  return readJsonArray(developerFile);
};

const buildDeveloperPayload = (entry, index) => {
  const profileType = normalizeText(entry.profileType).toLowerCase() === 'mentor' ? 'mentor' : 'team';
  const name = normalizeText(entry.name);
  const role = normalizeText(entry.role);
  const description = normalizeText(entry.description);
  const photoUrl = normalizeText(entry.photoUrl) || null;
  const skills = toStringList(entry.skills);
  const highlights = toStringList(entry.highlights);
  const socials = {
    github: normalizeText(entry?.socials?.github) || '#',
    linkedin: normalizeText(entry?.socials?.linkedin) || '#',
    portfolio: normalizeText(entry?.socials?.portfolio) || '#'
  };
  const displayOrderInput = Number(entry.displayOrder);
  const displayOrder = Number.isFinite(displayOrderInput) && displayOrderInput >= 0
    ? Math.round(displayOrderInput)
    : index + 1;
  const isActive = entry.isActive !== false;

  if (!name || !role || !description) {
    throw new Error(`Invalid developer entry at index ${index}: name, role, and description are required`);
  }

  return {
    profileType,
    name,
    role,
    description,
    photoUrl,
    skills,
    highlights,
    socials,
    displayOrder,
    isActive
  };
};

const main = async () => {
  const mongoUri = resolveMongoUri();
  const developerEntries = loadDeveloperSeedData();

  await mongoose.connect(mongoUri);
  const DeveloperProfile = require('../src/models/DeveloperProfile');

  const payload = developerEntries.map((entry, index) => buildDeveloperPayload(entry, index));

  await DeveloperProfile.deleteMany({});
  await DeveloperProfile.insertMany(payload);

  console.log('Developer seed completed');
  console.log(`Inserted profiles: ${payload.length}`);
};

main()
  .catch((error) => {
    console.error('Seed developers failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close().catch(() => {});
  });
