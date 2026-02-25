import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { login as apiLogin, register as apiRegister, logout as apiLogout } from '../api/auth';
import { clearAuthSession, isDemoSession, setAuthSession } from '../utils/authStorage';

const AuthContext = createContext(null);
const DEMO_LOGIN_ID = 'abc';
const DEMO_LOGIN_PASSWORD = '1234';

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        const accessToken = localStorage.getItem('accessToken');
        if (storedUser && accessToken) {
            try {
                setUser(JSON.parse(storedUser));
            } catch {
                clearAuthSession();
            }
        }
        setLoading(false);
    }, []);

    const login = useCallback(async (email, password, preferredRole = 'citizen') => {
        const normalizedLogin = email.trim().toLowerCase();
        const isDemoCreds = normalizedLogin === DEMO_LOGIN_ID && password === DEMO_LOGIN_PASSWORD;
        const isAllowedDemoRole = preferredRole === 'admin' || preferredRole === 'officer';

        if (isDemoCreds && isAllowedDemoRole) {
            const demoUser = {
                id: `demo-${preferredRole}`,
                name: preferredRole === 'admin' ? 'Demo Admin' : 'Demo Officer',
                email: `${preferredRole}@demo.local`,
                role: preferredRole,
                isDemo: true
            };

            setAuthSession({
                user: demoUser,
                accessToken: `demo-access-${preferredRole}`,
                refreshToken: `demo-refresh-${preferredRole}`,
                isDemo: true
            });
            setUser(demoUser);
            return demoUser;
        }

        const { data } = await apiLogin({ email, password });
        const { user: userData, accessToken, refreshToken } = data.data;
        setAuthSession({ user: userData, accessToken, refreshToken, isDemo: false });
        setUser(userData);
        return userData;
    }, []);

    const register = useCallback(async (formData) => {
        const { data } = await apiRegister(formData);
        const { user: userData, accessToken, refreshToken } = data.data;
        setAuthSession({ user: userData, accessToken, refreshToken, isDemo: false });
        setUser(userData);
        return userData;
    }, []);

    const logout = useCallback(async () => {
        try {
            const demoSession = isDemoSession();
            const refreshToken = localStorage.getItem('refreshToken');
            if (!demoSession && refreshToken) await apiLogout(refreshToken);
        } catch {
            /* ignore */
        } finally {
            clearAuthSession();
            setUser(null);
        }
    }, []);

    const value = { user, loading, login, register, logout, isAuthenticated: !!user };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
}
