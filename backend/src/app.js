const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const env = require('./config/env');
const routes = require('./routes');
const loggingMiddleware = require('./middlewares/loggingMiddleware');
const requestMetricsMiddleware = require('./middlewares/requestMetricsMiddleware');
const logsService = require('./services/logsService');
const { notFoundHandler, errorHandler } = require('./middlewares/errorMiddleware');

const app = express();

app.set('trust proxy', 1);

app.use(helmet());
app.use(
  cors({
    origin: env.corsOrigin === '*' ? true : env.corsOrigin.split(',').map((origin) => origin.trim()),
    credentials: true
  })
);
app.use(requestMetricsMiddleware);
app.use(
  rateLimit({
    windowMs: env.rateLimit.windowMs,
    max: env.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path.startsWith('/api/logs'),
    message: {
      success: false,
      message: 'Too many requests. Please try again later.'
    },
    handler: (req, res, _next, options) => {
      logsService.recordRateLimit({ req, message: options?.message?.message });
      res.status(options.statusCode).json(options.message);
    }
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(loggingMiddleware);

app.get('/health', (_req, res) => {
  res.status(200).json({ success: true, message: 'OK' });
});

app.use('/api', routes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
