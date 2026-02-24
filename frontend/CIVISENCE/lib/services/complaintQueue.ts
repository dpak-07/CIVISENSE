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
  reviewRequired?: boolean;
  reviewReason?: string;
  reviewNotifiedAt?: string;
  reviewExpiresAt?: string;
  lastErrorMessage?: string;
};

type FlushResult = {
  sent: number;
  remaining: number;
  dropped: number;
  reviewRequired: number;
  expiredRemoved: number;
  skipped: boolean;
};

const QUEUE_STORAGE_KEY = "civisense.complaints.queue.v1";
const QUEUE_DIR = "complaint-queue";
const MAX_QUEUE_SIZE = 50;
const REVIEW_WINDOW_MS = 60 * 60 * 1000;

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

const saveQueue = async (queue: QueuedComplaint[]) => {
  await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
};

const parseIsoMs = (value?: string): number | null => {
  if (!value) {
    return null;
  }
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
};

const pruneExpiredReviewItems = async (
  queue: QueuedComplaint[]
): Promise<{ queue: QueuedComplaint[]; expiredRemoved: number }> => {
  const now = Date.now();
  const kept: QueuedComplaint[] = [];
  let expiredRemoved = 0;

  for (const item of queue) {
    if (!item.reviewRequired) {
      kept.push(item);
      continue;
    }

    const expiryMs = parseIsoMs(item.reviewExpiresAt);
    if (!expiryMs || expiryMs > now) {
      kept.push(item);
      continue;
    }

    expiredRemoved += 1;
    await cleanupImage(item.payload.imageUri);
  }

  return { queue: kept, expiredRemoved };
};

const notifyExpiryRemoval = async (count: number) => {
  if (count <= 0) {
    return;
  }
  const preferences = await getPreferences();
  if (!preferences.notificationsEnabled) {
    return;
  }
  await sendLocalPush(
    "Queued report removed",
    count === 1
      ? "1 queued report was removed after 1 hour without required edits."
      : `${count} queued reports were removed after 1 hour without required edits.`
  );
};

export const getQueuedComplaints = async (): Promise<QueuedComplaint[]> => {
  const queue = await loadQueue();
  const { queue: activeQueue, expiredRemoved } = await pruneExpiredReviewItems(queue);
  if (expiredRemoved > 0) {
    await saveQueue(activeQueue);
  }

  return [...activeQueue].sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  );
};

