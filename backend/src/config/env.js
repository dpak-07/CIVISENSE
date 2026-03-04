const path = require('path');
const dotenv = require('dotenv');

const envFilePath = process.env.CIVISENSE_ENV_FILE || path.resolve(__dirname, '../../.env');
dotenv.config({ path: envFilePath });

const parseBoolean = (value, fallback = false) => {
  if (typeof value === 'undefined') {
    return fallback;
  }
  return String(value).trim().toLowerCase() === 'true';
};

const parseCorsOrigins = (value) =>
  String(value || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const requiredVars = ['MONGO_URI', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'AWS_REGION', 'AWS_BUCKET_NAME'];
requiredVars.forEach((name) => {
  if (!process.env[name]) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
});

const parsedCorsOrigins = parseCorsOrigins(
  process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:8081,http://127.0.0.1:8081'
);
if ((process.env.NODE_ENV || 'development') === 'production' && parsedCorsOrigins.length === 0) {
  throw new Error('CORS_ORIGIN must contain at least one allowed origin in production');
}

const env = {
  envFilePath,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: (process.env.NODE_ENV || 'development') === 'production',
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGO_URI,
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  },
  cors: {
    origins: parsedCorsOrigins,
    allowCredentials: parseBoolean(process.env.CORS_CREDENTIALS, true)
  },
  cookie: {
    secure: parseBoolean(process.env.COOKIE_SECURE, (process.env.NODE_ENV || 'development') === 'production'),
    sameSite: process.env.COOKIE_SAME_SITE || 'lax',
    domain: process.env.COOKIE_DOMAIN || null
  },
  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_MAX) || 200
  },
  aws: {
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || null,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || null,
    bucketName: process.env.AWS_BUCKET_NAME
  },
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: parseBoolean(process.env.SMTP_SECURE, false),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || '',
    to: process.env.CONTACT_TO_EMAIL || process.env.SMTP_USER || ''
  },
  ai: {
    monitorApiKey: process.env.AI_MONITOR_API_KEY || ''
  },
  features: {
    allowDemoLogin: parseBoolean(process.env.ALLOW_DEMO_LOGIN, false)
  }
};

module.exports = env;
