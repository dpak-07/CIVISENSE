const Busboy = require('busboy');
const path = require('path');
const { StatusCodes } = require('http-status-codes');
const ApiError = require('../utils/ApiError');

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_FIELDS = new Set(['file', 'sheet', 'excel', 'upload']);
const ALLOWED_EXTENSIONS = new Set(['.xlsx', '.xls', '.csv']);
const ALLOWED_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/csv',
  'application/octet-stream'
]);

const uploadSpreadsheet = (req, _res, next) => {
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
    return next(new ApiError(StatusCodes.BAD_REQUEST, 'Malformed spreadsheet upload request'));
  }

  const fields = {};
  let chunks = [];
  let fileSeen = false;
  let fileName = '';
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
    fields[fieldname] = value;
  });

  busboy.on('file', (fieldname, fileStream, info) => {
    fileSeen = true;

    if (!ALLOWED_FIELDS.has(fieldname)) {
      fileStream.resume();
      fail(new ApiError(StatusCodes.BAD_REQUEST, 'Unexpected spreadsheet field'));
      return;
    }

    fileName = info.filename || 'import.xlsx';
    const extension = path.extname(fileName).toLowerCase();
    const mimeType = info.mimeType || '';

    if (!ALLOWED_EXTENSIONS.has(extension) && !ALLOWED_MIME_TYPES.has(mimeType)) {
      fileStream.resume();
      fail(new ApiError(StatusCodes.UNSUPPORTED_MEDIA_TYPE, 'Upload an .xlsx, .xls, or .csv file'));
      return;
    }

    fileStream.on('data', (chunk) => {
      chunks.push(chunk);
    });

    fileStream.on('limit', () => {
      fail(new ApiError(StatusCodes.PAYLOAD_TOO_LARGE, 'Spreadsheet exceeds 5MB limit'));
    });

    fileStream.on('error', () => {
      fail(new ApiError(StatusCodes.BAD_REQUEST, 'Spreadsheet stream processing failed'));
    });
  });

  busboy.on('filesLimit', () => {
    fail(new ApiError(StatusCodes.BAD_REQUEST, 'Only one spreadsheet file is allowed'));
  });

  busboy.on('error', () => {
    done(new ApiError(StatusCodes.BAD_REQUEST, 'Failed to parse spreadsheet upload'));
  });

  busboy.on('finish', () => {
    if (middlewareError) {
      return done(middlewareError);
    }

    req.body = {
      ...fields
    };

    if (!fileSeen) {
      return done(new ApiError(StatusCodes.BAD_REQUEST, 'Spreadsheet file is required'));
    }

    req.uploadedSpreadsheet = {
      originalName: fileName,
      buffer: Buffer.concat(chunks)
    };
    chunks = [];
    return done();
  });

  req.pipe(busboy);
  return undefined;
};

module.exports = uploadSpreadsheet;
