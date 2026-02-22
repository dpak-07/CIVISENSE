import { apiClient } from "@/lib/api";
import { API_BASE_URL, API_BASE_URL_FALLBACKS } from "@/lib/config";
import { sessionStore } from "@/lib/session";
import { Platform } from "react-native";
import { refreshSession } from "@/lib/services/authRefresh";

export type ComplaintImage = {
  url: string;
  uploadedAt?: string;
};

export type ComplaintPriority = {
  score?: number;
  level?: string;
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

export type ComplaintRecord = {
  _id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  createdAt: string;
  updatedAt: string;
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
};

let androidPreferredBaseUrl = API_BASE_URL;

export type ComplaintQuery = {
  reportedBy?: string;
  status?: string;
  category?: string;
  isDuplicate?: boolean;
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
      const fileName = buildImageName(input.imageUri);
      const mimeType = buildMimeType(input.imageUri);

      if (Platform.OS === "web") {
        const imageResponse = await fetch(input.imageUri);
        const imageBlob = await imageResponse.blob();
        const file = new File([imageBlob], fileName, {
          type: imageBlob.type || mimeType,
        });
        formData.append("image", file);
      } else {
        const file = {
          uri: input.imageUri,
          name: fileName,
          type: mimeType,
        };
        formData.append("image", file as unknown as Blob);
      }
    }

    return formData;
  };

  if (Platform.OS === "android") {
    const sendRequest = async (token?: string) => {
      let lastError: Error | null = null;

      for (const baseUrl of getAndroidCandidateBaseUrls()) {
        try {
          const response = await fetch(`${baseUrl}/complaints`, {
            method: "POST",
            headers: {
              Accept: "application/json",
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

    const payload = (await response.json().catch(() => null)) as Envelope<
      CreateComplaintResult
    > | null;

    if (!response.ok) {
      const message = payload?.message || `Request failed (${response.status})`;
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
