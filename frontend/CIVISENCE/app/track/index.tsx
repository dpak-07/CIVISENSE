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
  View,
} from "react-native";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Reanimated, { FadeInUp } from "react-native-reanimated";
import { getApiErrorMessage } from "@/lib/api";
import { useAppPreferences } from "@/lib/appPreferencesContext";
import { safeBack } from "@/lib/navigation";
import { sessionStore } from "@/lib/session";
import { getQueuedComplaints, type QueuedComplaint } from "@/lib/services/complaintQueue";
import { ComplaintRecord, deleteComplaint, getMyComplaints } from "@/lib/services/complaints";

type IoniconName = keyof typeof Ionicons.glyphMap;

type TimelineItem = {
  date: string;
  message: string;
};

type ComplaintCardModel = {
  id: string;
  title: string;
  description: string;
  category: string;
  statusLabel: string;
  statusRaw: string;
  priorityLabel: string;
  priorityReason: string;
  assignedOfficeLabel: string;
  routingReason: string;
  dateLabel: string;
  locationLabel: string;
  progress: number;
  icon: IoniconName;
  imageUrl: string | null;
  timeline: TimelineItem[];
};

const CATEGORY_ICON_MAP: Record<string, IoniconName> = {
  pothole: "alert-circle",
  streetlight: "sunny",
  garbage: "trash",
  drainage: "water",
  leak: "water",
  water_leak: "water",
  traffic_sign: "alert",
};

