import { apiClient } from "@/lib/api";
import { normalizeMobileUploadUri } from "@/lib/services/uploadUtils";
import { AuthSession, sessionStore } from "@/lib/session";
import { Platform } from "react-native";

type AuthEnvelope = {
  success: boolean;
  message?: string;
  data: AuthSession;
};

type LoginInput = {
  email: string;
  password: string;
};

type RegisterInput = {
  name: string;
  email: string;
  password: string;
  profilePhotoUri?: string | null;
  otp?: string;
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

const saveSession = (session: AuthSession) => {
  return sessionStore.set(session).then(() => session);
};

export const loginUser = async (input: LoginInput): Promise<AuthSession> => {
  const response = await apiClient.post<AuthEnvelope>("/auth/login", input);
  return saveSession(response.data.data);
};

export const requestRegisterOtp = async (email: string): Promise<void> => {
  await apiClient.post("/auth/register/request-otp", { email });
};

export const registerUser = async (
  input: RegisterInput
): Promise<AuthSession> => {
  if (input.otp) {
    if (input.profilePhotoUri) {
      const formData = new FormData();
      formData.append("name", input.name);
      formData.append("email", input.email);
      formData.append("password", input.password);
      formData.append("otp", input.otp);

      const normalizedUri = await normalizeMobileUploadUri(input.profilePhotoUri);
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

      const response = await apiClient.post<AuthEnvelope>("/auth/register/verify-otp", formData, {
        timeout: 60000,
        headers: {
          Accept: "application/json",
        },
      });
      return saveSession(response.data.data);
    }

    const response = await apiClient.post<AuthEnvelope>("/auth/register/verify-otp", {
      name: input.name,
      email: input.email,
      password: input.password,
      otp: input.otp,
    });
    return saveSession(response.data.data);
  }

  if (input.profilePhotoUri) {
    const formData = new FormData();
    formData.append("name", input.name);
    formData.append("email", input.email);
    formData.append("password", input.password);

    const normalizedUri = await normalizeMobileUploadUri(input.profilePhotoUri);
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

    const response = await apiClient.post<AuthEnvelope>("/auth/register", formData, {
      timeout: 60000,
      headers: {
        Accept: "application/json",
      },
    });
    return saveSession(response.data.data);
  }

  const response = await apiClient.post<AuthEnvelope>("/auth/register", {
    name: input.name,
    email: input.email,
    password: input.password,
  });
  return saveSession(response.data.data);
};

export const logoutUser = async (): Promise<void> => {
  const refreshToken = sessionStore.getRefreshToken();

  try {
    if (refreshToken) {
      await apiClient.post("/auth/logout", { refreshToken });
    }
  } finally {
    await sessionStore.clear();
  }
};
