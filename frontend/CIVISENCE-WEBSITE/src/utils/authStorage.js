const LOCAL_STORAGE_KEYS = ['user', 'isDemoSession'];
const SESSION_STORAGE_KEYS = ['accessToken'];
const LEGACY_KEYS = ['refreshToken'];

export function setAuthSession({ user, accessToken, isDemo = false }) {
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('isDemoSession', isDemo ? 'true' : 'false');

    if (accessToken) {
        sessionStorage.setItem('accessToken', accessToken);
    }
}

export function clearAuthSession() {
    LOCAL_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
    SESSION_STORAGE_KEYS.forEach((key) => sessionStorage.removeItem(key));
    LEGACY_KEYS.forEach((key) => localStorage.removeItem(key));
}

export function isDemoSession() {
    return localStorage.getItem('isDemoSession') === 'true';
}

export function getStoredUser() {
    const raw = localStorage.getItem('user');
    if (!raw) {
        return null;
    }

    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

export function getAccessToken() {
    return sessionStorage.getItem('accessToken');
}

export function getLegacyRefreshToken() {
    return localStorage.getItem('refreshToken');
}
