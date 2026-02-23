import AsyncStorage from "@react-native-async-storage/async-storage";

export type AppLanguage = "en" | "ta" | "hi";

export type AppPreferences = {
  notificationsEnabled: boolean;
  locationEnabled: boolean;
  darkMode: boolean;
  language: AppLanguage;
};

const PREFERENCES_KEY = "civisense.app.preferences.v1";

const defaultPreferences: AppPreferences = {
  notificationsEnabled: true,
  locationEnabled: true,
  darkMode: false,
  language: "en",
};

const normalizeLanguage = (value: unknown): AppLanguage => {
  if (value === "en" || value === "ta" || value === "hi") {
    return value;
  }

  const legacy = typeof value === "string" ? value.toLowerCase().trim() : "";
  if (legacy.includes("tamil")) {
    return "ta";
  }
  if (legacy.includes("hindi")) {
    return "hi";
  }
  return "en";
};

export const getPreferences = async (): Promise<AppPreferences> => {
  try {
    const raw = await AsyncStorage.getItem(PREFERENCES_KEY);
    if (!raw) {
      return defaultPreferences;
    }

    const parsed = JSON.parse(raw) as Partial<AppPreferences>;
    return {
      notificationsEnabled:
        typeof parsed.notificationsEnabled === "boolean"
          ? parsed.notificationsEnabled
          : defaultPreferences.notificationsEnabled,
      locationEnabled:
        typeof parsed.locationEnabled === "boolean"
          ? parsed.locationEnabled
          : defaultPreferences.locationEnabled,
      darkMode:
        typeof parsed.darkMode === "boolean"
          ? parsed.darkMode
          : defaultPreferences.darkMode,
      language:
        parsed.language !== undefined
          ? normalizeLanguage(parsed.language)
          : defaultPreferences.language,
    };
  } catch {
    return defaultPreferences;
  }
};

export const savePreferences = async (preferences: AppPreferences): Promise<void> => {
  await AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
};
