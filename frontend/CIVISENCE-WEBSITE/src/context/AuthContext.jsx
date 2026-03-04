import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { login as apiLogin, register as apiRegister, refreshSession, logout as apiLogout } from '../api/auth';
import {
    clearAuthSession,
    getAccessToken,
    getLegacyRefreshToken,
    getStoredUser,
    isDemoSession,
    setAuthSession,
} from '../utils/authStorage';

const AuthContext = createContext(null);
const DEMO_LOGIN_ENABLED =
    import.meta.env.DEV && String(import.meta.env.VITE_ALLOW_DEMO_LOGIN || '').toLowerCase() === 'true';
const DEMO_LOGIN_ID = import.meta.env.VITE_DEMO_LOGIN_ID || '';
const DEMO_LOGIN_PASSWORD = import.meta.env.VITE_DEMO_LOGIN_PASSWORD || '';

const roleToPortal = (role) => {
    if (role === 'super_admin' || role === 'admin') return 'admin';
    if (role === 'officer') return 'officer';
    return 'citizen';
};

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const bootstrapAuth = async () => {
            const storedUser = getStoredUser();
            const accessToken = getAccessToken();

            if (storedUser && accessToken) {
                setUser(storedUser);
                setLoading(false);
                return;
            }

            try {
                const legacyRefreshToken = getLegacyRefreshToken();
                const { data } = await refreshSession(legacyRefreshToken || null);
                const { user: userData, accessToken: nextAccessToken } = data.data || {};

                if (userData && nextAccessToken) {
                    setAuthSession({ user: userData, accessToken: nextAccessToken, isDemo: false });
                    setUser(userData);
                } else {
                    clearAuthSession();
                }
            } catch {
                clearAuthSession();
            } finally {
                setLoading(false);
            }
        };

        void bootstrapAuth();
    }, []);

    const login = useCallback(async (email, password, preferredRole = 'citizen') => {
        const normalizedLogin = email.trim().toLowerCase();
        const isDemoCreds =
            DEMO_LOGIN_ENABLED &&
            normalizedLogin === String(DEMO_LOGIN_ID).trim().toLowerCase() &&
            password === String(DEMO_LOGIN_PASSWORD);
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
                isDemo: true
            });
            setUser(demoUser);
            return demoUser;
        }

        const { data } = await apiLogin({ email, password });
        const { user: userData, accessToken } = data.data;
        const selectedPortal = roleToPortal(preferredRole);
        const backendPortal = roleToPortal(userData?.role);

        if (selectedPortal !== backendPortal) {
            throw new Error(`This account is ${backendPortal}. Use ${backendPortal} portal to sign in.`);
        }

        setAuthSession({ user: userData, accessToken, isDemo: false });
        setUser(userData);
        return userData;
    }, []);

    const register = useCallback(async (formData) => {
        const { data } = await apiRegister(formData);
        const { user: userData, accessToken } = data.data;
        setAuthSession({ user: userData, accessToken, isDemo: false });
        setUser(userData);
        return userData;
    }, []);

    const logout = useCallback(async () => {
        try {
            const demoSession = isDemoSession();
            if (!demoSession) await apiLogout();
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
