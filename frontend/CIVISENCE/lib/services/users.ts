import { apiClient } from "@/lib/api";
import { AppLanguage } from "@/lib/preferences";
import { normalizeMobileUploadUri } from "@/lib/services/uploadUtils";
import { AuthUser, sessionStore } from "@/lib/session";
import { Platform } from "react-native";

type Envelope<T> = {
  success: boolean;
  message?: string;
  data: T;
};

const buildImageName = (uri: string): string => {
  const lastSegment = uri.split("/").pop() || "profile.jpg";
  return lastSegment.includes(".") ? lastSegment : `${lastSegment}.jpg`;
};

const buildMimeType = (uri: string): string => {
  const lower = uri.toLowerCase();
  if (lower.endsWith(".png")) {
    return "image/png";
  }
  return "image/jpeg";
};

const updateSessionUser = async (user: AuthUser) => {
  const session = sessionStore.get();
  if (!session) {
    return;
  }
  await sessionStore.set({
    ...session,
    user,
  });
};

export const uploadProfilePhoto = async (uri: string): Promise<AuthUser> => {
  const formData = new FormData();
  const normalizedUri = await normalizeMobileUploadUri(uri);
  const fileName = buildImageName(normalizedUri);
  const mimeType = buildMimeType(normalizedUri);

  if (Platform.OS === "web") {
    const imageResponse = await fetch(normalizedUri);
    const imageBlob = await imageResponse.blob();
    const file = new File([imageBlob], fileName, {
      type: imageBlob.type || mimeType,
    });
    formData.append("photo", file);
  } else {
    const file = {
      uri: normalizedUri,
      name: fileName,
      type: mimeType,
    };
    formData.append("photo", file as unknown as Blob);
  }

  const response = await apiClient.post<Envelope<AuthUser>>("/users/profile-photo", formData, {
    timeout: 60000,
    headers: {
      Accept: "application/json",
    },
  });
  const user = response.data.data;
  await updateSessionUser(user);
  return user;
};

export const removeProfilePhoto = async (): Promise<AuthUser> => {
  const response = await apiClient.delete<Envelope<AuthUser>>("/users/profile-photo");
  const user = response.data.data;
  await updateSessionUser(user);
  return user;
};

export const updateUserLanguage = async (language: AppLanguage): Promise<AuthUser> => {
  const response = await apiClient.patch<Envelope<AuthUser>>("/users/preferences/language", {
    language,
  });
  const user = response.data.data;
  await updateSessionUser(user);
  return user;
};

export const deleteAccount = async (): Promise<void> => {
  try {
    await apiClient.delete<Envelope<{ deleted: boolean }>>("/users/account");
  } finally {
    await sessionStore.clear();
  }
};
