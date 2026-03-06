const COORDINATE_REGEX = /(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/;
const BANG_COORDINATE_REGEX = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/;

const toFinite = (value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
};

const normalizeCoordinates = ({ longitude, latitude }) => {
    const lng = toFinite(longitude);
    const lat = toFinite(latitude);

    if (lng === null || lat === null) return null;
    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) return null;

    return { longitude: lng, latitude: lat };
};

export const parseCoordinatesFromMapLink = (mapLink) => {
    if (typeof mapLink !== 'string' || !mapLink.trim()) return null;

    const trimmed = mapLink.trim();

    const fromBangSyntax = trimmed.match(BANG_COORDINATE_REGEX);
    if (fromBangSyntax) {
        const normalized = normalizeCoordinates({
            latitude: fromBangSyntax[1],
            longitude: fromBangSyntax[2]
        });
        if (normalized) return normalized;
    }

    try {
        const parsed = new URL(trimmed);

        const pathMatch = `${parsed.pathname}${parsed.hash}`.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
        if (pathMatch) {
            const normalized = normalizeCoordinates({
                latitude: pathMatch[1],
                longitude: pathMatch[2]
            });
            if (normalized) return normalized;
        }

        for (const key of ['q', 'query', 'll', 'destination', 'origin']) {
            const value = parsed.searchParams.get(key);
            if (!value) continue;
            const match = value.match(COORDINATE_REGEX);
            if (!match) continue;

            const normalized = normalizeCoordinates({
                latitude: match[1],
                longitude: match[2]
            });
            if (normalized) return normalized;
        }
    } catch {
        // ignore invalid URL strings and try loose parse below
    }

    const loose = trimmed.match(COORDINATE_REGEX);
    if (!loose) return null;

    return normalizeCoordinates({
        latitude: loose[1],
        longitude: loose[2]
    });
};

export const buildGoogleMapsLink = ({ longitude, latitude }) => {
    const normalized = normalizeCoordinates({ longitude, latitude });
    if (!normalized) return '';
    return `https://www.google.com/maps?q=${normalized.latitude},${normalized.longitude}`;
};
