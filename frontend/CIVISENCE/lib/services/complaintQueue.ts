import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import * as FileSystem from "expo-file-system";
import { getApiErrorMessage } from "@/lib/api";
import { getPreferences } from "@/lib/preferences";
import { sendLocalPush } from "@/lib/push";
import { sessionStore } from "@/lib/session";
import { API_BASE_URL } from "@/lib/config";
import { CreateComplaintInput, createComplaint } from "@/lib/services/complaints";

export type QueuedComplaint = {
  id: string;
  payload: CreateComplaintInput;
  createdAt: string;
  attempts: number;
};

type FlushResult = {
  sent: number;
  remaining: number;
  skipped: boolean;
};

const QUEUE_STORAGE_KEY = "civisense.complaints.queue.v1";
const QUEUE_DIR = "complaint-queue";
const MAX_QUEUE_SIZE = 50;

let queueSyncInitialized = false;
let unsubscribeNetInfo: (() => void) | null = null;
let isFlushing = false;

const createQueueId = () =>
  `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

const getQueueDirectory = (): string | null => {
  const fileSystem = FileSystem as unknown as { documentDirectory?: string };
  if (!fileSystem.documentDirectory) {
    return null;
  }
  return `${fileSystem.documentDirectory}${QUEUE_DIR}`;
};

const ensureQueueDir = async () => {
  const dir = getQueueDirectory();
  if (!dir) {
    return;
  }
  try {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  } catch {
    // Directory already exists or cannot be created.
  }
};

const persistImage = async (uri: string, id: string): Promise<string> => {
  const dir = getQueueDirectory();
  if (!dir) {
    return uri;
  }

  const extension = uri.split(".").pop() || "jpg";
  const destination = `${dir}/${id}.${extension}`;

  try {
    await ensureQueueDir();
    await FileSystem.copyAsync({ from: uri, to: destination });
    return destination;
  } catch {
    return uri;
  }
};

const cleanupImage = async (uri?: string | null) => {
  if (!uri) {
    return;
  }

  const dir = getQueueDirectory();
  if (!dir || !uri.startsWith(dir)) {
    return;
  }

  try {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  } catch {
    // Ignore cleanup errors.
  }
};

const loadQueue = async (): Promise<QueuedComplaint[]> => {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as QueuedComplaint[];
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch {
    return [];
  }
};

export const getQueuedComplaints = async (): Promise<QueuedComplaint[]> => {
  const queue = await loadQueue();
  return [...queue].sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  );
};

export const getQueuedComplaintsCount = async (): Promise<number> => {
  const queue = await loadQueue();
  return queue.length;
};

const saveQueue = async (queue: QueuedComplaint[]) => {
  await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
};

const isDefinitelyOffline = async (): Promise<boolean> => {
  const state = await NetInfo.fetch();
  log("NetInfo state", {
    isConnected: state.isConnected,
    isInternetReachable: state.isInternetReachable,
    type: state.type,
  });
  return state.isConnected === false;
};

const isLikelyNetworkError = (error: unknown): boolean => {
  const message = getApiErrorMessage(error).toLowerCase();
  return message.includes("network") || message.includes("timeout");
};

const log = (...args: unknown[]) => {
  console.log("[ComplaintQueue]", ...args);
};

export const submitComplaintOrQueue = async (
  payload: CreateComplaintInput
): Promise<{ queued: boolean }> => {
  if (await isDefinitelyOffline()) {
    log("Offline detected, queueing complaint");
    await queueComplaint(payload);
    return { queued: true };
  }

  try {
    log("Attempting to submit complaint to API", { baseUrl: API_BASE_URL });
    await createComplaint(payload);
    return { queued: false };
  } catch (error) {
    if (isLikelyNetworkError(error)) {
      log("Network error, queueing complaint", getApiErrorMessage(error));
      await queueComplaint(payload);
      return { queued: true };
    }
    log("Non-network error, not queued", getApiErrorMessage(error));
    throw error;
  }
};

export const queueComplaint = async (payload: CreateComplaintInput): Promise<void> => {
  const queue = await loadQueue();
  if (queue.length >= MAX_QUEUE_SIZE) {
    log("Queue full, dropping oldest");
    queue.shift();
  }

  const id = createQueueId();
  let persistedImageUri = payload.imageUri ?? null;
  if (payload.imageUri) {
    persistedImageUri = await persistImage(payload.imageUri, id);
  }

  queue.push({
    id,
    payload: {
      ...payload,
      imageUri: persistedImageUri,
    },
    createdAt: new Date().toISOString(),
    attempts: 0,
  });

  await saveQueue(queue);
  log("Queued complaint", { id, queueSize: queue.length });
};

export const flushQueuedComplaints = async (): Promise<FlushResult> => {
  if (isFlushing) {
    log("Flush skipped, already running");
    return { sent: 0, remaining: 0, skipped: true };
  }

  isFlushing = true;

  const queue = await loadQueue();
  if (queue.length === 0) {
    log("Flush skipped, queue empty");
    isFlushing = false;
    return { sent: 0, remaining: 0, skipped: true };
  }

  if (!sessionStore.getAccessToken()) {
    log("Flush skipped, no access token");
    isFlushing = false;
    return { sent: 0, remaining: queue.length, skipped: true };
  }

  if (await isDefinitelyOffline()) {
    log("Flush skipped, offline");
    isFlushing = false;
    return { sent: 0, remaining: queue.length, skipped: true };
  }

  const remaining: QueuedComplaint[] = [];
  let sent = 0;

  for (const item of queue) {
    try {
      log("Sending queued complaint", item.id);
      await createComplaint(item.payload);
      sent += 1;
      await cleanupImage(item.payload.imageUri);
    } catch (error) {
      if (isLikelyNetworkError(error)) {
        log("Network error during flush, stopping", getApiErrorMessage(error));
        remaining.push(item);
        break;
      }
      log("Non-network error during flush, keeping item", getApiErrorMessage(error));
      remaining.push({
        ...item,
        attempts: item.attempts + 1,
      });
    }
  }

  await saveQueue(remaining);
  log("Flush finished", { sent, remaining: remaining.length });
  isFlushing = false;

  if (sent > 0) {
    try {
      const preferences = await getPreferences();
      if (preferences.notificationsEnabled) {
        await sendLocalPush(
          "Queued report sent",
          `${sent} report${sent === 1 ? "" : "s"} sent after reconnecting.`
        );
      }
    } catch {
      // Ignore notification errors.
    }
  }

  return { sent, remaining: remaining.length, skipped: false };
};

export const initComplaintQueueSync = () => {
  if (queueSyncInitialized) {
    return;
  }

  queueSyncInitialized = true;
  void flushQueuedComplaints();

  unsubscribeNetInfo = NetInfo.addEventListener((state) => {
    if (state.isConnected) {
      void flushQueuedComplaints();
    }
  });
};

export const stopComplaintQueueSync = () => {
  if (unsubscribeNetInfo) {
    unsubscribeNetInfo();
    unsubscribeNetInfo = null;
  }
  queueSyncInitialized = false;
};
