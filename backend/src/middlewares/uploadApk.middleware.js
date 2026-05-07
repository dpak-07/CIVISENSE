const path = require('path');
const fs = require('fs');
const os = require('os');
const Busboy = require('busboy');
const { StatusCodes } = require('http-status-codes');
const { v4: uuidv4 } = require('uuid');
const ApiError = require('../utils/ApiError');
const { uploadApkFileToS3 } = require('../services/s3.service');

const MAX_FILE_SIZE_BYTES = 200 * 1024 * 1024;
const ALLOWED_FIELDS = new Set(['apk', 'file']);
const ALLOWED_MIME_TYPES = new Set([
  'application/vnd.android.package-archive',
  'application/octet-stream',
  'application/zip',
  'application/x-zip-compressed',
  'application/java-archive'
]);

const ensureDirectory = async (directory) => {
  await fs.promises.mkdir(directory, { recursive: true });
};

const buildPublicBaseUrl = (req) => {
  const configured = String(process.env.PUBLIC_BASE_URL || process.env.BACKEND_PUBLIC_URL || '').trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }
  return `${req.protocol}://${req.get('host')}`;
};

const persistLocalApkFallback = async ({ req, tempPath, originalFilename }) => {
  const uploadsDirectory = path.resolve(__dirname, '..', 'uploads', 'apks');
  await ensureDirectory(uploadsDirectory);

  const extension = path.extname(originalFilename || '').toLowerCase() === '.apk' ? '.apk' : '.apk';
  const fileName = `${Date.now()}-${uuidv4()}${extension}`;
  const finalPath = path.join(uploadsDirectory, fileName);

  await fs.promises.rename(tempPath, finalPath);
  return `${buildPublicBaseUrl(req)}/uploads/apks/${encodeURIComponent(fileName)}`;
};

const removeTempFile = async (tempPath) => {
  if (!tempPath) {
    return;
  }
  await fs.promises.unlink(tempPath).catch(() => {});
};

const uploadApkBuild = async (req, _res, next) => {
  const contentType = req.headers['content-type'] || '';
  if (!contentType.toLowerCase().includes('multipart/form-data')) {
    return next();
  }

  let busboy;
  try {
    busboy = Busboy({
      headers: req.headers,
      limits: {
        files: 1,
        fields: 20,
        fileSize: MAX_FILE_SIZE_BYTES
      }
    });
  } catch (_error) {
    return next(new ApiError(StatusCodes.BAD_REQUEST, 'Malformed multipart/form-data request'));
  }

  const fields = {};
  let uploadedApkUrl = null;
  let fileSeen = false;
  let fileProcessingPromise = null;
  let hasCompleted = false;
  let middlewareError = null;

  const fail = (error) => {
    if (!middlewareError) {
      middlewareError = error;
    }
  };

  const done = (error) => {
    if (hasCompleted) {
      return;
    }
    hasCompleted = true;
    next(error);
  };

  busboy.on('field', (fieldname, value) => {
    if (Object.prototype.hasOwnProperty.call(fields, fieldname)) {
      if (Array.isArray(fields[fieldname])) {
        fields[fieldname].push(value);
      } else {
        fields[fieldname] = [fields[fieldname], value];
      }
      return;
    }
    fields[fieldname] = value;
  });

  busboy.on('file', (fieldname, fileStream, info) => {
    fileSeen = true;

    if (!ALLOWED_FIELDS.has(fieldname)) {
      fileStream.resume();
      fail(new ApiError(StatusCodes.BAD_REQUEST, 'Unexpected file field; expected "apk"'));
      return;
    }

    const { filename, mimeType } = info;
    const extension = path.extname(filename || '').toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(mimeType) && extension !== '.apk') {
      fileStream.resume();
      fail(new ApiError(StatusCodes.UNSUPPORTED_MEDIA_TYPE, 'Only APK files are allowed'));
      return;
    }

    const tempDirectory = path.join(os.tmpdir(), 'civisense-apk-uploads');
    const tempPath = path.join(tempDirectory, `${Date.now()}-${uuidv4()}.apk`);
    let fileTooLarge = false;

    fileStream.on('limit', () => {
      fileTooLarge = true;
      fail(new ApiError(StatusCodes.PAYLOAD_TOO_LARGE, 'APK exceeds 200MB limit'));
    });

    fileProcessingPromise = ensureDirectory(tempDirectory)
      .then(
        () =>
          new Promise((resolve, reject) => {
            const writeStream = fs.createWriteStream(tempPath);

            fileStream.on('error', () => {
              writeStream.destroy();
              reject(new ApiError(StatusCodes.BAD_REQUEST, 'APK stream processing failed'));
            });

            writeStream.on('error', () => {
              reject(new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, 'Failed to store APK upload temporarily'));
            });

            writeStream.on('finish', () => {
              if (fileTooLarge) {
                reject(new ApiError(StatusCodes.PAYLOAD_TOO_LARGE, 'APK exceeds 200MB limit'));
                return;
              }

              resolve({
                tempPath,
                filename,
                mimetype: extension === '.apk' ? 'application/vnd.android.package-archive' : mimeType
              });
            });

            fileStream.pipe(writeStream);
          })
      )
      .catch(async (error) => {
        await removeTempFile(tempPath);
        throw error;
      });
  });

  busboy.on('filesLimit', () => {
    fail(new ApiError(StatusCodes.BAD_REQUEST, 'Only one APK upload is allowed'));
  });

  busboy.on('partsLimit', () => {
    fail(new ApiError(StatusCodes.BAD_REQUEST, 'Too many multipart sections'));
  });

  busboy.on('error', () => {
    done(new ApiError(StatusCodes.BAD_REQUEST, 'Failed to parse multipart/form-data payload'));
  });

  busboy.on('finish', async () => {
    if (hasCompleted) {
      return;
    }

    try {
      if (fileProcessingPromise) {
        const storedFile = await fileProcessingPromise;
        if (storedFile) {
          try {
            uploadedApkUrl = await uploadApkFileToS3(
              storedFile.tempPath,
              storedFile.filename,
              storedFile.mimetype,
              req.user?.id || 'system'
            );
            await removeTempFile(storedFile.tempPath);
          } catch (error) {
            const logger = require('../config/logger');
            logger.warn({
              message: 'S3 APK upload failed; using local APK fallback',
              errorName: error.name,
              errorMessage: error.message
            });
            uploadedApkUrl = await persistLocalApkFallback({
              req,
              tempPath: storedFile.tempPath,
              originalFilename: storedFile.filename
            });
          }
        }
      }

      if (middlewareError) {
        return done(middlewareError);
      }

      req.body = {
        ...fields
      };

      if (!fileSeen) {
        req.uploadedApkUrl = null;
        return done();
      }

      req.uploadedApkUrl = uploadedApkUrl;
      return done();
    } catch (error) {
      if (error instanceof ApiError) {
        return done(error);
      }
      const logger = require('../config/logger');
      logger.error({
        message: 'APK upload middleware error',
        errorName: error.name,
        errorMessage: error.message,
        stack: error.stack
      });
      return done(new ApiError(StatusCodes.BAD_GATEWAY, 'APK upload processing failed'));
    }
  });

  req.pipe(busboy);
  return undefined;
};

module.exports = uploadApkBuild;
