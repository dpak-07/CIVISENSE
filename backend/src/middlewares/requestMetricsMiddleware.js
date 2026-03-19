const logsService = require('../services/logsService');

const requestMetricsMiddleware = (req, res, next) => {
  const start = process.hrtime.bigint();
  logsService.markRequestStart();

  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1e6;
    try {
      logsService.recordRequest({ req, res, durationMs });
    } finally {
      logsService.markRequestEnd();
    }
  });

  next();
};

module.exports = requestMetricsMiddleware;
