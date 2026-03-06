const AUTH_KEYS = ['user', 'accessToken', 'refreshToken', 'isDemoSession'];

export function setAuthSession({ user, accessToken, refreshToken, isDemo = false }) {
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    localStorage.setItem('isDemoSession', isDemo ? 'true' : 'false');
}

export function clearAuthSession() {
    AUTH_KEYS.forEach((key) => localStorage.removeItem(key));
}

export function isDemoSession() {
    return localStorage.getItem('isDemoSession') === 'true';
}
