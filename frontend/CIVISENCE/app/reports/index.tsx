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
import { getApiErrorMessage } from "@/lib/api";
import { sessionStore } from "@/lib/session";
import {
  flushQueuedComplaints,
  getQueuedComplaints,
  type QueuedComplaint,
} from "@/lib/services/complaintQueue";
import {
  ComplaintRecord,
  deleteComplaint,
  getMyComplaints,
} from "@/lib/services/complaints";

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

const isUnresolved = (status: string): boolean =>
  status !== "resolved" && status !== "rejected";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const SHEET_COLLAPSED_HEIGHT = 176;
const SHEET_EXPANDED_HEIGHT = Math.min(SCREEN_HEIGHT * 0.78, SCREEN_HEIGHT - 110);
const SHEET_MAX_TRANSLATE = SHEET_EXPANDED_HEIGHT - SHEET_COLLAPSED_HEIGHT;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

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
      subtitle: `Closed by ${office}`,
      at: report.updatedAt || report.createdAt,
      color: "#10b981",
    });
  }

  if (report.status === "rejected") {
    events.push({
      title: "Complaint rejected",
      subtitle: "Marked as invalid by municipality",
      at: report.updatedAt || report.createdAt,
      color: "#ef4444",
    });
  }

  return [...events].sort(
    (left, right) => new Date(left.at).getTime() - new Date(right.at).getTime()
  );
};

const QueueSection = ({
  queuedItems,
  syncing,
  onSync,
}: {
  queuedItems: QueuedComplaint[];
  syncing: boolean;
  onSync: () => Promise<void>;
}) => {
  return (
    <View style={styles.queueWrap}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Queued Complaints</Text>
        <Pressable
          style={[styles.syncButton, syncing && styles.syncButtonDisabled]}
          onPress={() => void onSync()}
          disabled={syncing}
        >
          {syncing ? (
            <ActivityIndicator size="small" color="#1d4ed8" />
          ) : (
            <>
              <Ionicons name="sync" size={14} color="#1d4ed8" />
              <Text style={styles.syncButtonText}>Sync</Text>
            </>
          )}
        </Pressable>
      </View>

      {queuedItems.length === 0 ? (
        <View style={styles.queueEmpty}>
          <Ionicons name="cloud-done-outline" size={18} color="#64748b" />
          <Text style={styles.queueEmptyText}>No queued complaints.</Text>
        </View>
      ) : (
        <View style={styles.queueList}>
          {queuedItems.map((item) => (
            <View key={item.id} style={styles.queueItem}>
              <View style={styles.queueTopRow}>
                <Text style={styles.queueCategory}>{item.payload.category}</Text>
                <Text style={styles.queueDate}>{formatDateTime(item.createdAt)}</Text>
              </View>
              <Text style={styles.queueMeta}>
                {getQueueCoordinates(item)} | Attempts: {item.attempts}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

export default function ReportsScreen() {
  const [authMissing, setAuthMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncingQueue, setSyncingQueue] = useState(false);
  const [deletingReport, setDeletingReport] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ComplaintRecord | null>(null);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [reports, setReports] = useState<ComplaintRecord[]>([]);
  const [queuedItems, setQueuedItems] = useState<QueuedComplaint[]>([]);
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

  const loadData = useCallback(async (isRefresh = false) => {
    const token = sessionStore.getAccessToken();
    const user = sessionStore.getUser();

    if (!token || !user?.id) {
      setAuthMissing(true);
      setReports([]);
      setQueuedItems([]);
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
      const [complaints, queue] = await Promise.all([
        getMyComplaints(),
        getQueuedComplaints(),
      ]);

      const sortedComplaints = [...complaints].sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      );

      setReports(sortedComplaints);
      setQueuedItems(queue);
    } catch (error) {
      Alert.alert("Failed to load reports", getApiErrorMessage(error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const syncQueue = useCallback(async () => {
    setSyncingQueue(true);
    try {
      const result = await flushQueuedComplaints();
      await loadData(true);

      if (result.sent > 0) {
        Alert.alert(
          "Queue synced",
          `${result.sent} complaint${result.sent === 1 ? "" : "s"} uploaded.`
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

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  const unresolvedCount = useMemo(
    () => reports.filter((item) => isUnresolved(item.status)).length,
    [reports]
  );

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.loadingText}>Loading reports...</Text>
      </View>
    );
  }

  if (authMissing) {
    return (
      <LinearGradient colors={["#f8fafc", "#eef2ff"]} style={styles.container}>
        <View style={styles.authCard}>
          <Ionicons name="lock-closed" size={48} color="#2563eb" />
          <Text style={styles.authTitle}>Login required</Text>
          <Text style={styles.authText}>
            Sign in to view your reports and queued complaints.
          </Text>
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
        <Pressable onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={22} color="#1e293b" />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>My Reports</Text>
          <Text style={styles.headerSubtitle}>Queue and full complaint history</Text>
        </View>
        <Pressable onPress={() => void loadData(true)} style={styles.headerButton}>
          <Ionicons name="refresh" size={22} color="#1e293b" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void loadData(true)} />
        }
      >
        <View style={styles.statRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total Reports</Text>
            <Text style={styles.statValue}>{reports.length}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Unresolved</Text>
            <Text style={styles.statValue}>{unresolvedCount}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Queued</Text>
            <Text style={styles.statValue}>{queuedItems.length}</Text>
          </View>
        </View>

        <QueueSection queuedItems={queuedItems} syncing={syncingQueue} onSync={syncQueue} />

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>All My Reports</Text>
        </View>

        {reports.length === 0 ? (
          <View style={styles.emptyReports}>
            <Ionicons name="document-text-outline" size={48} color="#94a3b8" />
            <Text style={styles.emptyTitle}>No reports yet</Text>
            <Text style={styles.emptyText}>Create your first complaint from the report page.</Text>
            <Pressable style={styles.emptyButton} onPress={() => router.push("/report")}>
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
              const reason = getPriorityReason(item);

              return (
                <Pressable onPress={() => setSelectedReport(item)}>
                  <View style={styles.reportCard}>
                    <View style={styles.reportTopRow}>
                      <Text style={styles.reportTitle} numberOfLines={2}>
                        {item.title}
                      </Text>
                      <View style={[styles.statusBadge, { backgroundColor: `${statusColor}20` }]}>
                        <Text style={[styles.statusText, { color: statusColor }]}>
                          {getStatusLabel(item.status)}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.reportMeta}>{formatDateTime(item.createdAt)}</Text>
                    <Text style={styles.reportDesc} numberOfLines={3}>
                      {item.description}
                    </Text>

                    <View style={styles.chipRow}>
                      <View style={styles.chip}>
                        <Ionicons name="flag-outline" size={12} color="#334155" />
                        <Text style={styles.chipText}>Priority: {priorityLabel}</Text>
                      </View>
                      <View style={styles.chip}>
                        <Ionicons name="business-outline" size={12} color="#334155" />
                        <Text style={styles.chipText} numberOfLines={1}>
                          {assignedOffice}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.reasonLabel}>Priority Reason</Text>
                    <Text style={styles.reasonText} numberOfLines={3}>
                      {reason}
                    </Text>

                    <View style={styles.openHintRow}>
                      <Ionicons name="open-outline" size={12} color="#64748b" />
                      <Text style={styles.openHintText}>Tap to open details</Text>
                    </View>
                  </View>
                </Pressable>
              );
            }}
          />
        )}
      </ScrollView>

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
