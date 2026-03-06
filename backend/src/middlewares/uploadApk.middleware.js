const path = require('path');
const Busboy = require('busboy');
const { PassThrough } = require('stream');
const { StatusCodes } = require('http-status-codes');
const ApiError = require('../utils/ApiError');
const { uploadApkToS3 } = require('../services/s3.service');

const MAX_FILE_SIZE_BYTES = 200 * 1024 * 1024;
const ALLOWED_FIELDS = new Set(['apk', 'file']);
const ALLOWED_MIME_TYPES = new Set([
  'application/vnd.android.package-archive',
  'application/octet-stream',
  'application/zip',
  'application/x-zip-compressed'
]);

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

    const passThrough = new PassThrough();
    fileStream.on('limit', () => {
      passThrough.destroy(new ApiError(StatusCodes.PAYLOAD_TOO_LARGE, 'APK exceeds 200MB limit'));
      fail(new ApiError(StatusCodes.PAYLOAD_TOO_LARGE, 'APK exceeds 200MB limit'));
    });

    fileStream.on('error', () => {
      passThrough.destroy(new ApiError(StatusCodes.BAD_REQUEST, 'APK stream processing failed'));
      fail(new ApiError(StatusCodes.BAD_REQUEST, 'APK stream processing failed'));
    });

    passThrough.on('error', () => {
      if (!middlewareError) {
        fail(new ApiError(StatusCodes.BAD_GATEWAY, 'APK upload stream failed'));
      }
    });

    fileStream.pipe(passThrough);

    fileProcessingPromise = uploadApkToS3(
      passThrough,
      filename,
      extension === '.apk' ? 'application/vnd.android.package-archive' : mimeType,
      req.user?.id || 'system'
    )
      .then((url) => {
        uploadedApkUrl = url;
      })
      .catch((error) => {
        if (error instanceof ApiError) {
          fail(error);
          return;
        }
        fail(new ApiError(StatusCodes.BAD_GATEWAY, 'APK upload failed'));
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
        await fileProcessingPromise;
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
    } catch (_error) {
      return done(new ApiError(StatusCodes.BAD_GATEWAY, 'APK upload processing failed'));
    }
  });

  req.pipe(busboy);
  return undefined;
};

module.exports = uploadApkBuild;
