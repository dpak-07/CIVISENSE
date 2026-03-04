const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const env = require('./config/env');
const routes = require('./routes');
const loggingMiddleware = require('./middlewares/loggingMiddleware');
const { notFoundHandler, errorHandler } = require('./middlewares/errorMiddleware');

const app = express();
const allowedOrigins = new Set((env.cors.origins || []).map((origin) => origin.toLowerCase()));

const corsOriginResolver = (origin, callback) => {
  // Requests like curl/postman may not send Origin header.
  if (!origin) {
    callback(null, true);
    return;
  }

  if (allowedOrigins.has(origin.toLowerCase())) {
    callback(null, true);
    return;
  }

  callback(new Error('CORS origin denied'));
};

app.set('trust proxy', 1);

app.use(helmet());
app.use(
  cors({
    origin: corsOriginResolver,
    credentials: env.cors.allowCredentials
  })
);
app.use(
  rateLimit({
    windowMs: env.rateLimit.windowMs,
    max: env.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message: 'Too many requests. Please try again later.'
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
