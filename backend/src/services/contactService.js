const nodemailer = require('nodemailer');
const { StatusCodes } = require('http-status-codes');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

let transporter;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const escapeHtml = (value) =>
  String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const ensureTransporter = () => {
  if (transporter) {
    return transporter;
  }

  if (!env.smtp.host || !env.smtp.port || !env.smtp.user || !env.smtp.pass || !env.smtp.to) {
    throw new ApiError(
      StatusCodes.SERVICE_UNAVAILABLE,
      'Contact email service is not configured'
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

const sanitizeText = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const sendContactMessage = async ({ name, email, subject, message }) => {
  const cleanName = sanitizeText(name);
  const cleanEmail = sanitizeText(email).toLowerCase();
  const cleanSubject = sanitizeText(subject || 'New contact request');
  const cleanMessage = String(message || '').trim();

  if (!cleanName || cleanName.length < 2 || cleanName.length > 120) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Name must be between 2 and 120 characters'
    );
  }

  if (!EMAIL_PATTERN.test(cleanEmail)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'A valid email is required');
  }

  if (!cleanSubject || cleanSubject.length > 160) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Subject is required and must be 160 characters or less'
    );
  }

  if (!cleanMessage || cleanMessage.length < 10 || cleanMessage.length > 5000) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'Message must be between 10 and 5000 characters'
    );
  }

  const mailer = ensureTransporter();
  const fromAddress = env.smtp.from || `"CiviSense Contact" <${env.smtp.user}>`;

  await mailer.sendMail({
    from: fromAddress,
    to: env.smtp.to,
    replyTo: cleanEmail,
    subject: `[CiviSense Contact] ${cleanSubject}`,
    text: [
      'New contact request from CiviSense website',
      '',
      `Name: ${cleanName}`,
      `Email: ${cleanEmail}`,
      `Subject: ${cleanSubject}`,
      '',
      'Message:',
      cleanMessage
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
        <h2 style="margin: 0 0 12px;">New Contact Request</h2>
        <p style="margin: 0 0 16px;">Received from the CiviSense public website.</p>
        <table cellpadding="0" cellspacing="0" style="border-collapse: collapse; width: 100%; max-width: 640px;">
          <tr><td style="padding: 6px 0;"><strong>Name:</strong> ${escapeHtml(cleanName)}</td></tr>
          <tr><td style="padding: 6px 0;"><strong>Email:</strong> ${escapeHtml(cleanEmail)}</td></tr>
          <tr><td style="padding: 6px 0;"><strong>Subject:</strong> ${escapeHtml(cleanSubject)}</td></tr>
        </table>
        <div style="margin-top: 14px; padding: 12px; border: 1px solid #e5e7eb; border-radius: 8px; white-space: pre-wrap;">
          ${escapeHtml(cleanMessage)}
        </div>
      </div>
    `
  });

  return { delivered: true };
};

module.exports = {
  sendContactMessage
};