export const getQueuedComplaintsCount = async (): Promise<number> => {
  const queue = await loadQueue();
  const { queue: activeQueue, expiredRemoved } = await pruneExpiredReviewItems(queue);
  if (expiredRemoved > 0) {
    await saveQueue(activeQueue);
  }
  return activeQueue.length;
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

const isLikelyDuplicateValidationError = (message: string): boolean => {
  const lower = message.toLowerCase();
  return (
    lower.includes("similar complaint") ||
    lower.includes("duplicate") ||
    lower.includes("already submitted")
  );
};

const clampMessage = (message: string): string => {
  const trimmed = message.trim();
  if (!trimmed) {
    return "Validation failed";
  }
  if (trimmed.length > 180) {
    return `${trimmed.slice(0, 177)}...`;
  }
  return trimmed;
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

export const updateQueuedComplaint = async (
  queueId: string,
  updates: { category?: string; description?: string }
): Promise<boolean> => {
  const queue = await loadQueue();
  let found = false;
  const nextCategory = updates.category?.trim();
  const nextDescription = updates.description?.trim();

  const nextQueue = queue.map((item) => {
    if (item.id !== queueId) {
      return item;
    }

    found = true;
    return {
      ...item,
      payload: {
        ...item.payload,
        category: nextCategory || item.payload.category,
        description: nextDescription || item.payload.description,
      },
      attempts: 0,
      reviewRequired: undefined,
      reviewReason: undefined,
      reviewNotifiedAt: undefined,
      reviewExpiresAt: undefined,
      lastErrorMessage: undefined,
    };
  });

  if (!found) {
    return false;
  }

  await saveQueue(nextQueue);
  return true;
};

export const flushQueuedComplaints = async (): Promise<FlushResult> => {
  if (isFlushing) {
    log("Flush skipped, already running");
    return {
      sent: 0,
      remaining: 0,
      dropped: 0,
      reviewRequired: 0,
      expiredRemoved: 0,
      skipped: true,
    };
  }

  isFlushing = true;

  const queue = await loadQueue();
  const { queue: activeQueue, expiredRemoved } = await pruneExpiredReviewItems(queue);
  if (expiredRemoved > 0) {
    await saveQueue(activeQueue);
    try {
      await notifyExpiryRemoval(expiredRemoved);
    } catch {
      // Ignore notification errors.
    }
  }

  if (activeQueue.length === 0) {
    log("Flush skipped, queue empty");
    isFlushing = false;
    return {
      sent: 0,
      remaining: 0,
      dropped: 0,
      reviewRequired: 0,
      expiredRemoved,
      skipped: true,
    };
  }

  if (!sessionStore.getAccessToken()) {
    log("Flush skipped, no access token");
    isFlushing = false;
    return {
      sent: 0,
      remaining: activeQueue.length,
      dropped: 0,
      reviewRequired: activeQueue.filter((item) => item.reviewRequired).length,
      expiredRemoved,
      skipped: true,
    };
  }

  if (await isDefinitelyOffline()) {
    log("Flush skipped, offline");
    isFlushing = false;
    return {
      sent: 0,
      remaining: activeQueue.length,
      dropped: 0,
      reviewRequired: activeQueue.filter((item) => item.reviewRequired).length,
      expiredRemoved,
      skipped: true,
    };
  }

  const remaining: QueuedComplaint[] = [];
  let sent = 0;
  let dropped = 0;
  let reviewRequired = 0;
  let newlyFlaggedForReview = 0;
  const droppedMessages: string[] = [];

  for (let index = 0; index < activeQueue.length; index += 1) {
    const item = activeQueue[index];

    if (item.reviewRequired) {
      reviewRequired += 1;
      remaining.push(item);
      continue;
    }

    try {
      log("Sending queued complaint", item.id);
      await createComplaint(item.payload);
      sent += 1;
      await cleanupImage(item.payload.imageUri);
    } catch (error) {
      const message = getApiErrorMessage(error);
      if (isLikelyNetworkError(error)) {
        log("Network error during flush, stopping", message);
        remaining.push(item, ...activeQueue.slice(index + 1));
        break;
      }

      if (isLikelyDuplicateValidationError(message)) {
        const reviewMessage = clampMessage(message);
        const reviewExpiresAt = new Date(Date.now() + REVIEW_WINDOW_MS).toISOString();
        remaining.push({
          ...item,
          attempts: item.attempts + 1,
          reviewRequired: true,
          reviewReason: reviewMessage,
          reviewNotifiedAt: new Date().toISOString(),
          reviewExpiresAt,
          lastErrorMessage: reviewMessage,
        });
        reviewRequired += 1;
        newlyFlaggedForReview += 1;
        log("Queue item requires category/description update", {
          id: item.id,
          reviewExpiresAt,
        });
        continue;
      }

      log("Non-network error during flush, dropping item", message);
      dropped += 1;
      droppedMessages.push(message);
      await cleanupImage(item.payload.imageUri);
    }
  }

  await saveQueue(remaining);
  log("Flush finished", {
    sent,
    dropped,
    reviewRequired,
    expiredRemoved,
    remaining: remaining.length,
  });
  isFlushing = false;

  if (sent > 0 || dropped > 0 || newlyFlaggedForReview > 0) {
    try {
      const preferences = await getPreferences();
      if (preferences.notificationsEnabled && sent > 0) {
        await sendLocalPush(
          "Queued report sent",
          `${sent} report${sent === 1 ? "" : "s"} sent after reconnecting.`
        );
      }

      if (preferences.notificationsEnabled && dropped > 0) {
        const firstDroppedMessage = droppedMessages[0] || "Validation failed";
        const compactReason =
          firstDroppedMessage.length > 96
            ? `${firstDroppedMessage.slice(0, 93)}...`
            : firstDroppedMessage;
        await sendLocalPush(
          "Queued report removed",
          dropped === 1
            ? `1 queued report was removed: ${compactReason}`
            : `${dropped} queued reports were removed due to server validation errors.`
        );
      }

      if (preferences.notificationsEnabled && newlyFlaggedForReview > 0) {
        await sendLocalPush(
          "Action needed for queued report",
          newlyFlaggedForReview === 1
            ? "1 queued report needs category/description changes within 1 hour."
            : `${newlyFlaggedForReview} queued reports need category/description changes within 1 hour.`
        );
      }
    } catch {
      // Ignore notification errors.
    }
  }

  return {
    sent,
    remaining: remaining.length,
    dropped,
    reviewRequired,
    expiredRemoved,
    skipped: false,
  };
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
