import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getApiErrorMessage } from "@/lib/api";
import { safeBack } from "@/lib/navigation";
import { sessionStore } from "@/lib/session";
import { ComplaintRecord, getMyComplaints } from "@/lib/services/complaints";
import { AppNotification, getNotifications } from "@/lib/services/notifications";

const DASHBOARD_LIVE_POLL_INTERVAL_MS = 15000;

type StatCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  value: number;
  color: string;
};

type ActivityItem = {
  id: string;
  title: string;
  time: string;
  sortAt: number;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
};

function StatCard({ icon, title, value, color }: StatCardProps) {
  return (
    <View style={styles.statCard}>
      <LinearGradient colors={[`${color}1a`, `${color}08`]} style={styles.statGradient}>
        <Ionicons name={icon} size={32} color={color} />
      </LinearGradient>
      <View>
        <Text style={styles.statTitle}>{title}</Text>
        <Text style={styles.statValue}>{value}</Text>
      </View>
    </View>
  );
}

const relativeTime = (isoDate: string): string => {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  if (Number.isNaN(then)) {
    return "just now";
  }

  const diffMins = Math.floor((now - then) / 60000);
  if (diffMins < 1) {
    return "just now";
  }
  if (diffMins < 60) {
    return `${diffMins} min ago`;
  }

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
};

const toComplaintActivity = (complaint: ComplaintRecord): ActivityItem => {
  const statusColor =
    complaint.status === "resolved"
      ? "#10b981"
      : complaint.status === "in_progress"
      ? "#f59e0b"
      : complaint.status === "assigned"
      ? "#2563eb"
      : "#64748b";

  return {
    id: complaint._id,
    title: `${complaint.title} (${complaint.status.replace("_", " ")})`,
    time: relativeTime(complaint.updatedAt || complaint.createdAt),
    sortAt: new Date(complaint.updatedAt || complaint.createdAt).getTime(),
    icon:
      complaint.status === "resolved"
        ? "check-circle"
        : complaint.status === "in_progress"
        ? "progress-check"
        : complaint.status === "assigned"
        ? "account-arrow-right"
        : "alert-circle",
    color: statusColor,
  };
};

const toNotificationActivity = (notification: AppNotification): ActivityItem => ({
  id: notification._id,
  title: notification.title,
  time: relativeTime(notification.createdAt),
  sortAt: new Date(notification.createdAt).getTime(),
  icon: notification.read ? "bell-check" : "bell-ring",
  color: notification.read ? "#64748b" : "#7c3aed",
});

export default function Dashboard() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [complaints, setComplaints] = useState<ComplaintRecord[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const loadData = useCallback(async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!sessionStore.getAccessToken()) {
      setLoading(false);
      return;
    }

    if (!silent) {
      setLoading(true);
    }
    try {
      const [complaintsData, notificationsData] = await Promise.all([
        getMyComplaints(),
        getNotifications(),
      ]);

      setComplaints(complaintsData);
      setNotifications(notificationsData);
    } catch (error) {
      Alert.alert("Dashboard error", getApiErrorMessage(error));
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadData();
      const timer = setInterval(() => {
        void loadData({ silent: true });
      }, DASHBOARD_LIVE_POLL_INTERVAL_MS);

      return () => clearInterval(timer);
    }, [loadData])
  );

  const stats = useMemo(() => {
    const resolved = complaints.filter((item) => item.status === "resolved").length;
    const inProgress = complaints.filter(
      (item) => item.status === "in_progress" || item.status === "assigned"
    ).length;
    const pending = complaints.filter(
      (item) => item.status === "reported" || item.status === "unassigned"
    ).length;

    return {
      resolved,
      inProgress,
      pending,
      total: complaints.length,
      unreadNotifications: notifications.filter((item) => !item.read).length,
    };
  }, [complaints, notifications]);

  const recentActivity = useMemo(() => {
    const fromComplaints = complaints.slice(0, 4).map(toComplaintActivity);
    const fromNotifications = notifications.slice(0, 4).map(toNotificationActivity);

    return [...fromComplaints, ...fromNotifications]
      .sort((a, b) => b.sortAt - a.sortAt)
      .slice(0, 6);
  }, [complaints, notifications]);

  if (!sessionStore.getAccessToken()) {
    return (
      <LinearGradient colors={["#f1f6fc", "#e0eaff"]} style={styles.container}>
        <View style={styles.centerState}>
          <Ionicons name="lock-closed" size={48} color="#1e3a8a" />
          <Text style={styles.centerTitle}>Login Required</Text>
          <Text style={styles.centerText}>Please login to view your dashboard.</Text>
          <Pressable style={styles.ctaButton} onPress={() => router.push("/auth")}>
            <Text style={styles.ctaText}>Go to Login</Text>
          </Pressable>
        </View>
      </LinearGradient>
    );
  }

  if (loading) {
    return (
      <LinearGradient colors={["#f1f6fc", "#e0eaff"]} style={styles.container}>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#1e3a8a" />
          <Text style={styles.centerText}>Loading dashboard...</Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={["#f1f6fc", "#e0eaff"]} style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={() => safeBack("/")}>
            <Ionicons name="arrow-back" size={28} color="#1e3a8a" />
          </Pressable>
          <Text style={styles.title}>Dashboard</Text>
          <Pressable onPress={() => void loadData()}>
            <Ionicons name="refresh" size={24} color="#1e3a8a" />
          </Pressable>
        </View>

        <View style={styles.content}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <StatCard icon="checkmark-circle-outline" title="Resolved" value={stats.resolved} color="#10b981" />
          <StatCard icon="time-outline" title="In Progress" value={stats.inProgress} color="#f59e0b" />
          <StatCard icon="alert-circle-outline" title="Pending" value={stats.pending} color="#ef4444" />
          <StatCard icon="flag-outline" title="Total Reports" value={stats.total} color="#2563eb" />
          <StatCard icon="notifications-outline" title="Unread Alerts" value={stats.unreadNotifications} color="#7c3aed" />

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            {recentActivity.length === 0 ? (
              <View style={styles.activityItem}>
                <Text style={styles.activityTitle}>No activity yet</Text>
              </View>
            ) : (
              recentActivity.map((item) => (
                <View key={item.id} style={styles.activityItem}>
                  <MaterialCommunityIcons name={item.icon} size={24} color={item.color} />
                  <View style={styles.activityContent}>
                    <Text style={styles.activityTitle}>{item.title}</Text>
                    <Text style={styles.activityTime}>{item.time}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 24,
  },
  centerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1e3a8a",
  },
  centerText: {
    fontSize: 14,
    color: "#475569",
    textAlign: "center",
  },
  ctaButton: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  ctaText: {
    color: "#fff",
    fontWeight: "700",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 44,
    paddingBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1e3a8a",
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1e3a8a",
    marginBottom: 16,
  },
  statCard: {
    backgroundColor: "rgba(255,255,255,0.85)",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    borderColor: "#dbeafe",
    borderWidth: 1.5,
  },
  statGradient: {
    width: 56,
    height: 56,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  statTitle: {
    fontSize: 13,
    color: "#6b7280",
    fontWeight: "500",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1e3a8a",
    marginTop: 2,
  },
  activityItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    backgroundColor: "rgba(255,255,255,0.85)",
    borderRadius: 12,
    padding: 12,
    borderColor: "#dbeafe",
    borderWidth: 1,
  },
  activityContent: {
    marginLeft: 12,
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1e3a8a",
  },
  activityTime: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 4,
  },
});
