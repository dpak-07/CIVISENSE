import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInUp } from "react-native-reanimated";
import { getApiErrorMessage } from "@/lib/api";
import { sessionStore } from "@/lib/session";
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

export default function TrackComplaints() {
  const [complaints, setComplaints] = useState<ComplaintCardModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [authMissing, setAuthMissing] = useState(false);
  const [selectedComplaint, setSelectedComplaint] = useState<ComplaintCardModel | null>(null);

  const loadComplaints = useCallback(async (isRefresh = false) => {
    const user = sessionStore.getUser();
    if (!sessionStore.getAccessToken() || !user?.id) {
      setAuthMissing(true);
      setComplaints([]);
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

    try {
      const records = await getMyComplaints();
      setComplaints(records.map(toViewModel));
    } catch (error) {
      const message = getApiErrorMessage(error);
      if (message.toLowerCase().includes("authorization") || message.toLowerCase().includes("token")) {
        setAuthMissing(true);
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

  const activeCount = useMemo(() => complaints.length, [complaints]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading complaints...</Text>
      </View>
    );
  }

  if (authMissing) {
    return (
      <LinearGradient colors={["#f8fafc", "#eef2ff"]} style={styles.container}>
        <View style={styles.authCard}>
          <Ionicons name="lock-closed" size={48} color="#2563eb" />
          <Text style={styles.authTitle}>Sign in required</Text>
          <Text style={styles.authText}>Please log in to view and track your complaints.</Text>
          <Pressable style={styles.authButton} onPress={() => router.push("/auth/login")}>
            <Text style={styles.authButtonText}>Go to Login</Text>
          </Pressable>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={["#f8fafc", "#eef2ff"]} style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1e293b" />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>My Reports</Text>
          <Text style={styles.headerSubtitle}>{activeCount} complaint(s)</Text>
        </View>
        <Pressable onPress={() => void loadComplaints(true)} style={styles.refreshButton}>
          <Ionicons name="refresh" size={22} color="#1e293b" />
        </Pressable>
      </View>

      <FlatList
        data={complaints}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadComplaints(true)} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={52} color="#94a3b8" />
            <Text style={styles.emptyTitle}>No reports yet</Text>
            <Text style={styles.emptyText}>Submit a complaint to start tracking it here.</Text>
            <Pressable style={styles.emptyButton} onPress={() => router.push("/report") }>
              <Text style={styles.emptyButtonText}>Report an Issue</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item, index }) => {
          const statusGradient = getStatusGradient(item.statusRaw);
          const priorityColor = getPriorityColor(item.priorityLabel);

          return (
            <Pressable onPress={() => setSelectedComplaint(item)}>
              <Animated.View entering={FadeInUp.delay(index * 60)} style={styles.card}>
                <View style={[styles.priorityStrip, { backgroundColor: priorityColor }]} />
                <View style={styles.cardHeader}>
                  <LinearGradient colors={statusGradient} style={styles.iconWrap}>
                    <Ionicons name={item.icon} size={20} color="#fff" />
                  </LinearGradient>
                  <View style={styles.cardHeaderContent}>
                    <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                    <Text style={styles.cardMeta}>{item.locationLabel} | {item.dateLabel}</Text>
                    <Text style={styles.cardOffice} numberOfLines={1}>
                      Office: {item.assignedOfficeLabel}
                    </Text>
                  </View>
                </View>

                <View style={styles.progressBlock}>
                  <View style={styles.progressTopRow}>
                    <Text style={styles.progressLabel}>Progress</Text>
                    <Text style={styles.progressPct}>{item.progress}%</Text>
                  </View>
                  <View style={styles.progressTrack}>
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
              </Animated.View>
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
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedComplaint?.title}</Text>
              <Pressable onPress={() => setSelectedComplaint(null)}>
                <Ionicons name="close" size={24} color="#1e293b" />
              </Pressable>
            </View>

            {selectedComplaint?.imageUrl ? (
              <Image source={{ uri: selectedComplaint.imageUrl }} style={styles.modalImage} resizeMode="cover" />
            ) : (
              <View style={styles.modalImagePlaceholder}>
                <Ionicons name="image-outline" size={36} color="#94a3b8" />
                <Text style={styles.modalImageText}>No image available</Text>
              </View>
            )}

            <Text style={styles.modalLabel}>Category</Text>
            <Text style={styles.modalValue}>{selectedComplaint?.category || "-"}</Text>

            <Text style={styles.modalLabel}>Description</Text>
            <Text style={styles.modalValue}>{selectedComplaint?.description || "-"}</Text>

            <Text style={styles.modalLabel}>Priority Reason</Text>
            <Text style={styles.modalValue}>{selectedComplaint?.priorityReason || "-"}</Text>

            <Text style={styles.modalLabel}>Assigned Municipal Office</Text>
            <Text style={styles.modalValue}>{selectedComplaint?.assignedOfficeLabel || "-"}</Text>

            <Text style={styles.modalLabel}>Routing</Text>
            <Text style={styles.modalValue}>{selectedComplaint?.routingReason || "-"}</Text>

            <Text style={styles.modalLabel}>Timeline</Text>
            <View style={styles.timelineWrap}>
              {selectedComplaint?.timeline.map((item) => (
                <View key={`${item.date}-${item.message}`} style={styles.timelineItem}>
                  <View style={styles.timelineDot} />
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineMessage}>{item.message}</Text>
                    <Text style={styles.timelineDate}>{item.date}</Text>
                  </View>
                </View>
              ))}
            </View>

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
                <Ionicons name="trash-outline" size={16} color="#ef4444" />
                <Text style={styles.deleteButtonText}>Delete complaint</Text>
              </Pressable>
            ) : null}
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
    paddingBottom: 12,
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
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 16,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  modalTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "800",
    color: "#1e293b",
    marginRight: 10,
  },
  modalImage: {
    width: "100%",
    height: 180,
    borderRadius: 12,
    marginBottom: 12,
  },
  modalImagePlaceholder: {
    width: "100%",
    height: 180,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    marginBottom: 12,
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  modalImageText: {
    color: "#64748b",
    fontSize: 13,
  },
  modalLabel: {
    marginTop: 8,
    fontSize: 12,
    color: "#64748b",
    fontWeight: "700",
    textTransform: "uppercase",
  },
  modalValue: {
    marginTop: 4,
    color: "#1e293b",
    fontSize: 14,
    lineHeight: 20,
  },
  timelineWrap: {
    marginTop: 8,
    marginBottom: 8,
  },
  timelineItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 10,
    backgroundColor: "#2563eb",
    marginTop: 6,
    marginRight: 10,
  },
  timelineContent: {
    flex: 1,
  },
  timelineMessage: {
    color: "#1e293b",
    fontSize: 13,
    fontWeight: "600",
  },
  timelineDate: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 2,
  },
  deleteButton: {
    marginTop: 8,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "#fee2e2",
    borderColor: "#fecaca",
    borderWidth: 1,
  },
  deleteButtonText: {
    color: "#b91c1c",
    fontSize: 12,
    fontWeight: "700",
  },
});
