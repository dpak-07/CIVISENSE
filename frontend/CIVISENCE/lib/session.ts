import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppLanguage } from "@/lib/preferences";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  language?: AppLanguage;
  isActive: boolean;
  profilePhotoUrl?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

let currentSession: AuthSession | null = null;
let hydrationPromise: Promise<void> | null = null;
const SESSION_STORAGE_KEY = "civisense.auth.session.v1";
const listeners = new Set<() => void>();

const notifyListeners = () => {
  listeners.forEach((listener) => listener());
};

const hydrateFromStorage = async () => {
  try {
    const raw = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      currentSession = null;
      return;
    }

    const parsed = JSON.parse(raw) as AuthSession;
    if (parsed?.accessToken && parsed?.refreshToken && parsed?.user?.id) {
      currentSession = parsed;
      return;
    }

    currentSession = null;
  } catch {
    currentSession = null;
  } finally {
    notifyListeners();
  }
};

export const sessionStore = {
  async hydrate() {
    if (!hydrationPromise) {
      hydrationPromise = hydrateFromStorage();
    }

    await hydrationPromise;
  },
  async set(session: AuthSession) {
    currentSession = session;
    notifyListeners();
    await AsyncStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  },
  get(): AuthSession | null {
    return currentSession;
  },
  getAccessToken(): string | null {
    return currentSession?.accessToken ?? null;
  },
  getRefreshToken(): string | null {
    return currentSession?.refreshToken ?? null;
  },
  getUser(): AuthUser | null {
    return currentSession?.user ?? null;
  },
  async clear() {
    currentSession = null;
    notifyListeners();
    await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
