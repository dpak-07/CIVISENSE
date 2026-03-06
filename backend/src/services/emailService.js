const nodemailer = require('nodemailer');
const { StatusCodes } = require('http-status-codes');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

let transporter;

const ensureTransporter = () => {
  if (transporter) {
    return transporter;
  }

  if (!env.smtp.host || !env.smtp.port || !env.smtp.user || !env.smtp.pass) {
    throw new ApiError(
      StatusCodes.SERVICE_UNAVAILABLE,
      'Email service is not configured'
    );
  }

  transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: {
      user: env.smtp.user,
      pass: env.smtp.pass
    }
  });

  return transporter;
};

const sendOtpEmail = async ({ email, otp, expiresInMinutes }) => {
  const mailer = ensureTransporter();
  const fromAddress = env.smtp.from || `"CiviSense" <${env.smtp.user}>`;

  await mailer.sendMail({
    from: fromAddress,
    to: email,
    subject: 'CiviSense verification code',
    text: [
      'Your CiviSense verification code is:',
      '',
      otp,
      '',
      `This code expires in ${expiresInMinutes} minutes.`,
      'If you did not request this, you can ignore this email.'
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <h2 style="margin: 0 0 12px;">CiviSense Verification Code</h2>
        <p style="margin: 0 0 10px;">Use the code below to finish creating your account.</p>
        <div style="display: inline-block; padding: 12px 18px; background: #EEF2FF; border-radius: 10px; font-size: 20px; letter-spacing: 4px; font-weight: 700;">
          ${otp}
        </div>
        <p style="margin: 16px 0 0;">This code expires in ${expiresInMinutes} minutes.</p>
        <p style="margin: 6px 0 0; color: #6B7280;">If you did not request this, you can ignore this email.</p>
      </div>
    `
  });

  return { delivered: true };
};

module.exports = {
  sendOtpEmail
};
