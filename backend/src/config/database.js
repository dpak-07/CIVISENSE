const mongoose = require('mongoose');
const env = require('./env');
const logger = require('./logger');
const Complaint = require('../models/Complaint');
const MunicipalOffice = require('../models/MunicipalOffice');
const SensitiveLocation = require('../models/SensitiveLocation');

const ensureIndexes = async () => {
  // Geo queries in duplicate detection and routing fail without these indexes.
  const models = [
    { name: 'Complaint', model: Complaint },
    { name: 'MunicipalOffice', model: MunicipalOffice },
    { name: 'SensitiveLocation', model: SensitiveLocation }
  ];

  for (const { name, model } of models) {
    await model.createIndexes();
    logger.info(`${name} indexes ensured`);
  }
};

const connectDatabase = async () => {
  try {
    await mongoose.connect(env.mongoUri, {
      serverSelectionTimeoutMS: 10000
    });
    await ensureIndexes();
    logger.info('MongoDB connected');
  } catch (error) {
    logger.error(`MongoDB connection failed: ${error.message}`);
    throw error;
  }
};

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  logger.info('MongoDB reconnected');
});

module.exports = {
  connectDatabase
};
