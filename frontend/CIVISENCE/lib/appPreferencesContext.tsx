import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AppLanguage, AppPreferences, getPreferences, savePreferences } from "@/lib/preferences";
import { translate, TranslationKey, TranslationParams } from "@/lib/i18n";

type ThemeMode = "light" | "dark";

type ThemePalette = {
  mode: ThemeMode;
  statusBar: "light" | "dark";
  colors: {
    appBackground: string;
    surface: string;
    surfaceAlt: string;
    text: string;
    subText: string;
    border: string;
    accent: string;
    overlay: string;
  };
};

type AppPreferencesContextValue = {
  ready: boolean;
  preferences: AppPreferences;
  theme: ThemePalette;
  setDarkMode: (value: boolean) => Promise<void>;
  setLanguage: (language: AppLanguage) => Promise<void>;
  setPreferenceFlags: (flags: Pick<AppPreferences, "notificationsEnabled" | "locationEnabled">) => Promise<void>;
  t: (key: TranslationKey, params?: TranslationParams) => string;
};

const lightTheme: ThemePalette = {
  mode: "light",
  statusBar: "dark",
  colors: {
    appBackground: "#F5F7FF",
    surface: "#FFFFFF",
    surfaceAlt: "#EEF2FF",
    text: "#0F172A",
    subText: "#64748B",
    border: "#E2E8F0",
    accent: "#4F46E5",
    overlay: "rgba(255,255,255,0)",
  },
};

const darkTheme: ThemePalette = {
  mode: "dark",
  statusBar: "light",
  colors: {
    appBackground: "#070B14",
    surface: "#0F172A",
    surfaceAlt: "#111C31",
    text: "#E2E8F0",
    subText: "#94A3B8",
    border: "#1E293B",
    accent: "#818CF8",
    overlay: "rgba(5,10,20,0.18)",
  },
};

const defaultPreferences: AppPreferences = {
  notificationsEnabled: true,
  locationEnabled: true,
  darkMode: false,
  language: "en",
};

const AppPreferencesContext = createContext<AppPreferencesContextValue | null>(null);

export function AppPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [preferences, setPreferences] = useState<AppPreferences>(defaultPreferences);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const saved = await getPreferences();
      if (!active) {
        return;
      }
      setPreferences(saved);
      setReady(true);
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const updatePreferences = useCallback(async (updater: (prev: AppPreferences) => AppPreferences) => {
    let nextValue: AppPreferences = defaultPreferences;
    setPreferences((prev) => {
      nextValue = updater(prev);
      return nextValue;
    });
    await savePreferences(nextValue);
  }, []);

  const setDarkMode = useCallback(
    async (value: boolean) => {
      await updatePreferences((prev) => ({ ...prev, darkMode: value }));
    },
    [updatePreferences]
  );

  const setLanguage = useCallback(
    async (language: AppLanguage) => {
      await updatePreferences((prev) => ({ ...prev, language }));
    },
    [updatePreferences]
  );

  const setPreferenceFlags = useCallback(
    async (flags: Pick<AppPreferences, "notificationsEnabled" | "locationEnabled">) => {
      await updatePreferences((prev) => ({ ...prev, ...flags }));
    },
    [updatePreferences]
  );

  const theme = useMemo<ThemePalette>(
    () => (preferences.darkMode ? darkTheme : lightTheme),
    [preferences.darkMode]
  );

  const t = useCallback(
    (key: TranslationKey, params?: TranslationParams) => translate(preferences.language, key, params),
    [preferences.language]
  );

  const value = useMemo<AppPreferencesContextValue>(
    () => ({
      ready,
      preferences,
      theme,
      setDarkMode,
      setLanguage,
      setPreferenceFlags,
      t,
    }),
    [ready, preferences, theme, setDarkMode, setLanguage, setPreferenceFlags, t]
  );

  return <AppPreferencesContext.Provider value={value}>{children}</AppPreferencesContext.Provider>;
}

export const useAppPreferences = (): AppPreferencesContextValue => {
  const context = useContext(AppPreferencesContext);
  if (!context) {
    throw new Error("useAppPreferences must be used inside AppPreferencesProvider");
  }
  return context;
};
