const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

const toSafeLocalPart = (value, fallbackLocal = 'municipaloffice') => {
  const normalized = normalizeEmail(value).split('@')[0];
  const local = normalized.replace(/[^a-z0-9]+/g, '');
  if (local) {
    return local;
  }
  return String(fallbackLocal || 'municipaloffice')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '') || 'municipaloffice';
};

const ensureDefaultDomainEmail = (
  value,
  { defaultDomain = 'gmail.com', fallbackLocal = 'municipaloffice' } = {}
) => {
  const normalized = normalizeEmail(value);
  if (!normalized) {
    return '';
  }
  if (normalized.includes('@')) {
    return normalized;
  }
  const localPart = toSafeLocalPart(normalized, fallbackLocal);
  return `${localPart}@${defaultDomain}`;
};

const buildEmailCandidates = (value) => {
  const normalized = normalizeEmail(value);
  if (!normalized) {
    return [];
  }
  const candidates = new Set([normalized]);
  if (!normalized.includes('@')) {
    candidates.add(ensureDefaultDomainEmail(normalized));
  }
  return [...candidates];
};

module.exports = {
  normalizeEmail,
  ensureDefaultDomainEmail,
  buildEmailCandidates
};
