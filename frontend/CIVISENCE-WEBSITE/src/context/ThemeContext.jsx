import { createContext, useContext, useEffect, useMemo } from 'react';

const ThemeContext = createContext(null);
const THEME_STORAGE_KEY = 'theme';

export function ThemeProvider({ children }) {
    const theme = 'light';

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem(THEME_STORAGE_KEY, 'light');
    }, []);

    const value = useMemo(
        () => ({
            theme,
            isDark: false,
            setTheme: () => {},
            toggleTheme: () => {}
        }),
        []
    );

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) throw new Error('useTheme must be used within ThemeProvider');
    return context;
}
