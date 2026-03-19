import { apiClient } from "@/lib/api";
import { API_BASE_URL, API_BASE_URL_FALLBACKS } from "@/lib/config";
import { AppLanguage } from "@/lib/preferences";
import { sessionStore } from "@/lib/session";
import { Platform } from "react-native";
import { refreshSession } from "@/lib/services/authRefresh";
import { normalizeMobileUploadUri } from "@/lib/services/uploadUtils";

export type ComplaintImage = {
  url: string;
  uploadedAt?: string;
};

export type ComplaintStatus =
  | "reported"
  | "unassigned"
  | "assigned"
  | "in_progress"
  | "resolved"
  | "rejected";

export type ComplaintPriorityLevel = "critical" | "high" | "medium" | "low";

export type ComplaintPriority = {
  score?: number;
  level?: ComplaintPriorityLevel | string;
  reason?: string | null;
  reasonSentence?: string | null;
  aiProcessed?: boolean;
  aiProcessingStatus?: string;
};

export type AssignedMunicipalOffice = {
  _id: string;
  name: string;
  type?: string;
  zone?: string;
  workload?: number;
  maxCapacity?: number;
  isActive?: boolean;
};

export type ComplaintStatusHistoryEntry = {
  status: ComplaintStatus | string;
  remark?: string | null;
  rejectionReason?: string | null;
  updatedByRole?: string | null;
  updatedAt?: string;
};

export type ComplaintRecord = {
  _id: string;
  title: string;
  description: string;
  category: string;
  status: ComplaintStatus | string;
  createdAt: string;
  updatedAt: string;
  resolutionRemark?: string | null;
  rejectionReason?: string | null;
  statusHistory?: ComplaintStatusHistoryEntry[];
  location?: {
    type: "Point";
    coordinates: [number, number];
  };
  images?: ComplaintImage[];
  priority?: ComplaintPriority;
  assignedMunicipalOffice?: AssignedMunicipalOffice | null;
  assignedOfficeType?: string | null;
  routingDistanceMeters?: number | null;
  routingReason?: string | null;
  duplicateInfo?: {
    isDuplicate: boolean;
    duplicateCount?: number;
  };
};

export type CreateComplaintInput = {
  title: string;
  description: string;
  category: string;
  longitude: number;
  latitude: number;
  imageUri?: string | null;
};

export type CreateComplaintResult = {
  complaint: ComplaintRecord;
  duplicateDetected: boolean;
  masterComplaintId: string | null;
};

type Envelope<T> = {
  success: boolean;
  message?: string;
  data: T;
  details?: unknown;
  error?: string;
};

let androidPreferredBaseUrl = API_BASE_URL;

export type ComplaintQuery = {
  reportedBy?: string;
  status?: string;
  category?: string;
  isDuplicate?: boolean;
  scope?: "all";
};

export type DeleteComplaintResult = {
  deleted: boolean;
  complaintId: string;
};

const buildImageName = (uri: string): string => {
  const lastSegment = uri.split("/").pop() || "issue.jpg";
  return lastSegment.includes(".") ? lastSegment : `${lastSegment}.jpg`;
};

const buildMimeType = (uri: string): string => {
  const lower = uri.toLowerCase();
  if (lower.endsWith(".png")) {
    return "image/png";
  }
  return "image/jpeg";
};

const getRequestLanguage = (): AppLanguage => {
  const userLanguage = sessionStore.getUser()?.language;
  if (userLanguage === "ta" || userLanguage === "hi" || userLanguage === "en") {
    return userLanguage;
  }
  return "en";
};

const parseFetchEnvelope = async <T>(
  response: Response
): Promise<{ envelope: Envelope<T> | null; fallbackMessage: string | null }> => {
  const rawText = await response.text().catch(() => "");
  if (!rawText) {
    return { envelope: null, fallbackMessage: null };
  }

  try {
    const json = JSON.parse(rawText) as Envelope<T>;
    return { envelope: json, fallbackMessage: null };
  } catch {
    const trimmed = rawText.trim();
    return { envelope: null, fallbackMessage: trimmed ? trimmed : null };
  }
};

const formatEnvelopeErrorMessage = (
  payload: Envelope<unknown> | null,
  fallbackMessage: string | null,
  status: number
): string => {
  const base =
    payload?.message ||
    payload?.error ||
    fallbackMessage ||
    `Request failed (${status})`;

  const details = payload?.details;
  if (typeof details === "string" && details.trim()) {
    return `${base}: ${details.trim()}`;
  }
  if (Array.isArray(details) && details.length > 0) {
    return `${base}: ${details.map((item) => String(item)).join("; ")}`;
  }
  if (details && typeof details === "object") {
    const summary = Object.entries(details as Record<string, unknown>)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join("; ");
    if (summary) {
      return `${base}: ${summary}`;
    }
  }

  return base;
};

