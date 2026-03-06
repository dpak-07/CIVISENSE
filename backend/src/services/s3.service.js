const path = require('path');
const { Upload } = require('@aws-sdk/lib-storage');
const { StatusCodes } = require('http-status-codes');
const { v4: uuidv4 } = require('uuid');
const env = require('../config/env');
const s3Client = require('../config/s3');
const logger = require('../config/logger');
const ApiError = require('../utils/ApiError');

const MIME_EXTENSION_MAP = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'application/vnd.android.package-archive': '.apk',
  'application/octet-stream': '.apk'
};

const buildObjectKey = (prefix, filename, mimetype, seed) => {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const extension = path.extname(filename || '').toLowerCase() || MIME_EXTENSION_MAP[mimetype] || '';
  const safeExtension = extension.replace(/[^a-z0-9.]/gi, '');
  const objectId = seed || uuidv4();

  return `${prefix}/${year}/${month}/${objectId}${safeExtension}`;
};

const uploadStreamToS3 = async (stream, key, mimetype) => {
  try {
    const uploader = new Upload({
      client: s3Client,
      params: {
        Bucket: env.aws.bucketName,
        Key: key,
        Body: stream,
        ContentType: mimetype
      },
      // Keep concurrency low for small-node instances (2 vCPU).
      queueSize: 1,
      partSize: 5 * 1024 * 1024,
      leavePartsOnError: false
    });

    await uploader.done();

    const encodedKey = key
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');

    return `https://${env.aws.bucketName}.s3.${env.aws.region}.amazonaws.com/${encodedKey}`;
  } catch (error) {
    logger.error({
      message: 'S3 upload failed',
      name: error.name,
      errorCode: error.Code || error.code || null,
      errorMessage: error.message,
      httpStatus: error.$metadata?.httpStatusCode || null,
      requestId: error.$metadata?.requestId || null,
      cause: error.cause?.message || null
    });

    const responseMessage =
      env.nodeEnv === 'development'
        ? `Failed to upload image to storage: ${error.message}`
        : 'Failed to upload image to storage';

    throw new ApiError(StatusCodes.BAD_GATEWAY, responseMessage);
  }
};

const uploadToS3 = async (stream, filename, mimetype) => {
  const key = buildObjectKey('complaints', filename, mimetype);
  return uploadStreamToS3(stream, key, mimetype);
};

const uploadProfilePhotoToS3 = async (stream, filename, mimetype, userId) => {
  const safeUserId = userId ? userId.replace(/[^a-z0-9_-]/gi, '') : '';
  const seed = safeUserId ? `${safeUserId}-${uuidv4()}` : uuidv4();
  const key = buildObjectKey('profile-photos', filename, mimetype, seed);
  return uploadStreamToS3(stream, key, mimetype);
};

const uploadApkToS3 = async (stream, filename, mimetype, uploadedBy) => {
  const safeUploader = uploadedBy ? String(uploadedBy).replace(/[^a-z0-9_-]/gi, '') : 'system';
  const seed = `${safeUploader}-${uuidv4()}`;
  const key = buildObjectKey('app-builds/android', filename, mimetype, seed);
  return uploadStreamToS3(stream, key, mimetype);
};

module.exports = {
  uploadToS3,
  uploadProfilePhotoToS3,
  uploadApkToS3
};
