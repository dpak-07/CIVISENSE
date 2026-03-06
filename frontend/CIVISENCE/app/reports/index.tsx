import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  ImageBackground,
  Modal,
  PanResponder,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getApiErrorMessage } from "@/lib/api";
import { useAppPreferences } from "@/lib/appPreferencesContext";
import { safeBack } from "@/lib/navigation";
import { sessionStore } from "@/lib/session";
import {
  flushQueuedComplaints,
  getQueuedComplaints,
  type QueuedComplaint,
  updateQueuedComplaint,
} from "@/lib/services/complaintQueue";
import {
  ComplaintStatusHistoryEntry,
  ComplaintRecord,
  deleteComplaint,
  getMyComplaints,
} from "@/lib/services/complaints";

const REPORTS_LIVE_POLL_INTERVAL_MS = 12000;
const PRIORITY_RANK: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

const formatDateTime = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getStatusLabel = (status: string): string => {
  switch (status) {
    case "resolved":
      return "Resolved";
    case "in_progress":
      return "In Progress";
    case "assigned":
      return "Assigned";
    case "reported":
      return "Reported";
    case "unassigned":
      return "Unassigned";
    case "rejected":
      return "Rejected";
    default:
      return "Reported";
  }
};

const getStatusColor = (status: string): string => {
  switch (status) {
    case "resolved":
      return "#10b981";
    case "in_progress":
      return "#f59e0b";
    case "assigned":
      return "#3b82f6";
    case "reported":
    case "unassigned":
      return "#64748b";
    case "rejected":
      return "#ef4444";
    default:
      return "#64748b";
  }
};

const getPriorityLabel = (priority?: string): string => {
  switch (priority) {
    case "critical":
      return "Critical";
    case "high":
      return "High";
    case "medium":
      return "Medium";
    case "low":
      return "Low";
    default:
      return "Low";
  }
};

const getPriorityRank = (priority?: string): number =>
  PRIORITY_RANK[(priority || "low").toLowerCase()] ?? 0;

const getAssignedOffice = (item: ComplaintRecord): string => {
  if (item.assignedMunicipalOffice?.name) {
    return item.assignedMunicipalOffice.name;
  }
  if (item.assignedOfficeType) {
    return item.assignedOfficeType.replace("_", " ");
  }
  return "Pending assignment";
};

const getPriorityReason = (item: ComplaintRecord): string =>
  item.priority?.reasonSentence ||
  item.priority?.reason ||
  "Priority explanation is not available yet.";

const hasText = (value?: string | null): value is string =>
  typeof value === "string" && value.trim().length > 0;

const toDisplayText = (value?: string | null): string | null =>
  hasText(value) ? value.trim() : null;

const toReadableStatus = (status?: string): string =>
  (status || "reported")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const toReadableRole = (role?: string | null): string | null => {
  if (!hasText(role)) {
    return null;
  }
  return role
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const toTimestamp = (value?: string): number => {
  if (!value) {
    return 0;
  }
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
};

const getLatestStatusHistoryEntry = (
  report: ComplaintRecord,
  status: string
): ComplaintStatusHistoryEntry | null => {
  const history = report.statusHistory || [];
  const candidates = history.filter((entry) => entry.status === status);
  if (candidates.length === 0) {
    return null;
  }
  return [...candidates].sort(
    (left, right) => toTimestamp(right.updatedAt) - toTimestamp(left.updatedAt)
  )[0];
};

const getResolutionRemark = (report: ComplaintRecord): string | null => {
  const fromTopLevel = toDisplayText(report.resolutionRemark);
  if (fromTopLevel) {
    return fromTopLevel;
  }
  return toDisplayText(getLatestStatusHistoryEntry(report, "resolved")?.remark);
};

const getRejectionReason = (report: ComplaintRecord): string | null => {
  const fromTopLevel = toDisplayText(report.rejectionReason);
  if (fromTopLevel) {
    return fromTopLevel;
  }

  const rejectedHistory = getLatestStatusHistoryEntry(report, "rejected");
  return (
    toDisplayText(rejectedHistory?.rejectionReason) ||
    toDisplayText(rejectedHistory?.remark)
  );
};

const getTimelineSubtitle = (
  report: ComplaintRecord,
  entry: ComplaintStatusHistoryEntry
): string => {
  const status = entry.status || "reported";
  const role = toReadableRole(entry.updatedByRole);
  const remark = toDisplayText(entry.remark);
  const rejectionReason =
    toDisplayText(entry.rejectionReason) ||
    (status === "rejected" ? getRejectionReason(report) : null);

  if (status === "resolved") {
    const resolutionRemark = remark || getResolutionRemark(report);
    return resolutionRemark
      ? `Resolved note: ${resolutionRemark}`
      : "Issue marked as resolved by municipality";
  }

  if (status === "rejected") {
    return rejectionReason
      ? `Rejected reason: ${rejectionReason}`
      : "Marked as invalid by municipality";
  }

  if (status === "assigned") {
    const office = getAssignedOffice(report);
    return office !== "Pending assignment"
      ? `Assigned to ${office}`
      : "Assigned to municipal office";
  }

  if (status === "in_progress") {
    if (remark) {
      return `Progress note: ${remark}`;
    }
    const office = getAssignedOffice(report);
    return office !== "Pending assignment"
      ? `Work in progress with ${office}`
      : "Work in progress";
  }

  if (status === "unassigned" || status === "reported") {
    return remark || "Awaiting municipal assignment";
  }

  if (remark) {
    return remark;
  }

  return role ? `Updated by ${role}` : "Status updated";
};

const getCardReasonLabel = (item: ComplaintRecord): string => {
  if (item.status === "resolved") {
    return "Resolution Remark";
  }
  if (item.status === "rejected") {
    return "Rejection Reason";
  }
  return "Priority Reason";
};

const getCardReasonText = (item: ComplaintRecord): string => {
  if (item.status === "resolved") {
    return getResolutionRemark(item) || "Issue resolved by municipal office.";
  }
  if (item.status === "rejected") {
    return getRejectionReason(item) || "Complaint rejected by municipality.";
  }
  return getPriorityReason(item);
};

const sortReportsByPriority = (reports: ComplaintRecord[]): ComplaintRecord[] =>
  [...reports].sort((left, right) => {
    const priorityDiff =
      getPriorityRank(right.priority?.level) - getPriorityRank(left.priority?.level);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    const unresolvedDiff =
      Number(isUnresolved(right.status)) - Number(isUnresolved(left.status));
    if (unresolvedDiff !== 0) {
      return unresolvedDiff;
    }

    return (
      toTimestamp(right.updatedAt || right.createdAt) -
      toTimestamp(left.updatedAt || left.createdAt)
    );
  });

const getLocationText = (item: ComplaintRecord): string => {
  const coordinates = item.location?.coordinates;
  if (!coordinates || coordinates.length !== 2) {
    return "Location not available";
  }

  const [longitude, latitude] = coordinates;
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
};

const getQueueCoordinates = (item: QueuedComplaint): string =>
  `${item.payload.latitude.toFixed(4)}, ${item.payload.longitude.toFixed(4)}`;

const getReviewExpiryLabel = (expiresAt?: string): string => {
  if (!expiresAt) {
    return "within 1 hour";
  }
  const expiryMs = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiryMs)) {
    return "within 1 hour";
  }
  const deltaMs = expiryMs - Date.now();
  if (deltaMs <= 0) {
    return "now";
  }
  const totalMinutes = Math.ceil(deltaMs / 60000);
  if (totalMinutes >= 60) {
    const hours = Math.ceil(totalMinutes / 60);
    return `in ${hours}h`;
  }
  return `in ${totalMinutes}m`;
};