const toBackendCategory = (category: string): string =>
  category.trim().toLowerCase().replace(/\s+/g, "_");

const getAndroidCandidateBaseUrls = (): string[] => {
  const urls: string[] = [];

  if (androidPreferredBaseUrl) {
    urls.push(androidPreferredBaseUrl);
  }

  for (const url of API_BASE_URL_FALLBACKS) {
    if (!urls.includes(url)) {
      urls.push(url);
    }
  }

  return urls;
};

export const createComplaint = async (
  input: CreateComplaintInput
): Promise<CreateComplaintResult> => {
  const buildFormData = async (): Promise<FormData> => {
    const formData = new FormData();

    formData.append("title", input.title);
    formData.append("description", input.description);
    formData.append("category", toBackendCategory(input.category));
    formData.append("longitude", String(input.longitude));
    formData.append("latitude", String(input.latitude));

    if (input.imageUri) {
      const normalizedUri = await normalizeMobileUploadUri(input.imageUri);
      const fileName = buildImageName(normalizedUri);
      const mimeType = buildMimeType(normalizedUri);

      if (Platform.OS === "web") {
        const imageResponse = await fetch(normalizedUri);
        const imageBlob = await imageResponse.blob();
        const file = new File([imageBlob], fileName, {
          type: imageBlob.type || mimeType,
        });
        formData.append("image", file);
      } else {
        const file = {
          uri: normalizedUri,
          name: fileName,
          type: mimeType,
        };
        formData.append("image", file as unknown as Blob);
      }
    }

    return formData;
  };

  if (Platform.OS === "android") {
    const language = getRequestLanguage();

    const sendRequest = async (token?: string) => {
      let lastError: Error | null = null;

      for (const baseUrl of getAndroidCandidateBaseUrls()) {
        try {
          const response = await fetch(`${baseUrl}/complaints`, {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Accept-Language": language,
              "X-App-Language": language,
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: await buildFormData(),
          });
          androidPreferredBaseUrl = baseUrl;
          return response;
        } catch {
          lastError = new Error("Network Error");
        }
      }

      throw lastError ?? new Error("Network Error");
    };

    let response = await sendRequest(sessionStore.getAccessToken() || undefined);
    if (response.status === 401) {
      const refreshed = await refreshSession();
      if (refreshed?.accessToken) {
        response = await sendRequest(refreshed.accessToken);
      }
    }

    const { envelope: payload, fallbackMessage } =
      await parseFetchEnvelope<CreateComplaintResult>(response);

    if (!response.ok) {
      const message = formatEnvelopeErrorMessage(
        payload as Envelope<unknown> | null,
        fallbackMessage,
        response.status
      );
      throw new Error(message);
    }

    if (!payload?.data) {
      throw new Error("Request failed");
    }

    return payload.data;
  }

  const formData = await buildFormData();
  const response = await apiClient.post<Envelope<CreateComplaintResult>>(
    "/complaints",
    formData
  );

  return response.data.data;
};

export const getMyComplaints = async (): Promise<ComplaintRecord[]> => {
  const user = sessionStore.getUser();

  if (!user) {
    throw new Error("Please log in first");
  }

  const response = await apiClient.get<Envelope<ComplaintRecord[]>>("/complaints", {
    params: {
      reportedBy: user.id,
    },
  });

  return response.data.data;
};

export const getComplaints = async (
  query: ComplaintQuery = {}
): Promise<ComplaintRecord[]> => {
  const params: Record<string, string> = {};

  if (query.reportedBy) {
    params.reportedBy = query.reportedBy;
  }
  if (query.status) {
    params.status = query.status;
  }
  if (query.category) {
    params.category = query.category;
  }
  if (typeof query.isDuplicate === "boolean") {
    params.isDuplicate = query.isDuplicate ? "true" : "false";
  }
  if (query.scope) {
    params.scope = query.scope;
  }

  const response = await apiClient.get<Envelope<ComplaintRecord[]>>("/complaints", {
    params,
  });

  return response.data.data;
};

export const deleteComplaint = async (
  complaintId: string
): Promise<DeleteComplaintResult> => {
  const response = await apiClient.delete<Envelope<DeleteComplaintResult>>(
    `/complaints/${complaintId}`
  );

  return response.data.data;
};