const toStatusLabel = (status: string): string => {
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

const toPriorityLabel = (priorityLevel?: string): string => {
  switch (priorityLevel) {
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

const toProgress = (status: string): number => {
  switch (status) {
    case "resolved":
    case "rejected":
      return 100;
    case "in_progress":
      return 70;
    case "assigned":
      return 40;
    case "reported":
    case "unassigned":
      return 15;
    default:
      return 10;
  }
};

const toCategoryIcon = (category: string): IoniconName => {
  const normalized = category.trim().toLowerCase().replace(/\s+/g, "_");
  return CATEGORY_ICON_MAP[normalized] ?? "construct";
};

const formatDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const toLocationLabel = (complaint: ComplaintRecord): string => {
  if (!complaint.location?.coordinates || complaint.location.coordinates.length !== 2) {
    return "No coordinates";
  }

  const [longitude, latitude] = complaint.location.coordinates;
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
};

const toAssignedOfficeLabel = (complaint: ComplaintRecord): string => {
  if (complaint.assignedMunicipalOffice?.name) {
    return complaint.assignedMunicipalOffice.name;
  }

  if (complaint.assignedOfficeType) {
    return `Assigned (${complaint.assignedOfficeType.replace("_", " ")})`;
  }

  return "Not assigned yet";
};

const toDetailedPriorityReason = (complaint: ComplaintRecord): string => {
  const sentence = complaint.priority?.reasonSentence?.trim();
  const technical = complaint.priority?.reason?.trim();

  if (sentence && technical && sentence !== technical) {
    return `${sentence}\n\nTechnical details: ${technical}`;
  }

  if (sentence) {
    return sentence;
  }

  if (technical) {
    return technical;
  }

  return "No priority explanation yet";
};

const toTimeline = (complaint: ComplaintRecord, assignedOfficeLabel: string): TimelineItem[] => {
  const timeline: TimelineItem[] = [
    {
      date: formatDate(complaint.createdAt),
      message: "Report submitted",
    },
  ];

  if (complaint.status === "assigned") {
    timeline.push({
      date: formatDate(complaint.updatedAt),
      message:
        assignedOfficeLabel !== "Not assigned yet"
          ? `Assigned to ${assignedOfficeLabel}`
          : "Assigned to municipal office",
    });
  }

  if (complaint.status === "in_progress") {
    timeline.push({
      date: formatDate(complaint.updatedAt),
      message:
        assignedOfficeLabel !== "Not assigned yet"
          ? `Work in progress by ${assignedOfficeLabel}`
          : "Work in progress",
    });
  }

  if (complaint.status === "resolved") {
    timeline.push({
      date: formatDate(complaint.updatedAt),
      message:
        assignedOfficeLabel !== "Not assigned yet"
          ? `Issue resolved by ${assignedOfficeLabel}`
          : "Issue resolved",
    });
  }

  if (complaint.status === "rejected") {
    timeline.push({
      date: formatDate(complaint.updatedAt),
      message: "Issue rejected",
    });
  }

  return timeline;
};

const toViewModel = (complaint: ComplaintRecord): ComplaintCardModel => {
  const assignedOfficeLabel = toAssignedOfficeLabel(complaint);

  return {
    id: complaint._id,
    title: complaint.title,
    description: complaint.description,
    category: complaint.category,
    statusLabel: toStatusLabel(complaint.status),
    statusRaw: complaint.status,
    priorityLabel: toPriorityLabel(complaint.priority?.level),
    priorityReason: toDetailedPriorityReason(complaint),
    assignedOfficeLabel,
    routingReason: complaint.routingReason || "Routing details unavailable",
    dateLabel: formatDate(complaint.createdAt),
    locationLabel: toLocationLabel(complaint),
    progress: toProgress(complaint.status),
    icon: toCategoryIcon(complaint.category),
    imageUrl: complaint.images?.[0]?.url || null,
    timeline: toTimeline(complaint, assignedOfficeLabel),
  };
};

const getStatusGradient = (status: string): [string, string] => {
  switch (status) {
    case "resolved":
      return ["#10b981", "#059669"];
    case "in_progress":
      return ["#f59e0b", "#d97706"];
    case "assigned":
      return ["#3b82f6", "#2563eb"];
    case "rejected":
      return ["#ef4444", "#dc2626"];
    default:
      return ["#6b7280", "#4b5563"];
  }
};

const getPriorityColor = (priority: string): string => {
  switch (priority) {
    case "High":
      return "#ef4444";
    case "Medium":
      return "#f59e0b";
    case "Low":
      return "#10b981";
    default:
      return "#6b7280";
  }
};

const getStatusColor = (status: string): string => {
  switch (status) {
    case "in_progress":
      return "#f59e0b";
    case "assigned":
      return "#3b82f6";
    case "reported":
    case "unassigned":
      return "#64748b";
    default:
      return "#64748b";
  }
};

const isUnresolvedStatus = (status: string): boolean =>
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

const formatQueueDate = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }
  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function TrackComplaints() {
  const { preferences } = useAppPreferences();
  const isDark = preferences.darkMode;
  const [complaints, setComplaints] = useState<ComplaintCardModel[]>([]);
  const [queuedItems, setQueuedItems] = useState<QueuedComplaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [authMissing, setAuthMissing] = useState(false);
  const [syncInfoMessage, setSyncInfoMessage] = useState<string | null>(null);
  const [selectedComplaint, setSelectedComplaint] = useState<ComplaintCardModel | null>(null);
  const [sheetExpanded, setSheetExpanded] = useState(false);
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
    if (!selectedComplaint) {
      return;
    }

    sheetTranslateY.setValue(SHEET_MAX_TRANSLATE);
    setSheetExpanded(false);
    sheetExpandedRef.current = false;
    detailScrollOffsetRef.current = 0;
  }, [selectedComplaint, sheetTranslateY]);

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

  const loadComplaints = useCallback(async (isRefresh = false) => {
    const user = sessionStore.getUser();
    if (!sessionStore.getAccessToken() || !user?.id) {
      setAuthMissing(true);
      setComplaints([]);
      setQueuedItems([]);
      setSyncInfoMessage(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setAuthMissing(false);

    if (isRefresh) {
      setRefreshing(true);
    } else {
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
      const records = await getMyComplaints();
      const unresolved = records.filter((item) => isUnresolvedStatus(item.status));
      setComplaints(unresolved.map(toViewModel));
      setSyncInfoMessage(null);
    } catch (error) {
      const message = getApiErrorMessage(error);
      if (isAuthLikeErrorMessage(message)) {
        setAuthMissing(true);
        setComplaints([]);
        setSyncInfoMessage(null);
      } else if (isNetworkLikeErrorMessage(message)) {
        setSyncInfoMessage(
          queue.length > 0
            ? "No internet. Queued complaints are saved and will be available after network returns."
            : "No internet. Pull to refresh after network returns."
        );
      } else {
        Alert.alert("Could not load complaints", message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleDeleteComplaintFromList = useCallback(
    async (complaintId: string) => {
      try {
        await deleteComplaint(complaintId);
        setComplaints((prev) => prev.filter((item) => item.id !== complaintId));
        setSelectedComplaint((prev) => (prev?.id === complaintId ? null : prev));
      } catch (error) {
        Alert.alert("Delete failed", getApiErrorMessage(error));
      }
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      void loadComplaints();
    }, [loadComplaints])
  );

  const stats = useMemo(() => {
    const high = complaints.filter((item) => item.priorityLabel === "High").length;
    const inProgress = complaints.filter((item) => item.statusRaw === "in_progress").length;
    const waiting = complaints.filter(
      (item) => item.statusRaw === "reported" || item.statusRaw === "unassigned"
    ).length;

    return { total: complaints.length, high, inProgress, waiting };
  }, [complaints]);

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
            hero: ["#4338CA", "#6D28D9"] as const,
            trackBg: "#24314E",
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
            hero: ["#4F46E5", "#7C3AED"] as const,
            trackBg: "#E2E8F0",
          },
    [isDark]
  );

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: isDark ? "#0B1020" : "#f8fafc" }]}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={[styles.loadingText, { color: palette.subtext }]}>Loading complaints...</Text>
      </View>
    );
  }

  if (authMissing) {
    return (
      <LinearGradient colors={palette.screenGradient as any} style={styles.container}>
        <View style={[styles.authCard, { backgroundColor: palette.card }]}>
          <Ionicons name="lock-closed" size={48} color="#2563eb" />
          <Text style={[styles.authTitle, { color: palette.text }]}>Sign in required</Text>
          <Text style={[styles.authText, { color: palette.subtext }]}>Please log in to view and track your complaints.</Text>
          <Pressable style={[styles.authButton, { backgroundColor: palette.accent }]} onPress={() => router.push("/auth")}>
            <Text style={styles.authButtonText}>Go to Login</Text>
          </Pressable>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={palette.screenGradient as any} style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => safeBack("/")} style={[styles.backButton, { backgroundColor: palette.buttonBg }]}>
          <Ionicons name="arrow-back" size={24} color={palette.buttonIcon} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={[styles.headerTitle, { color: palette.text }]}>Unresolved Issues</Text>
          <Text style={[styles.headerSubtitle, { color: palette.subtext }]}>Live complaint pipeline</Text>
        </View>
        <Pressable onPress={() => void loadComplaints(true)} style={[styles.refreshButton, { backgroundColor: palette.buttonBg }]}>
          <Ionicons name="refresh" size={22} color={palette.buttonIcon} />
        </Pressable>
      </View>

      <LinearGradient colors={palette.hero as any} style={styles.heroCard}>
        <View style={styles.heroBgOrbOne} />
        <View style={styles.heroBgOrbTwo} />
        <Text style={styles.heroTitle}>Track Board</Text>
        <Text style={styles.heroSubtitle}>
          {stats.total} unresolved complaints
        </Text>
        <View style={styles.heroStatsRow}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{stats.high}</Text>
            <Text style={styles.heroStatLabel}>High</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{stats.inProgress}</Text>
            <Text style={styles.heroStatLabel}>In Progress</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{stats.waiting}</Text>
            <Text style={styles.heroStatLabel}>Waiting</Text>
          </View>
        </View>
      </LinearGradient>

      {(syncInfoMessage || queuedItems.length > 0) ? (
        <View style={[styles.queueCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.queueCardHead}>
            <Ionicons name="cloud-upload-outline" size={16} color={palette.accent} />
            <Text style={[styles.queueCardTitle, { color: palette.text }]}>
              Queued complaints: {queuedItems.length}
            </Text>
          </View>
          <Text style={[styles.queueCardSub, { color: palette.subtext }]}>
            {syncInfoMessage || "These complaints will sync automatically when internet is back."}
          </Text>
          {queuedItems.slice(0, 3).map((item) => (
            <View key={item.id} style={[styles.queueRow, { borderColor: palette.border }]}>
              <Text style={[styles.queueRowTitle, { color: palette.text }]} numberOfLines={1}>
                {item.payload.category}
              </Text>
              <Text style={[styles.queueRowDate, { color: palette.subtext }]}>
                {formatQueueDate(item.createdAt)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <FlatList
        data={complaints}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadComplaints(true)} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={52} color={palette.emptyIcon} />
            <Text style={[styles.emptyTitle, { color: palette.text }]}>No unresolved complaints</Text>
            <Text style={[styles.emptyText, { color: palette.subtext }]}>All your tracked complaints are resolved or none are active.</Text>
            <Pressable style={[styles.emptyButton, { backgroundColor: palette.accent }]} onPress={() => router.push("/report") }>
              <Text style={styles.emptyButtonText}>Report an Issue</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item, index }) => {
          const statusGradient = getStatusGradient(item.statusRaw);
          const priorityColor = getPriorityColor(item.priorityLabel);

          return (
            <Pressable onPress={() => setSelectedComplaint(item)}>
              <Reanimated.View entering={FadeInUp.delay(index * 60)} style={styles.cardShell}>
                <LinearGradient colors={isDark ? ["#334155", "#312E81"] : ["#dbeafe", "#e9d5ff"]} style={styles.cardBorder}>
                  <View style={[styles.card, { backgroundColor: palette.card }]}>
                <View style={[styles.priorityStrip, { backgroundColor: priorityColor }]} />
                <View style={styles.cardHeader}>
                  <LinearGradient colors={statusGradient} style={styles.iconWrap}>
                    <Ionicons name={item.icon} size={20} color="#fff" />
                  </LinearGradient>
                  <View style={styles.cardHeaderContent}>
                    <Text style={[styles.cardTitle, { color: palette.text }]} numberOfLines={2}>{item.title}</Text>
                    <Text style={[styles.cardMeta, { color: palette.subtext }]}>{item.locationLabel} | {item.dateLabel}</Text>
                    <Text style={[styles.cardOffice, { color: palette.accent }]} numberOfLines={1}>
                      Office: {item.assignedOfficeLabel}
                    </Text>
                  </View>
                </View>

                <View style={styles.progressBlock}>
                  <View style={styles.progressTopRow}>
                    <Text style={[styles.progressLabel, { color: palette.subtext }]}>Progress</Text>
                    <Text style={[styles.progressPct, { color: palette.text }]}>{item.progress}%</Text>
                  </View>
                  <View style={[styles.progressTrack, { backgroundColor: palette.trackBg }]}>
                    <LinearGradient colors={statusGradient} style={[styles.progressFill, { width: `${item.progress}%` }]} />
                  </View>
                </View>

                <View style={styles.badgeRow}>
                  <LinearGradient colors={statusGradient} style={styles.statusBadge}>
                    <Text style={styles.statusBadgeText}>{item.statusLabel}</Text>
                  </LinearGradient>
                  <View style={[styles.priorityBadge, { borderColor: priorityColor }]}>
                    <View style={[styles.priorityDot, { backgroundColor: priorityColor }]} />
                    <Text style={[styles.priorityBadgeText, { color: priorityColor }]}>{item.priorityLabel}</Text>
                  </View>
                </View>
                <View style={styles.openHintRow}>
                  <Ionicons name="open-outline" size={12} color={palette.subtext} />
                  <Text style={[styles.openHintText, { color: palette.subtext }]}>Tap for more details</Text>
                </View>
                  </View>
                </LinearGradient>
              </Reanimated.View>
            </Pressable>
          );
        }}
      />

      <Modal
        visible={!!selectedComplaint}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedComplaint(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.heroWrap}>
              {selectedComplaint?.imageUrl ? (
                <ImageBackground
                  source={{ uri: selectedComplaint.imageUrl }}
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
                onPress={() => setSelectedComplaint(null)}
                style={styles.modalCloseFloating}
              >
                <Ionicons name="close" size={20} color="#ffffff" />
              </Pressable>

              <View style={styles.heroContent}>
                <View style={styles.heroMetaPill}>
                  <Ionicons name="calendar-outline" size={12} color="#e2e8f0" />
                  <Text style={styles.heroMetaText} numberOfLines={1}>
                    {selectedComplaint?.dateLabel || "-"}
                  </Text>
                </View>
                {selectedComplaint ? (
                  <View
                    style={[
                      styles.heroStatusPill,
                      { backgroundColor: `${getStatusColor(selectedComplaint.statusRaw)}33` },
                    ]}
                  >
                    <Text style={styles.heroStatusText}>
                      {selectedComplaint.statusLabel}
                    </Text>
                  </View>
                ) : null}
                <Text style={styles.heroTitleModal} numberOfLines={2}>
                  {selectedComplaint?.title}
                </Text>
                <Text style={styles.heroSub} numberOfLines={1}>
                  {selectedComplaint?.category || "-"}
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
                        {selectedComplaint?.assignedOfficeLabel || "-"}
                      </Text>
                    </View>
                    <View style={styles.modalChip}>
                      <Ionicons name="flag-outline" size={13} color="#92400e" />
                      <Text style={styles.modalChipText}>
                        Priority {selectedComplaint?.priorityLabel || "-"}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.modalLabel}>Description</Text>
                  <Text style={styles.modalValue}>{selectedComplaint?.description || "-"}</Text>

                  <Text style={styles.modalLabel}>Location</Text>
                  <Text style={styles.modalValue}>{selectedComplaint?.locationLabel || "-"}</Text>

                  <Text style={styles.modalLabel}>Priority Reason</Text>
                  <Text style={styles.modalValue}>{selectedComplaint?.priorityReason || "-"}</Text>

                  <Text style={styles.modalLabel}>Routing</Text>
                  <Text style={styles.modalValue}>{selectedComplaint?.routingReason || "-"}</Text>

                  <Text style={styles.modalSectionTitle}>Timeline</Text>
                  <View style={styles.timelineList}>
                    <View style={styles.timelineMainLine} />
                    {selectedComplaint?.timeline.map((item, index) => (
                      <View key={`${item.date}-${item.message}-${index}`} style={styles.timelineItem}>
                        <View style={styles.timelineDot} />
                        <View style={styles.timelineContent}>
                          <Text style={styles.timelineMessage}>{item.message}</Text>
                          <Text style={styles.timelineDate}>{item.date}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </ScrollView>

                {selectedComplaint ? (
                  <Pressable
                    style={styles.deleteButton}
                    onPress={() => {
                      Alert.alert(
                        "Delete complaint?",
                        "This will permanently delete your complaint.",
                        [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Delete",
                            style: "destructive",
                            onPress: () => {
                              void handleDeleteComplaintFromList(selectedComplaint.id);
                            },
                          },
                        ]
                      );
                    }}
                  >
                    <Ionicons name="trash-outline" size={16} color="#fff" />
                    <Text style={styles.deleteButtonText}>Delete complaint</Text>
                  </Pressable>
                ) : null}
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#f8fafc",
  },
  loadingText: {
    color: "#334155",
    fontSize: 14,
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
    fontWeight: "700",
    color: "#1e293b",
  },
  authText: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
  },
  authButton: {
    marginTop: 8,
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
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerText: {
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
    color: "#64748b",
    fontSize: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  heroCard: {
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 16,
    overflow: "hidden",
    marginBottom: 12,
  },
  heroBgOrbOne: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 90,
    backgroundColor: "rgba(255,255,255,0.12)",
    top: -70,
    right: -40,
  },
  heroBgOrbTwo: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.08)",
    bottom: -50,
    left: -25,
  },
  heroTitle: {
    color: "#fff",
    fontSize: 19,
    fontWeight: "800",
  },
  heroSubtitle: {
    marginTop: 4,
    color: "rgba(255,255,255,0.88)",
    fontSize: 12,
    fontWeight: "600",
  },
  heroStatsRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 10,
  },
  heroStat: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  heroStatValue: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
  },
  heroStatLabel: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  queueCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 7,
  },
  queueCardHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  queueCardTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  queueCardSub: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },
  queueRow: {
    borderTopWidth: 1,
    paddingTop: 7,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  queueRowTitle: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  queueRowDate: {
    fontSize: 11,
    fontWeight: "600",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
    paddingTop: 8,
  },
  emptyState: {
    marginTop: 80,
    alignItems: "center",
    paddingHorizontal: 24,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
  },
  emptyText: {
    marginTop: 6,
    textAlign: "center",
    color: "#64748b",
    fontSize: 14,
  },
  emptyButton: {
    marginTop: 14,
    backgroundColor: "#2563eb",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  emptyButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  cardShell: {
    marginBottom: 12,
  },
  cardBorder: {
    borderRadius: 20,
    padding: 1,
    overflow: "hidden",
    shadowColor: "#4f46e5",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 19,
    padding: 16,
    overflow: "hidden",
  },
  priorityStrip: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  cardHeaderContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1e293b",
  },
  cardMeta: {
    marginTop: 4,
    fontSize: 12,
    color: "#64748b",
  },
  cardOffice: {
    marginTop: 4,
    fontSize: 12,
    color: "#1d4ed8",
    fontWeight: "600",
  },
  progressBlock: {
    marginBottom: 12,
  },
  progressTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "600",
  },
  progressPct: {
    fontSize: 12,
    color: "#1e293b",
    fontWeight: "700",
  },
  progressTrack: {
    height: 8,
    borderRadius: 8,
    backgroundColor: "#e2e8f0",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 8,
  },
  badgeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  statusBadge: {
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  statusBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  priorityBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 8,
  },
  priorityBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  openHintRow: {
    marginTop: 8,
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
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalCard: {
    height: "96%",
    backgroundColor: "#0f172a",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
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
  heroTitleModal: {
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
  modalLabel: {
    marginTop: 6,
    fontSize: 11,
    color: "#64748b",
    fontWeight: "800",
    textTransform: "uppercase",
  },
  modalValue: {
    color: "#1e293b",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500",
  },
  modalSectionTitle: {
    marginTop: 10,
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "800",
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
  timelineItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 2,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#2563eb",
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
  timelineMessage: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "700",
  },
  timelineDate: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "600",
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
  deleteButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
});
