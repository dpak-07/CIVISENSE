import Constants from "expo-constants";
import { Platform } from "react-native";

const FORCED_API_BASE_URL = "http://43.204.139.225/api";
const envBaseUrl = FORCED_API_BASE_URL;
const PROD_API_BASE_URLS = [
  FORCED_API_BASE_URL,
];

const normalizeBaseUrl = (value: string): string =>
  value.trim().replace(/\/+$/, "");

const parseHost = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }

  const sanitized = value.replace(/^https?:\/\//, "").trim();
  if (!sanitized) {
    return null;
  }

  const host = sanitized.split(":")[0]?.trim();
  if (!host) {
    return null;
  }

  return host;
};

const isLocalhost = (host: string): boolean =>
  host === "localhost" || host === "127.0.0.1";

const isPrivateIpHost = (host: string): boolean => {
  if (host === "10.0.2.2") {
    return true;
  }

  const parts = host.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    return false;
  }

  const [first, second] = parts;
  if (first === 10) {
    return true;
  }
  if (first === 192 && second === 168) {
    return true;
  }
  if (first === 172 && second >= 16 && second <= 31) {
    return true;
  }

  return false;
};

const isLanHost = (host: string): boolean =>
  isPrivateIpHost(host) || host.endsWith(".local");

const resolveExpoHost = (): string | null => {
  const expoConfigHost = parseHost(
    (Constants.expoConfig as { hostUri?: string })?.hostUri
  );
  if (expoConfigHost && isLanHost(expoConfigHost)) {
    return expoConfigHost;
  }

  const manifestHost = parseHost(
    (Constants as unknown as {
      manifest?: { debuggerHost?: string; hostUri?: string };
    }).manifest?.debuggerHost
  );
  if (manifestHost && isLanHost(manifestHost)) {
    return manifestHost;
  }

  const fallbackManifestHost = parseHost(
    (Constants as unknown as {
      manifest?: { debuggerHost?: string; hostUri?: string };
    }).manifest?.hostUri
  );
  if (fallbackManifestHost && isLanHost(fallbackManifestHost)) {
    return fallbackManifestHost;
  }

  return null;
};

const resolveEnvBaseUrl = (): string | null => {
  if (!envBaseUrl) {
    return null;
  }

  if (Platform.OS === "web") {
    return envBaseUrl;
  }

  const host = parseHost(envBaseUrl);
  if (!host) {
    return null;
  }

  if (isLocalhost(host)) {
    const expoHost = resolveExpoHost();
    if (!expoHost) {
      return null;
    }

    try {
      const url = new URL(envBaseUrl);
      url.hostname = expoHost;
      return url.toString();
    } catch {
      return null;
    }
  }

  return envBaseUrl;
};

const resolveDefaultBaseUrl = (): string => {
  return FORCED_API_BASE_URL;
};

const resolveApiBaseUrls = (): string[] => {
  const resolvedEnvBaseUrl = resolveEnvBaseUrl();
  if (resolvedEnvBaseUrl) {
    const primary = normalizeBaseUrl(resolvedEnvBaseUrl);
    if (!__DEV__) {
      const fallbacks = PROD_API_BASE_URLS.map(normalizeBaseUrl).filter(
        (url) => url.toLowerCase() !== primary.toLowerCase()
      );
      return [primary, ...fallbacks];
    }
    return [primary];
  }

  if (!__DEV__) {
    return PROD_API_BASE_URLS.map(normalizeBaseUrl);
  }

  return [normalizeBaseUrl(resolveDefaultBaseUrl())];
};

export const API_BASE_URL_FALLBACKS = resolveApiBaseUrls();

export const API_BASE_URL = API_BASE_URL_FALLBACKS[0];

export const getFallbackApiBaseUrl = (
  currentBaseUrl?: string | null
): string | null => {
  if (API_BASE_URL_FALLBACKS.length < 2) {
    return null;
  }

  if (!currentBaseUrl) {
    return API_BASE_URL_FALLBACKS[1] ?? null;
  }

  const normalizedCurrent = normalizeBaseUrl(currentBaseUrl).toLowerCase();
  const currentIndex = API_BASE_URL_FALLBACKS.findIndex(
    (url) => url.toLowerCase() === normalizedCurrent
  );

  if (currentIndex === -1) {
    return API_BASE_URL_FALLBACKS[0];
  }

  return API_BASE_URL_FALLBACKS[currentIndex + 1] ?? null;
};