const isUnresolved = (status: string): boolean =>
  status !== "resolved" && status !== "rejected";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const SHEET_COLLAPSED_HEIGHT = 176;
const SHEET_EXPANDED_HEIGHT = Math.min(SCREEN_HEIGHT * 0.78, SCREEN_HEIGHT - 110);
const SHEET_MAX_TRANSLATE = SHEET_EXPANDED_HEIGHT - SHEET_COLLAPSED_HEIGHT;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const isAuthLikeErrorMessage = (message: string): boolean => {
  const lower = message.toLowerCase();
  return (
    lower.includes("authorization") ||
    lower.includes("unauthorized") ||
    lower.includes("token") ||
    lower.includes("forbidden")
  );
};

const isNetworkLikeErrorMessage = (message: string): boolean => {
  const lower = message.toLowerCase();
  return (
    lower.includes("network") ||
    lower.includes("offline") ||
    lower.includes("timeout") ||
    lower.includes("failed to fetch") ||
    lower.includes("internet")
  );
};

type TimelineEvent = {
  title: string;
  subtitle: string;
  at: string;
  color: string;
};

const buildTimeline = (report: ComplaintRecord): TimelineEvent[] => {
  const events: TimelineEvent[] = [
    {
      title: "Complaint reported",
      subtitle: "Submitted by you",
      at: report.createdAt,
      color: "#2563eb",
    },
  ];

  if (report.priority?.level) {
    events.push({
      title: `Priority set: ${getPriorityLabel(report.priority.level)}`,
      subtitle: getPriorityReason(report),
      at: report.updatedAt || report.createdAt,
      color: "#f59e0b",
    });
  }

  const history = report.statusHistory || [];
  if (history.length > 0) {
    const statusEvents = [...history]
      .sort(
        (left, right) => toTimestamp(left.updatedAt) - toTimestamp(right.updatedAt)
      )
      .map((entry) => ({
        title: `Status: ${toReadableStatus(entry.status)}`,
        subtitle: getTimelineSubtitle(report, entry),
        at: entry.updatedAt || report.updatedAt || report.createdAt,
        color: getStatusColor(entry.status || report.status),
      }));

    events.push(...statusEvents);
  } else {
    const office = getAssignedOffice(report);
    if (
      report.status === "assigned" ||
      report.status === "in_progress" ||
      report.status === "resolved"
    ) {
      events.push({
        title: "Assigned to office",
        subtitle: office,
        at: report.updatedAt || report.createdAt,
        color: "#4f46e5",
      });
    }

    if (report.status === "reported" || report.status === "unassigned") {
      events.push({
        title: "Awaiting assignment",
        subtitle: "Municipal office will be assigned soon",
        at: report.updatedAt || report.createdAt,
        color: "#64748b",
      });
    }

    if (report.status === "in_progress") {
      events.push({
        title: "Work in progress",
        subtitle: `Active with ${office}`,
        at: report.updatedAt || report.createdAt,
        color: "#f59e0b",
      });
    }

    if (report.status === "resolved") {
      events.push({
        title: "Complaint resolved",
        subtitle:
          getResolutionRemark(report) || `Closed by ${office}`,
        at: report.updatedAt || report.createdAt,
        color: "#10b981",
      });
    }

    if (report.status === "rejected") {
      events.push({
        title: "Complaint rejected",
        subtitle:
          getRejectionReason(report) || "Marked as invalid by municipality",
        at: report.updatedAt || report.createdAt,
        color: "#ef4444",
      });
    }
  }

  return events.sort(
    (left, right) => new Date(left.at).getTime() - new Date(right.at).getTime()
  );
};

