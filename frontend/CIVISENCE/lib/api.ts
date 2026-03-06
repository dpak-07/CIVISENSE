import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import { API_BASE_URL, getFallbackApiBaseUrl } from "@/lib/config";
import { sessionStore } from "@/lib/session";
import { refreshSession } from "@/lib/services/authRefresh";
import { AppLanguage } from "@/lib/preferences";

type ApiErrorBody = {
  success?: boolean;
  message?: string;
  details?: unknown;
  error?: string;
  errors?: string[] | Record<string, unknown>;
};

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _retriedWithFallback?: boolean;
};

const isNetworkLikeAxiosError = (error: AxiosError<ApiErrorBody>): boolean => {
  if (!error.response) {
    return true;
  }

  const message = (error.message || "").toLowerCase();
  return (
    error.code === "ECONNABORTED" ||
    message.includes("network error") ||
    message.includes("timeout")
  );
};

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
});

let isClearingUnauthorizedSession = false;
let isRefreshingSession = false;
let refreshPromise: Promise<ReturnType<typeof refreshSession>> | null = null;

const getRequestLanguage = (): AppLanguage => {
  const sessionLanguage = sessionStore.getUser()?.language;
  if (sessionLanguage === "ta" || sessionLanguage === "hi" || sessionLanguage === "en") {
    return sessionLanguage;
  }
  return "en";
};

const appendErrorDetails = (message: string, details: unknown): string => {
  if (!details) {
    return message;
  }

  if (Array.isArray(details)) {
    const merged = details
      .map((item) => (typeof item === "string" ? item.trim() : String(item)))
      .filter(Boolean)
      .join("; ");
    return merged ? `${message}: ${merged}` : message;
  }

  if (typeof details === "string") {
    const trimmed = details.trim();
    return trimmed ? `${message}: ${trimmed}` : message;
  }

  if (typeof details === "object") {
    const entries = Object.entries(details as Record<string, unknown>)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join("; ");
    return entries ? `${message}: ${entries}` : message;
  }

  return message;
};

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = sessionStore.getAccessToken();
  const language = getRequestLanguage();

  config.headers["Accept-Language"] = language;
  config.headers["X-App-Language"] = language;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const method = (config.method || "get").toLowerCase();
  if (method === "get") {
    const currentParams = config.params ?? {};
    if (currentParams instanceof URLSearchParams) {
      if (!currentParams.has("lang")) {
        currentParams.set("lang", language);
      }
      config.params = currentParams;
    } else if (
      typeof currentParams === "object" &&
      !Array.isArray(currentParams) &&
      !("lang" in currentParams)
    ) {
      config.params = {
        ...(currentParams as Record<string, unknown>),
        lang: language,
      };
    }
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorBody>) => {
    const status = error.response?.status;
    const originalRequest = error.config as RetryableRequestConfig | undefined;
    const requestUrl = originalRequest?.url || "";
    const isAuthRoute =
      requestUrl.includes("/auth/login") ||
      requestUrl.includes("/auth/register") ||
      requestUrl.includes("/auth/refresh") ||
      requestUrl.includes("/auth/logout");

    if (
      originalRequest &&
      !originalRequest._retriedWithFallback &&
      isNetworkLikeAxiosError(error)
    ) {
      const currentBaseUrl =
        originalRequest.baseURL ?? apiClient.defaults.baseURL ?? API_BASE_URL;
      const fallbackBaseUrl = getFallbackApiBaseUrl(currentBaseUrl);
      if (fallbackBaseUrl) {
        originalRequest._retriedWithFallback = true;
        originalRequest.baseURL = fallbackBaseUrl;
        apiClient.defaults.baseURL = fallbackBaseUrl;
        return apiClient.request(originalRequest);
      }
    }

    if (status === 401 && sessionStore.getAccessToken() && !isAuthRoute) {
      try {
        if (!isRefreshingSession) {
          isRefreshingSession = true;
          refreshPromise = refreshSession();
        }

        const newSession = await refreshPromise;
        if (newSession?.accessToken && originalRequest) {
          originalRequest.headers = originalRequest.headers ?? {};
          originalRequest.headers.Authorization = `Bearer ${newSession.accessToken}`;
          isRefreshingSession = false;
          return apiClient.request(originalRequest);
        }
      } catch {
        // Fall through to clear session.
      } finally {
        isRefreshingSession = false;
        refreshPromise = null;
      }
    }

    if (status === 401 && sessionStore.getAccessToken()) {
      if (!isClearingUnauthorizedSession) {
        isClearingUnauthorizedSession = true;
        try {
          await sessionStore.clear();
        } finally {
          isClearingUnauthorizedSession = false;
        }
      }
    }

    return Promise.reject(error);
  }
);

export const getApiErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ApiErrorBody>;
    const responseData = axiosError.response?.data;
    const baseMessage =
      responseData?.message ||
      responseData?.error ||
      axiosError.message ||
      "Request failed";

    if (!axiosError.response) {
      const lowered = (axiosError.message || "").toLowerCase();
      if (
        axiosError.code === "ECONNABORTED" ||
        lowered.includes("timeout") ||
        lowered.includes("network error")
      ) {
        return "Network error. Please check your internet connection and server URL.";
      }
      return baseMessage;
    }

    if (responseData?.details) {
      return appendErrorDetails(baseMessage, responseData.details);
    }

    if (responseData?.errors) {
      return appendErrorDetails(baseMessage, responseData.errors);
    }

    return baseMessage;
  }

  if (error instanceof Error) {
    const raw = error.message.trim();
    if (raw.startsWith("{") && raw.endsWith("}")) {
      try {
        const parsed = JSON.parse(raw) as ApiErrorBody;
        const parsedMessage = parsed.message || parsed.error;
        if (parsedMessage) {
          if (parsed.details) {
            return appendErrorDetails(parsedMessage, parsed.details);
          }
          if (parsed.errors) {
            return appendErrorDetails(parsedMessage, parsed.errors);
          }
          return parsedMessage;
        }
      } catch {
        // keep original error text
      }
    }
    return error.message;
  }

  return "Unexpected error";
};
