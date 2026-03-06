import { apiClient } from "@/lib/api";
import { API_BASE_URL, API_BASE_URL_FALLBACKS } from "@/lib/config";

export type BackendHealthStatus = "checking" | "online" | "offline";

type HealthProbeResult = {
  isOnline: boolean;
  activeBaseUrl: string | null;
};

const DEFAULT_HEALTH_TIMEOUT_MS = 5000;

const normalizeBaseUrl = (value: string): string => value.trim().replace(/\/+$/, "");

const deriveHealthUrl = (apiBaseUrl: string): string => {
  const normalizedBaseUrl = normalizeBaseUrl(apiBaseUrl);
  try {
    const parsed = new URL(normalizedBaseUrl);
    const sanitizedPath = parsed.pathname.replace(/\/+$/, "");
    const withoutApiSuffix = sanitizedPath.replace(/\/api$/i, "");
    parsed.pathname = `${withoutApiSuffix || ""}/health`;
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    const withoutApiSuffix = normalizedBaseUrl.replace(/\/api$/i, "");
    return `${withoutApiSuffix}/health`;
  }
};

const buildBaseUrlCandidates = (): string[] => {
  const candidates = [
    apiClient.defaults.baseURL || "",
    API_BASE_URL,
    ...API_BASE_URL_FALLBACKS,
  ]
    .map((item) => item.trim())
    .filter(Boolean)
    .map(normalizeBaseUrl);

  return Array.from(
    new Map(candidates.map((url) => [url.toLowerCase(), url])).values()
  );
};

const readHealthPayload = async (response: Response): Promise<unknown> => {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
};

const isHealthyPayload = (payload: unknown): boolean => {
  if (!payload || typeof payload !== "object") {
    return true;
  }

  const maybeSuccess = (payload as { success?: unknown }).success;
  if (typeof maybeSuccess === "boolean") {
    return maybeSuccess;
  }

  return true;
};

const fetchWithTimeout = async (
  url: string,
  timeoutMs: number
): Promise<Response> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
};

export const probeBackendHealth = async (
  timeoutMs = DEFAULT_HEALTH_TIMEOUT_MS
): Promise<HealthProbeResult> => {
  const baseUrls = buildBaseUrlCandidates();

  for (const baseUrl of baseUrls) {
    const healthUrl = deriveHealthUrl(baseUrl);

    try {
      const response = await fetchWithTimeout(healthUrl, timeoutMs);
      if (!response.ok) {
        continue;
      }

      const payload = await readHealthPayload(response);
      if (!isHealthyPayload(payload)) {
        continue;
      }

      return {
        isOnline: true,
        activeBaseUrl: baseUrl,
      };
    } catch {
      // Continue trying configured fallback base URLs.
    }
  }

  return {
    isOnline: false,
    activeBaseUrl: null,
  };
};