const QueueSection = ({
  queuedItems,
  syncing,
  onSync,
  onEditQueued,
  helperText,
  palette,
}: {
  queuedItems: QueuedComplaint[];
  syncing: boolean;
  onSync: () => Promise<void>;
  onEditQueued: (item: QueuedComplaint) => void;
  helperText?: string | null;
  palette: {
    card: string;
    cardSoft: string;
    border: string;
    text: string;
    subtext: string;
    accent: string;
  };
}) => {
  return (
    <View style={[styles.queueWrap, { backgroundColor: palette.card }]}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>Queued Complaints</Text>
        <Pressable
          style={[
            styles.syncButton,
            { borderColor: palette.border, backgroundColor: palette.cardSoft },
            syncing && styles.syncButtonDisabled,
          ]}
          onPress={() => void onSync()}
          disabled={syncing}
        >
          {syncing ? (
            <ActivityIndicator size="small" color={palette.accent} />
          ) : (
            <>
              <Ionicons name="sync" size={14} color={palette.accent} />
              <Text style={[styles.syncButtonText, { color: palette.accent }]}>Sync</Text>
            </>
          )}
        </Pressable>
      </View>

      {queuedItems.length === 0 ? (
        <View style={[styles.queueEmpty, { backgroundColor: palette.cardSoft }]}>
          <Ionicons name="cloud-done-outline" size={18} color={palette.subtext} />
          <Text style={[styles.queueEmptyText, { color: palette.subtext }]}>No queued complaints.</Text>
        </View>
      ) : (
        <View style={styles.queueList}>
          {queuedItems.map((item) => (
            <View key={item.id} style={[styles.queueItem, { borderColor: palette.border }]}>
              <View style={styles.queueTopRow}>
                <Text style={[styles.queueCategory, { color: palette.text }]}>{item.payload.category}</Text>
                <Text style={[styles.queueDate, { color: palette.subtext }]}>{formatDateTime(item.createdAt)}</Text>
              </View>
              <Text style={[styles.queueMeta, { color: palette.subtext }]}>
                {getQueueCoordinates(item)} | Attempts: {item.attempts}
              </Text>
              {item.reviewRequired ? (
                <View style={[styles.queueWarningWrap, { backgroundColor: palette.cardSoft }]}>
                  <Ionicons name="warning-outline" size={14} color="#b45309" />
                  <Text style={[styles.queueWarningText, { color: palette.subtext }]}>
                    Duplicate-like error. Update category/description {getReviewExpiryLabel(item.reviewExpiresAt)} or this queued item will be removed.
                  </Text>
                </View>
              ) : null}
              <View style={styles.queueActionsRow}>
                <Pressable
                  onPress={() => onEditQueued(item)}
                  style={[styles.queueEditButton, { borderColor: palette.border, backgroundColor: palette.cardSoft }]}
                >
                  <Ionicons name="create-outline" size={13} color={palette.accent} />
                  <Text style={[styles.queueEditButtonText, { color: palette.accent }]}>Edit</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}
      {helperText ? (
        <Text style={[styles.queueHelperText, { color: palette.subtext }]}>{helperText}</Text>
      ) : null}
    </View>
  );
};

export default function ReportsScreen() {
  const insets = useSafeAreaInsets();
  const { preferences } = useAppPreferences();
  const isDark = preferences.darkMode;
  const [authMissing, setAuthMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncingQueue, setSyncingQueue] = useState(false);
  const [deletingReport, setDeletingReport] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ComplaintRecord | null>(null);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [reports, setReports] = useState<ComplaintRecord[]>([]);
  const [queuedItems, setQueuedItems] = useState<QueuedComplaint[]>([]);
  const [syncInfoMessage, setSyncInfoMessage] = useState<string | null>(null);
  const [editingQueueItem, setEditingQueueItem] = useState<QueuedComplaint | null>(null);
  const [editQueueCategory, setEditQueueCategory] = useState("");
  const [editQueueDescription, setEditQueueDescription] = useState("");
  const [savingQueueEdit, setSavingQueueEdit] = useState(false);
  const sheetTranslateY = useRef(new Animated.Value(SHEET_MAX_TRANSLATE)).current;
  const sheetCurrentYRef = useRef(SHEET_MAX_TRANSLATE);
  const sheetStartYRef = useRef(SHEET_MAX_TRANSLATE);
  const sheetExpandedRef = useRef(false);
  const detailScrollOffsetRef = useRef(0);

  useEffect(() => {
    const id = sheetTranslateY.addListener(({ value }) => {
      sheetCurrentYRef.current = value;
    });

    return () => {
      sheetTranslateY.removeListener(id);
    };
  }, [sheetTranslateY]);

  useEffect(() => {
    if (!selectedReport) {
      return;
    }

    sheetTranslateY.setValue(SHEET_MAX_TRANSLATE);
    setSheetExpanded(false);
    sheetExpandedRef.current = false;
    detailScrollOffsetRef.current = 0;
  }, [selectedReport, sheetTranslateY]);

  const animateSheetTo = useCallback(
    (toValue: number) => {
      Animated.spring(sheetTranslateY, {
        toValue,
        useNativeDriver: true,
        speed: 15,
        bounciness: 0,
      }).start(({ finished }) => {
        if (!finished) {
          return;
        }

        const expanded = toValue === 0;
        sheetExpandedRef.current = expanded;
        setSheetExpanded(expanded);
      });
    },
    [sheetTranslateY]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
          const isVertical = Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
          if (!isVertical || Math.abs(gestureState.dy) < 5) {
            return false;
          }

          if (!sheetExpandedRef.current) {
            return true;
          }

          return gestureState.dy > 0 && detailScrollOffsetRef.current <= 0;
        },
        onPanResponderGrant: () => {
          sheetStartYRef.current = sheetCurrentYRef.current;
        },
        onPanResponderMove: (_, gestureState) => {
          if (sheetExpandedRef.current && gestureState.dy < 0) {
            return;
          }

          const next = clamp(
            sheetStartYRef.current + gestureState.dy,
            0,
            SHEET_MAX_TRANSLATE
          );
          sheetTranslateY.setValue(next);
        },
        onPanResponderRelease: (_, gestureState) => {
          const projected = sheetCurrentYRef.current + gestureState.vy * 65;
          const shouldExpand = projected < SHEET_MAX_TRANSLATE / 2;
          animateSheetTo(shouldExpand ? 0 : SHEET_MAX_TRANSLATE);
        },
        onPanResponderTerminate: () => {
          const shouldExpand = sheetCurrentYRef.current < SHEET_MAX_TRANSLATE / 2;
          animateSheetTo(shouldExpand ? 0 : SHEET_MAX_TRANSLATE);
        },
      }),
    [animateSheetTo, sheetTranslateY]
  );

  const loadData = useCallback(
    async ({
      isRefresh = false,
      silent = false,
    }: { isRefresh?: boolean; silent?: boolean } = {}) => {
    const token = sessionStore.getAccessToken();
    const user = sessionStore.getUser();

    if (!token || !user?.id) {
      setAuthMissing(true);
      setReports([]);
      setQueuedItems([]);
      setSyncInfoMessage(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setAuthMissing(false);
    if (isRefresh) {
      setRefreshing(true);
    } else if (!silent) {
      setLoading(true);
    }

    let queue: QueuedComplaint[] = [];
    try {
      queue = await getQueuedComplaints();
      setQueuedItems(queue);
    } catch {
      queue = [];
      setQueuedItems([]);
    }

    try {
      const complaints = await getMyComplaints();
      setReports(sortReportsByPriority(complaints));
      setSyncInfoMessage(null);
    } catch (error) {
      const message = getApiErrorMessage(error);
      if (isAuthLikeErrorMessage(message)) {
        setAuthMissing(true);
        setReports([]);
        setSyncInfoMessage(null);
      } else if (isNetworkLikeErrorMessage(message)) {
        setSyncInfoMessage(
          queue.length > 0
            ? "No internet. Queued complaints are shown and will appear in My Reports after network returns."
            : "No internet. Pull to refresh after network returns."
        );
      } else {
        Alert.alert("Failed to load reports", message);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
      setRefreshing(false);
    }
    },
    []
  );

  const syncQueue = useCallback(async () => {
    setSyncingQueue(true);
    try {
      const result = await flushQueuedComplaints();
      await loadData({ isRefresh: true });

      if (result.sent > 0) {
        Alert.alert(
          "Queue synced",
          `${result.sent} complaint${result.sent === 1 ? "" : "s"} uploaded.`
        );
      } else if (result.reviewRequired > 0) {
        Alert.alert(
          "Action needed",
          `${result.reviewRequired} queued complaint${result.reviewRequired === 1 ? "" : "s"} need category/description updates within 1 hour.`
        );
      } else if (result.dropped > 0) {
        Alert.alert(
          "Queue updated",
          `${result.dropped} queued complaint${result.dropped === 1 ? "" : "s"} removed due to validation errors (for example duplicate reports).`
        );
      } else if (result.remaining > 0) {
        Alert.alert(
          "Queue pending",
          `${result.remaining} complaint${result.remaining === 1 ? "" : "s"} still queued.`
        );
      } else {
        Alert.alert("Queue empty", "No queued complaints to sync.");
      }
    } catch (error) {
      Alert.alert("Sync failed", getApiErrorMessage(error));
    } finally {
      setSyncingQueue(false);
    }
  }, [loadData]);

  const openQueueEditor = useCallback((item: QueuedComplaint) => {
    setEditingQueueItem(item);
    setEditQueueCategory(item.payload.category || "");
    setEditQueueDescription(item.payload.description || "");
  }, []);

  const saveQueueEdit = useCallback(async () => {
    if (!editingQueueItem) {
      return;
    }

    const nextCategory = editQueueCategory.trim();
    const nextDescription = editQueueDescription.trim();
    if (!nextCategory) {
      Alert.alert("Category required", "Please enter a category.");
      return;
    }
    if (nextDescription.length > 0 && nextDescription.length < 10) {
      Alert.alert("Description too short", "Description should be at least 10 characters.");
      return;
    }

    try {
      setSavingQueueEdit(true);
      const updated = await updateQueuedComplaint(editingQueueItem.id, {
        category: nextCategory,
        description: nextDescription,
      });
      if (!updated) {
        Alert.alert("Update failed", "Queued complaint was not found.");
        return;
      }

      await flushQueuedComplaints();
      await loadData({ isRefresh: true });
      setEditingQueueItem(null);
      Alert.alert(
        "Queued complaint updated",
        "Changes saved. The app will retry sending this complaint."
      );
    } catch (error) {
      Alert.alert("Update failed", getApiErrorMessage(error));
    } finally {
      setSavingQueueEdit(false);
    }
  }, [editQueueCategory, editQueueDescription, editingQueueItem, loadData]);

  const handleDeleteUnresolvedReport = useCallback((report: ComplaintRecord) => {
    if (!isUnresolved(report.status)) {
      Alert.alert(
        "Cannot delete",
        "Only unresolved complaints can be deleted."
      );
      return;
    }

    Alert.alert(
      "Delete complaint?",
      "This unresolved complaint will be permanently deleted.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                setDeletingReport(true);
                await deleteComplaint(report._id);
                setReports((prev) => prev.filter((item) => item._id !== report._id));
                setSelectedReport(null);
                Alert.alert("Deleted", "Complaint deleted successfully.");
              } catch (error) {
                Alert.alert("Delete failed", getApiErrorMessage(error));
              } finally {
                setDeletingReport(false);
              }
            })();
          },
        },
      ]
    );
  }, []);

  useEffect(() => {
    if (!selectedReport) {
      return;
    }
    const latest = reports.find((item) => item._id === selectedReport._id);
    if (!latest) {
      setSelectedReport(null);
      return;
    }
    if (
      latest.status !== selectedReport.status ||
      latest.updatedAt !== selectedReport.updatedAt ||
      latest.resolutionRemark !== selectedReport.resolutionRemark ||
      latest.rejectionReason !== selectedReport.rejectionReason
    ) {
      setSelectedReport(latest);
    }
  }, [reports, selectedReport]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
      const timer = setInterval(() => {
        void loadData({ silent: true });
      }, REPORTS_LIVE_POLL_INTERVAL_MS);

      return () => clearInterval(timer);
    }, [loadData])
  );

  const unresolvedCount = useMemo(
    () => reports.filter((item) => isUnresolved(item.status)).length,
    [reports]
  );

  const palette = useMemo(
    () =>
      isDark
        ? {
            screenGradient: ["#0B1020", "#121C32"] as const,
            card: "#131C31",
            cardSoft: "#1B2642",
            border: "rgba(148,163,184,0.25)",
            text: "#F8FAFC",
            subtext: "#A3B3CF",
            accent: "#A5B4FC",
            buttonBg: "#1E293B",
            buttonIcon: "#F8FAFC",
            emptyIcon: "#94A3B8",
          }
        : {
            screenGradient: ["#EEF2FF", "#F8FAFF"] as const,
            card: "#FFFFFF",
            cardSoft: "#F8FAFF",
            border: "#E2E8F0",
            text: "#0F172A",
            subtext: "#64748B",
            accent: "#4F46E5",
            buttonBg: "rgba(255,255,255,0.9)",
            buttonIcon: "#1E293B",
            emptyIcon: "#94A3B8",
          },
    [isDark]
  );

  if (loading) {
    return (
      <View style={[styles.loadingWrap, { backgroundColor: isDark ? "#0B1020" : "#f8fafc" }]}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={[styles.loadingText, { color: palette.subtext }]}>Loading reports...</Text>
      </View>
    );
  }

  if (authMissing) {
    return (
      <LinearGradient colors={palette.screenGradient as any} style={styles.container}>
        <View style={[styles.authCard, { backgroundColor: palette.card }]}>
          <Ionicons name="lock-closed" size={48} color="#2563eb" />
          <Text style={[styles.authTitle, { color: palette.text }]}>Login required</Text>
          <Text style={[styles.authText, { color: palette.subtext }]}>
            Sign in to view your reports and queued complaints.
          </Text>
          <Pressable style={[styles.authButton, { backgroundColor: palette.accent }]} onPress={() => router.push("/auth")}>
            <Text style={styles.authButtonText}>Go to Login</Text>
          </Pressable>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={palette.screenGradient as any} style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => safeBack("/")} style={[styles.headerButton, { backgroundColor: palette.buttonBg }]}>
          <Ionicons name="arrow-back" size={22} color={palette.buttonIcon} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: palette.text }]}>My Reports</Text>
          <Text style={[styles.headerSubtitle, { color: palette.subtext }]}>Queue and full complaint history</Text>
        </View>
        <Pressable
          onPress={() => void loadData({ isRefresh: true })}
          style={[styles.headerButton, { backgroundColor: palette.buttonBg }]}
        >
          <Ionicons name="refresh" size={22} color={palette.buttonIcon} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadData({ isRefresh: true })}
            />
          }
      >
        {syncInfoMessage ? (
          <View style={[styles.syncInfoCard, { backgroundColor: palette.card }]}>
            <Ionicons name="cloud-offline-outline" size={16} color={palette.subtext} />
            <Text style={[styles.syncInfoText, { color: palette.subtext }]}>{syncInfoMessage}</Text>
          </View>
        ) : null}
        <View style={styles.statRow}>
          <View style={[styles.statCard, { backgroundColor: palette.card }]}>
            <Text style={[styles.statLabel, { color: palette.subtext }]}>Total Reports</Text>
            <Text style={[styles.statValue, { color: palette.text }]}>{reports.length}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: palette.card }]}>
            <Text style={[styles.statLabel, { color: palette.subtext }]}>Unresolved</Text>
            <Text style={[styles.statValue, { color: palette.text }]}>{unresolvedCount}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: palette.card }]}>
            <Text style={[styles.statLabel, { color: palette.subtext }]}>Queued</Text>
            <Text style={[styles.statValue, { color: palette.text }]}>{queuedItems.length}</Text>
          </View>
        </View>

        <QueueSection
          queuedItems={queuedItems}
          syncing={syncingQueue}
          onSync={syncQueue}
          onEditQueued={openQueueEditor}
          helperText="Queued complaints will upload automatically when internet is available."
          palette={palette}
        />

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>All My Reports</Text>
        </View>

        {reports.length === 0 ? (
          <View style={[styles.emptyReports, { backgroundColor: palette.card }]}>
            <Ionicons name="document-text-outline" size={48} color={palette.emptyIcon} />
            <Text style={[styles.emptyTitle, { color: palette.text }]}>No reports yet</Text>
            <Text style={[styles.emptyText, { color: palette.subtext }]}>Create your first complaint from the report page.</Text>
            <Pressable style={[styles.emptyButton, { backgroundColor: palette.accent }]} onPress={() => router.push("/report")}>
              <Text style={styles.emptyButtonText}>Report an Issue</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={reports}
            scrollEnabled={false}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => {
              const statusColor = getStatusColor(item.status);
              const priorityLabel = getPriorityLabel(item.priority?.level);
              const assignedOffice = getAssignedOffice(item);
              const reasonLabel = getCardReasonLabel(item);
              const reason = getCardReasonText(item);

              return (
                <Pressable onPress={() => setSelectedReport(item)}>
                  <View style={[styles.reportCard, { backgroundColor: palette.card }]}>
                    <View style={styles.reportTopRow}>
                      <Text style={[styles.reportTitle, { color: palette.text }]} numberOfLines={2}>
                        {item.title}
                      </Text>
                      <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
                        <Text style={[styles.statusText, { color: statusColor }]}>
                          {getStatusLabel(item.status)}
                        </Text>
                      </View>
                    </View>

                    <Text style={[styles.reportMeta, { color: palette.subtext }]}>{formatDateTime(item.createdAt)}</Text>
                    <Text style={[styles.reportDesc, { color: palette.subtext }]} numberOfLines={3}>
                      {item.description}
                    </Text>

                    <View style={styles.chipRow}>
                      <View style={[styles.chip, { backgroundColor: palette.cardSoft }]}>
                        <Ionicons name="flag-outline" size={12} color={palette.subtext} />
                        <Text style={[styles.chipText, { color: palette.subtext }]}>Priority: {priorityLabel}</Text>
                      </View>
                      <View style={[styles.chip, { backgroundColor: palette.cardSoft }]}>
                        <Ionicons name="business-outline" size={12} color={palette.subtext} />
                        <Text style={[styles.chipText, { color: palette.subtext }]} numberOfLines={1}>
                          {assignedOffice}
                        </Text>
                      </View>
                    </View>

                    <Text style={[styles.reasonLabel, { color: palette.subtext }]}>{reasonLabel}</Text>
                    <Text style={[styles.reasonText, { color: palette.subtext }]} numberOfLines={3}>
                      {reason}
                    </Text>

                    <View style={styles.openHintRow}>
                      <Ionicons name="open-outline" size={12} color={palette.subtext} />
                      <Text style={[styles.openHintText, { color: palette.subtext }]}>Tap to open details</Text>
                    </View>
                  </View>
                </Pressable>
              );
            }}
          />
        )}
      </ScrollView>

      <Modal
        visible={Boolean(editingQueueItem)}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!savingQueueEdit) {
            setEditingQueueItem(null);
          }
        }}
      >
        <View style={styles.queueEditModalOverlay}>
          <View style={[styles.queueEditModalCard, { backgroundColor: palette.card }]}>
            <Text style={[styles.queueEditTitle, { color: palette.text }]}>Update queued complaint</Text>
            <Text style={[styles.queueEditSub, { color: palette.subtext }]}>
              If unchanged for 1 hour after duplicate warning, it will be removed.
            </Text>

            <Text style={[styles.queueEditLabel, { color: palette.subtext }]}>Category</Text>
            <TextInput
              value={editQueueCategory}
              onChangeText={setEditQueueCategory}
              placeholder="Category"
              placeholderTextColor={palette.subtext}
              style={[
                styles.queueEditInput,
                {
                  color: palette.text,
                  borderColor: palette.border,
                  backgroundColor: palette.cardSoft,
                },
              ]}
            />

            <Text style={[styles.queueEditLabel, { color: palette.subtext }]}>Description</Text>
            <TextInput
              value={editQueueDescription}
              onChangeText={setEditQueueDescription}
              placeholder="Description"
              placeholderTextColor={palette.subtext}
              multiline
              textAlignVertical="top"
              style={[
                styles.queueEditTextArea,
                {
                  color: palette.text,
                  borderColor: palette.border,
                  backgroundColor: palette.cardSoft,
                },
              ]}
            />

            <View style={styles.queueEditActions}>
              <Pressable
                onPress={() => setEditingQueueItem(null)}
                disabled={savingQueueEdit}
                style={[styles.queueEditCancel, { borderColor: palette.border }]}
              >
                <Text style={[styles.queueEditCancelText, { color: palette.subtext }]}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => void saveQueueEdit()}
                disabled={savingQueueEdit}
                style={[styles.queueEditSave, { backgroundColor: palette.accent }]}
              >
                {savingQueueEdit ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.queueEditSaveText}>Save & Retry</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(selectedReport)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedReport(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.heroWrap}>
              {selectedReport?.images?.[0]?.url ? (
                <ImageBackground
                  source={{ uri: selectedReport.images[0].url }}
                  style={styles.heroImage}
                  resizeMode="cover"
                >
                  <LinearGradient
                    colors={["rgba(15,23,42,0.05)", "rgba(15,23,42,0.85)"]}
                    style={styles.heroOverlay}
                  />
                </ImageBackground>
              ) : (
                <LinearGradient
                  colors={["#334155", "#0f172a"]}
                  style={styles.heroImage}
                />
              )}

              <Pressable
                onPress={() => setSelectedReport(null)}
                style={styles.modalCloseFloating}
              >
                <Ionicons name="close" size={20} color="#ffffff" />
              </Pressable>

              <View style={styles.heroContent}>
                <View style={styles.heroMetaPill}>
                  <Ionicons name="calendar-outline" size={12} color="#e2e8f0" />
                  <Text style={styles.heroMetaText} numberOfLines={1}>
                    {selectedReport ? formatDateTime(selectedReport.createdAt) : "-"}
                  </Text>
                </View>
                {selectedReport ? (
                  <View
                    style={[
                      styles.heroStatusPill,
                      { backgroundColor: `${getStatusColor(selectedReport.status)}33` },
                    ]}
                  >
                    <Text style={styles.heroStatusText}>
                      {getStatusLabel(selectedReport.status)}
                    </Text>
                  </View>
                ) : null}
                <Text style={styles.heroTitle} numberOfLines={2}>
                  {selectedReport?.title}
                </Text>
                <Text style={styles.heroSub} numberOfLines={1}>
                  {selectedReport?.category || "-"}
                </Text>
              </View>
            </View>

            <Animated.View
              style={[
                styles.detailSheetOverlay,
                {
                  transform: [{ translateY: sheetTranslateY }],
                },
              ]}
              {...panResponder.panHandlers}
            >
              <Pressable
                style={styles.sheetGripArea}
                onPress={() =>
                  animateSheetTo(sheetExpanded ? SHEET_MAX_TRANSLATE : 0)
                }
              >
                <View style={styles.sheetGrip} />
                <View style={styles.sheetHintRow}>
                  <Ionicons
                    name={sheetExpanded ? "chevron-down" : "chevron-up"}
                    size={14}
                    color="#64748b"
                  />
                  <Text style={styles.sheetHintText}>
                    {sheetExpanded ? "Swipe down to collapse" : "Swipe up for more details"}
                  </Text>
                </View>
              </Pressable>

              <View style={styles.detailSheet}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.modalScrollContent}
                scrollEnabled={sheetExpanded}
                onScroll={(event) => {
                  detailScrollOffsetRef.current = event.nativeEvent.contentOffset.y;
                }}
                scrollEventThrottle={16}
              >
                <View style={styles.modalChipRow}>
                  <View style={styles.modalChip}>
                    <Ionicons name="business-outline" size={13} color="#1e40af" />
                    <Text style={styles.modalChipText}>
                      {selectedReport ? getAssignedOffice(selectedReport) : "-"}
                    </Text>
                  </View>
                  <View style={styles.modalChip}>
                    <Ionicons name="flag-outline" size={13} color="#92400e" />
                    <Text style={styles.modalChipText}>
                      {selectedReport
                        ? `Priority ${getPriorityLabel(selectedReport.priority?.level)}`
                        : "-"}
                    </Text>
                  </View>
                </View>

                <Text style={styles.modalLabel}>Description</Text>
                <Text style={styles.modalValue}>{selectedReport?.description || "-"}</Text>

                <Text style={styles.modalLabel}>Location</Text>
                <Text style={styles.modalValue}>
                  {selectedReport ? getLocationText(selectedReport) : "-"}
                </Text>

                <Text style={styles.modalLabel}>Priority Reason</Text>
                <Text style={styles.modalValue}>
                  {selectedReport ? getPriorityReason(selectedReport) : "-"}
                </Text>

                {selectedReport && getResolutionRemark(selectedReport) ? (
                  <>
                    <Text style={styles.modalLabel}>Resolution Remark</Text>
                    <Text style={styles.modalValue}>
                      {getResolutionRemark(selectedReport)}
                    </Text>
                  </>
                ) : null}

                {selectedReport && getRejectionReason(selectedReport) ? (
                  <>
                    <Text style={styles.modalLabel}>Rejection Reason</Text>
                    <Text style={styles.modalValue}>
                      {getRejectionReason(selectedReport)}
                    </Text>
                  </>
                ) : null}

                <Text style={styles.modalSectionTitle}>Timeline</Text>
                {selectedReport ? (
                  <View style={styles.timelineList}>
                    <View style={styles.timelineMainLine} />
                    {buildTimeline(selectedReport).map((event, index) => (
                      <View
                        key={`${event.title}-${event.at}-${index}`}
                        style={styles.timelineItem}
                      >
                        <View
                          style={[styles.timelineDot, { backgroundColor: event.color }]}
                        />
                        <View style={styles.timelineContent}>
                          <Text style={styles.timelineTitle}>{event.title}</Text>
                          <Text style={styles.timelineSub}>{event.subtitle}</Text>
                          <Text style={styles.timelineDate}>{formatDateTime(event.at)}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.modalValue}>No timeline available.</Text>
                )}
              </ScrollView>

              {selectedReport && isUnresolved(selectedReport.status) ? (
                <Pressable
                  style={[styles.deleteButton, deletingReport && styles.deleteButtonDisabled]}
                  onPress={() => handleDeleteUnresolvedReport(selectedReport)}
                  disabled={deletingReport}
                >
                  {deletingReport ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="trash-outline" size={16} color="#fff" />
                      <Text style={styles.deleteButtonText}>Delete unresolved complaint</Text>
                    </>
                  )}
                </Pressable>
              ) : (
                <View style={styles.modalInfo}>
                  <Ionicons name="information-circle-outline" size={16} color="#64748b" />
                  <Text style={styles.modalInfoText}>
                    Resolved and rejected complaints cannot be deleted.
                  </Text>
                </View>
              )}
              </View>
            </Animated.View>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#f8fafc",
  },
  loadingText: {
    color: "#334155",
    fontSize: 14,
    fontWeight: "600",
  },
  authCard: {
    marginTop: 160,
    marginHorizontal: 24,
    borderRadius: 16,
    backgroundColor: "#fff",
    padding: 24,
    alignItems: "center",
    gap: 12,
  },
  authTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1e293b",
  },
  authText: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
  },
  authButton: {
    marginTop: 6,
    backgroundColor: "#2563eb",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  authButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  header: {
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1e293b",
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: "#64748b",
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 28,
    gap: 12,
  },
  statRow: {
    flexDirection: "row",
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
  },
  statLabel: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "700",
    textTransform: "uppercase",
  },
  statValue: {
    marginTop: 4,
    fontSize: 24,
    color: "#1e293b",
    fontWeight: "800",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  sectionTitle: {
    fontSize: 17,
    color: "#1e293b",
    fontWeight: "800",
  },
  queueWrap: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    gap: 10,
  },
  syncButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 10,
    paddingVertical: 6,
    minHeight: 32,
  },
  syncButtonDisabled: {
    opacity: 0.7,
  },
  syncButtonText: {
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: "700",
  },
  queueEmpty: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: "#f8fafc",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  queueEmptyText: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "600",
  },
  queueList: {
    gap: 8,
  },
  queueItem: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 10,
    gap: 4,
  },
  queueTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  queueCategory: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  queueDate: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "600",
  },
  queueMeta: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "600",
  },
  queueWarningWrap: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 7,
    flexDirection: "row",
    gap: 6,
    alignItems: "flex-start",
    marginTop: 2,
  },
  queueWarningText: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: "600",
  },
  queueActionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 4,
  },
  queueEditButton: {
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  queueEditButtonText: {
    fontSize: 11.5,
    fontWeight: "700",
  },
  queueHelperText: {
    marginTop: 2,
    fontSize: 11.5,
    fontWeight: "600",
  },
  queueEditModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    padding: 18,
  },
  queueEditModalCard: {
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  queueEditTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  queueEditSub: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 4,
  },
  queueEditLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  queueEditInput: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: "600",
  },
  queueEditTextArea: {
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 100,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "500",
  },
  queueEditActions: {
    marginTop: 4,
    flexDirection: "row",
    gap: 10,
  },
  queueEditCancel: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  queueEditCancelText: {
    fontSize: 13,
    fontWeight: "700",
  },
  queueEditSave: {
    flex: 1.4,
    minHeight: 42,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  queueEditSaveText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
  syncInfoCard: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  syncInfoText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
  },
  emptyReports: {
    marginTop: 10,
    borderRadius: 14,
    backgroundColor: "#fff",
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: 16,
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: 18,
    color: "#1e293b",
    fontWeight: "800",
  },
  emptyText: {
    marginTop: 4,
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
  },
  emptyButton: {
    marginTop: 12,
    borderRadius: 10,
    backgroundColor: "#2563eb",
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  emptyButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  reportCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    gap: 8,
  },
  reportTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  reportTitle: {
    flex: 1,
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "800",
  },
  reportMeta: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "600",
  },
  reportDesc: {
    color: "#334155",
    fontSize: 13,
    lineHeight: 18,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  chipRow: {
    flexDirection: "row",
    gap: 8,
  },
  chip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 9,
    backgroundColor: "#f8fafc",
    paddingVertical: 7,
    paddingHorizontal: 8,
  },
  chipText: {
    flex: 1,
    color: "#334155",
    fontSize: 12,
    fontWeight: "600",
  },
  reasonLabel: {
    color: "#475569",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  reasonText: {
    color: "#334155",
    fontSize: 12,
    lineHeight: 17,
  },
  openHintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  openHintText: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.42)",
    justifyContent: "flex-end",
  },
  modalCard: {
    height: "96%",
    backgroundColor: "#0f172a",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
  },
  heroWrap: {
    flex: 1,
    position: "relative",
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCloseFloating: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(15,23,42,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroContent: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: SHEET_COLLAPSED_HEIGHT + 16,
    gap: 7,
  },
  heroMetaPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.45)",
    backgroundColor: "rgba(15,23,42,0.35)",
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  heroMetaText: {
    color: "#e2e8f0",
    fontSize: 11,
    fontWeight: "700",
  },
  heroStatusPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },
  heroStatusText: {
    color: "#f8fafc",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  heroTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 26,
  },
  heroSub: {
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: "600",
  },
  detailSheetOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: SHEET_EXPANDED_HEIGHT,
  },
  sheetGripArea: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: "rgba(255,255,255,0.98)",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  sheetGrip: {
    width: 44,
    height: 5,
    borderRadius: 4,
    backgroundColor: "#cbd5e1",
  },
  sheetHintRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  sheetHintText: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "700",
  },
  detailSheet: {
    flex: 1,
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 16,
  },
  modalScrollContent: {
    paddingBottom: 20,
    gap: 7,
  },
  modalChipRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 2,
  },
  modalChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 10,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  modalChipText: {
    flex: 1,
    color: "#334155",
    fontSize: 12,
    fontWeight: "600",
  },
  modalSectionTitle: {
    marginTop: 10,
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "800",
  },
  timelineItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 2,
    position: "relative",
  },
  timelineList: {
    position: "relative",
    paddingLeft: 2,
    marginTop: 2,
  },
  timelineMainLine: {
    position: "absolute",
    left: 7,
    top: 8,
    bottom: 10,
    width: 2,
    borderRadius: 1,
    backgroundColor: "#cbd5e1",
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 6,
    borderWidth: 2,
    borderColor: "#ffffff",
    zIndex: 2,
  },
  timelineContent: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingBottom: 12,
    gap: 2,
  },
  timelineTitle: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "700",
  },
  timelineSub: {
    color: "#475569",
    fontSize: 12,
    lineHeight: 17,
  },
  timelineDate: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "600",
  },
  modalLabel: {
    marginTop: 6,
    color: "#64748b",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  modalValue: {
    color: "#1e293b",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500",
  },
  deleteButton: {
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: "#dc2626",
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  deleteButtonDisabled: {
    opacity: 0.7,
  },
  deleteButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  modalInfo: {
    marginTop: 8,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  modalInfoText: {
    flex: 1,
    color: "#475569",
    fontSize: 12,
    fontWeight: "600",
  },
});
