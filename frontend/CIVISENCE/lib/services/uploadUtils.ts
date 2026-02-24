import * as FileSystem from "expo-file-system";
import { Platform } from "react-native";

const extractExtension = (uri: string, fallback: string): string => {
  const cleaned = uri.split("?")[0];
  const segment = cleaned.split("/").pop() || "";
  const ext = segment.includes(".") ? segment.split(".").pop() || "" : "";
  const normalized = ext.toLowerCase().replace(/[^a-z0-9]/g, "");
  return normalized || fallback;
};

export const normalizeMobileUploadUri = async (
  uri: string,
  fallbackExtension = "jpg"
): Promise<string> => {
  if (Platform.OS === "web") {
    return uri;
  }

  if (!uri.startsWith("content://")) {
    return uri;
  }

  const baseDirectory = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  if (!baseDirectory) {
    return uri;
  }

  const extension = extractExtension(uri, fallbackExtension);
  const destination = `${baseDirectory}upload-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}.${extension}`;

  try {
    await FileSystem.copyAsync({ from: uri, to: destination });
    return destination;
  } catch {
    return uri;
  }
};

