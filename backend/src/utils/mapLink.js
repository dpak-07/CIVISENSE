const COORDINATE_PAIR_REGEX = /(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/;
const BANG_COORDINATE_REGEX = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/;

const toNumber = (value) => Number(value);

const isFiniteCoordinate = (value) => Number.isFinite(value);

const isWithinBounds = (longitude, latitude) =>
  longitude >= -180 &&
  longitude <= 180 &&
  latitude >= -90 &&
  latitude <= 90;

const normalizeCoordinates = ({ longitude, latitude }) => {
  const lng = toNumber(longitude);
  const lat = toNumber(latitude);

  if (!isFiniteCoordinate(lng) || !isFiniteCoordinate(lat)) {
    return null;
  }

  if (!isWithinBounds(lng, lat)) {
    return null;
  }

  return [lng, lat];
};

const extractFromUrlParams = (url) => {
  const candidateParams = ['q', 'query', 'll', 'destination', 'origin'];
  for (const key of candidateParams) {
    const value = url.searchParams.get(key);
    if (!value) continue;
    const match = value.match(COORDINATE_PAIR_REGEX);
    if (!match) continue;

    const latitude = toNumber(match[1]);
    const longitude = toNumber(match[2]);
    const normalized = normalizeCoordinates({ longitude, latitude });
    if (normalized) {
      return normalized;
    }
  }
  return null;
};

const extractFromPath = (pathText) => {
  const atMatch = pathText.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (!atMatch) return null;

  const latitude = toNumber(atMatch[1]);
  const longitude = toNumber(atMatch[2]);
  return normalizeCoordinates({ longitude, latitude });
};

const parseCoordinatesFromMapLink = (mapLink) => {
  if (typeof mapLink !== 'string') {
    return null;
  }

  const trimmed = mapLink.trim();
  if (!trimmed) {
    return null;
  }

  const bangMatch = trimmed.match(BANG_COORDINATE_REGEX);
  if (bangMatch) {
    const latitude = toNumber(bangMatch[1]);
    const longitude = toNumber(bangMatch[2]);
    const normalized = normalizeCoordinates({ longitude, latitude });
    if (normalized) {
      return normalized;
    }
  }

  try {
    const url = new URL(trimmed);
    const fromPath = extractFromPath(url.pathname + url.hash);
    if (fromPath) return fromPath;

    const fromParams = extractFromUrlParams(url);
    if (fromParams) return fromParams;
  } catch (_error) {
    // Fallback for non-standard pasted strings.
  }

  const looseMatch = trimmed.match(COORDINATE_PAIR_REGEX);
  if (!looseMatch) return null;

  const latitude = toNumber(looseMatch[1]);
  const longitude = toNumber(looseMatch[2]);
  return normalizeCoordinates({ longitude, latitude });
};

const buildGoogleMapsLink = ({ longitude, latitude }) => {
  const normalized = normalizeCoordinates({ longitude, latitude });
  if (!normalized) {
    return null;
  }

  const [lng, lat] = normalized;
  return `https://www.google.com/maps?q=${lat},${lng}`;
};

module.exports = {
  normalizeCoordinates,
  parseCoordinatesFromMapLink,
  buildGoogleMapsLink
};

