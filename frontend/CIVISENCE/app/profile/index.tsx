import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { getApiErrorMessage } from "@/lib/api";
import { sessionStore } from "@/lib/session";
import { logoutUser } from "@/lib/services/auth";
import { ComplaintRecord, getMyComplaints } from "@/lib/services/complaints";
import { getNotifications, AppNotification } from "@/lib/services/notifications";
import { removeProfilePhoto, uploadProfilePhoto } from "@/lib/services/users";

type TabKey = "statistics" | "reports" | "zones";

const formatLocal = (value?: string) => {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const timeAgo = (value?: string) => {
  if (!value) return "Just now";
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) return `${Math.max(1, minutes)}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const toReadable = (text: string) =>
  text
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

const activityStatusFromTitle = (title: string) => {
  const t = title.toLowerCase();
  if (t.includes("assigned")) return { key: "assigned", label: "Assigned", icon: "business" as const };
  if (t.includes("priority") || t.includes("low") || t.includes("high")) return { key: "low", label: "Low", icon: "warning" as const };
  if (t.includes("resolved")) return { key: "done", label: "Done", icon: "checkmark-circle" as const };
  return { key: "new", label: "New", icon: "sparkles" as const };
};

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const user = sessionStore.getUser();
  const accessToken = sessionStore.getAccessToken();
  const [activeTab, setActiveTab] = useState<TabKey>("statistics");
  const [complaints, setComplaints] = useState<ComplaintRecord[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [profilePhotoUri, setProfilePhotoUri] = useState<string | null>(user?.profilePhotoUrl ?? null);

  const loadData = useCallback(async () => {
    if (!accessToken || !user?.id) {
      setComplaints([]);
      setNotifications([]);
      setProfilePhotoUri(null);
      return;
    }

    try {
      const [myComplaints, myNotifications] = await Promise.all([
        getMyComplaints(),
        getNotifications(),
      ]);
      setComplaints(myComplaints);
      setNotifications(myNotifications);
      setProfilePhotoUri(sessionStore.getUser()?.profilePhotoUrl ?? null);
    } catch (error) {
      Alert.alert("Profile error", getApiErrorMessage(error));
    }
  }, [accessToken, user?.id]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  const handlePickProfilePhoto = async () => {
    if (!accessToken) {
      Alert.alert("Login required", "Please login first.");
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow photo access to set your profile photo.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });

    if (result.canceled || !result.assets?.[0]?.uri) return;

    try {
      const updated = await uploadProfilePhoto(result.assets[0].uri);
      setProfilePhotoUri(updated.profilePhotoUrl ?? null);
    } catch (error) {
      Alert.alert("Profile photo failed", getApiErrorMessage(error));
    }
  };

  const handleRemovePhoto = async () => {
    if (!accessToken) return;
    try {
      const updated = await removeProfilePhoto();
      setProfilePhotoUri(updated.profilePhotoUrl ?? null);
    } catch (error) {
      Alert.alert("Profile photo failed", getApiErrorMessage(error));
    }
  };

  const handleLogout = async () => {
    try {
      await logoutUser();
      router.replace("/auth/login");
    } catch (error) {
      Alert.alert("Logout failed", getApiErrorMessage(error));
    }
  };

  const stats = useMemo(() => {
    const total = complaints.length;
    const inProgress = complaints.filter((c) => c.status === "assigned" || c.status === "in_progress").length;
    const resolved = complaints.filter((c) => c.status === "resolved").length;
    return { total, inProgress, resolved };
  }, [complaints]);

  const zoneRows = useMemo(() => {
    const map = new Map<string, number>();
    for (const complaint of complaints) {
      const zone = complaint.assignedMunicipalOffice?.name || "Unassigned";
      map.set(zone, (map.get(zone) || 0) + 1);
    }
    return [...map.entries()].map(([name, count]) => ({ name, count }));
  }, [complaints]);

  const activityRows = useMemo(() => {
    const seeded = [
      {
        id: "joined",
        title: "Joined CiviSense",
        time: formatLocal(user?.createdAt),
        status: { key: "new", label: "New", icon: "person" as const },
      },
      {
        id: "setup",
        title: "Profile setup completed",
        time: formatLocal(user?.updatedAt || user?.createdAt),
        status: { key: "done", label: "Done", icon: "checkmark-circle" as const },
      },
    ];

    const fromNotifications = notifications.slice(0, 5).map((item) => ({
      id: item._id,
      title: item.title,
      time: formatLocal(item.createdAt),
      status: activityStatusFromTitle(item.title),
    }));

    return [...seeded, ...fromNotifications].slice(0, 6);
  }, [notifications, user?.createdAt, user?.updatedAt]);

  if (!accessToken || !user) {
    return (
      <LinearGradient colors={["#667eea", "#764ba2"]} style={styles.center}>
        <StatusBar style="light" />
        <Text style={styles.loggedOutTitle}>Login Required</Text>
        <Text style={styles.loggedOutSub}>Sign in to view your profile.</Text>
        <Pressable style={styles.loggedOutBtn} onPress={() => router.push("/auth/login")}>
          <Text style={styles.loggedOutBtnText}>Go to Login</Text>
        </Pressable>
      </LinearGradient>
    );
  }

  const avatar = profilePhotoUri || `https://i.pravatar.cc/180?u=${user.id}`;

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Animated.View entering={FadeInDown.duration(450)} style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable style={styles.headerBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={18} color="#0F172A" />
          </Pressable>
          <Text style={styles.headerTitle}>Profile</Text>
          <Pressable style={styles.headerBtn} onPress={() => router.push("/settings")}>
            <Ionicons name="settings-outline" size={18} color="#0F172A" />
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(500).delay(40)} style={styles.heroCard}>
          <LinearGradient colors={["#4F46E5", "#7C3AED", "#A855F7"]} style={styles.heroGradient}>
            <View style={styles.heroTop}>
              <View style={styles.avatarWrap}>
                <Image source={{ uri: avatar }} style={styles.avatar} />
                <View style={styles.onlineDot} />
                <Pressable style={styles.avatarEdit} onPress={() => void handlePickProfilePhoto()}>
                  <Ionicons name="pencil" size={12} color="#4F46E5" />
                </Pressable>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.heroName} numberOfLines={1}>{user.name}</Text>
                <Text style={styles.heroEmail} numberOfLines={1}>{user.email}</Text>
                <Text style={styles.heroRole}>Citizen · CiviSense User</Text>
              </View>
            </View>
            <Pressable style={styles.removePhoto} onPress={() => void handleRemovePhoto()}>
              <Ionicons name="trash-outline" size={14} color="rgba(255,255,255,0.75)" />
              <Text style={styles.removePhotoText}>Tap to remove profile photo</Text>
            </Pressable>
          </LinearGradient>
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(500).delay(80)} style={styles.statsGrid}>
          <Pressable style={styles.statCard} onPress={() => setActiveTab("statistics")}>
            <Text style={styles.statIcon}>📋</Text>
            <Text style={[styles.statNum, { color: "#4F46E5" }]}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total Reports</Text>
          </Pressable>
          <Pressable style={styles.statCard} onPress={() => setActiveTab("statistics")}>
            <Text style={styles.statIcon}>⏳</Text>
            <Text style={[styles.statNum, { color: "#F97316" }]}>{stats.inProgress}</Text>
            <Text style={styles.statLabel}>In Progress</Text>
          </Pressable>
          <Pressable style={styles.statCard} onPress={() => setActiveTab("statistics")}>
            <Text style={styles.statIcon}>✅</Text>
            <Text style={[styles.statNum, { color: "#16A34A" }]}>{stats.resolved}</Text>
            <Text style={styles.statLabel}>Resolved</Text>
          </Pressable>
        </Animated.View>

        <View style={styles.tabsWrap}>
          {(["statistics", "reports", "zones"] as TabKey[]).map((tab) => {
            const active = activeTab === tab;
            return (
              <Pressable key={tab} style={[styles.tabBtn, active && styles.tabBtnActive]} onPress={() => setActiveTab(tab)}>
                <Text style={[styles.tabText, active && styles.tabTextActive]}>
                  {tab === "statistics" ? "Statistics" : tab === "reports" ? "Reports" : "Zones"}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.tabContent}>
          {activeTab === "statistics" ? (
            <EmptyState
              icon="📊"
              title={stats.total > 0 ? "Statistics loaded" : "No statistics yet"}
              sub={
                stats.total > 0
                  ? `You have ${stats.total} report(s). Keep improving your city.`
                  : "Start reporting issues in your city and your stats will appear here."
              }
              cta="Report First Issue"
              onPress={() => router.push("/report")}
            />
          ) : null}

          {activeTab === "reports" ? (
            complaints.length === 0 ? (
              <EmptyState
                icon="📄"
                title="No reports submitted"
                sub="You have not submitted any reports yet. Help make your city better."
                cta="Submit a Report"
                onPress={() => router.push("/report")}
              />
            ) : (
              <View style={styles.reportsList}>
                {complaints.slice(0, 5).map((complaint) => (
                  <View key={complaint._id} style={styles.reportRow}>
                    <View style={styles.reportIconBox}>
                      <Ionicons name="document-text-outline" size={16} color="#4F46E5" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reportTitle} numberOfLines={1}>{complaint.title}</Text>
                      <Text style={styles.reportSub}>
                        {toReadable(complaint.category)} · {toReadable(complaint.status)} · {timeAgo(complaint.createdAt)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )
          ) : null}

          {activeTab === "zones" ? (
            zoneRows.length === 0 ? (
              <EmptyState
                icon="🗺️"
                title="No zones assigned"
                sub="You have not been assigned to any zones yet."
                cta="Explore City Map"
                onPress={() => router.push("/map")}
              />
            ) : (
              <View style={styles.reportsList}>
                {zoneRows.map((zone) => (
                  <View key={zone.name} style={styles.reportRow}>
                    <View style={styles.reportIconBox}>
                      <Ionicons name="location-outline" size={16} color="#4F46E5" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reportTitle} numberOfLines={1}>{zone.name}</Text>
                      <Text style={styles.reportSub}>{zone.count} complaint(s)</Text>
                    </View>
                  </View>
                ))}
              </View>
            )
          ) : null}
        </View>

        <View style={styles.sectionLabelWrap}>
          <View style={styles.sectionDot} />
          <Text style={styles.sectionLabel}>Recent Activity</Text>
          <View style={styles.sectionLine} />
        </View>

        <View style={styles.activityList}>
          {activityRows.map((item, index) => (
            <View key={item.id} style={[styles.activityRow, index < activityRows.length - 1 && styles.activityBorder]}>
              <View style={styles.activityDot}>
                <Ionicons name={item.status.icon} size={14} color="#4F46E5" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.activityTitle}>{item.title}</Text>
                <Text style={styles.activityTime}>{item.time}</Text>
              </View>
              <View style={[styles.activityBadge, badgeStyle(item.status.key)]}>
                <Text style={[styles.activityBadgeText, badgeTextStyle(item.status.key)]}>{item.status.label}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.signOutWrap}>
          <Pressable style={styles.signOutBtn} onPress={() => void handleLogout()}>
            <Ionicons name="log-out-outline" size={16} color="#DC2626" />
            <Text style={styles.signOutText}>Sign Out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function EmptyState({
  icon,
  title,
  sub,
  cta,
  onPress,
}: {
  icon: string;
  title: string;
  sub: string;
  cta: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySub}>{sub}</Text>
      <Pressable style={styles.emptyBtn} onPress={onPress}>
        <Text style={styles.emptyBtnText}>{cta}</Text>
      </Pressable>
    </View>
  );
}

const badgeStyle = (key: string) => {
  if (key === "assigned") return { backgroundColor: "#F0F9FF", borderColor: "#BAE6FD" };
  if (key === "low") return { backgroundColor: "#FFF7ED", borderColor: "#FED7AA" };
  if (key === "done") return { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" };
  return { backgroundColor: "#EEF2FF", borderColor: "#C7D2FE" };
};

const badgeTextStyle = (key: string) => {
  if (key === "assigned") return { color: "#0369A1" };
  if (key === "low") return { color: "#C2410C" };
  if (key === "done") return { color: "#15803D" };
  return { color: "#4F46E5" };
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F5F7FF" },
  scroll: { paddingBottom: 26 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  loggedOutTitle: { color: "#FFF", fontSize: 24, fontWeight: "800" },
  loggedOutSub: { marginTop: 8, color: "rgba(255,255,255,0.92)", fontSize: 14, textAlign: "center" },
  loggedOutBtn: { marginTop: 14, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.2)" },
  loggedOutBtnText: { color: "#FFF", fontSize: 14, fontWeight: "700" },

  header: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    backgroundColor: "#F5F7FF",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: "700", color: "#0F172A" },

  heroCard: { marginHorizontal: 16, marginTop: 18, borderRadius: 24, overflow: "hidden" },
  heroGradient: { padding: 20 },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 16 },
  avatarWrap: { position: "relative" },
  avatar: { width: 68, height: 68, borderRadius: 20, borderWidth: 3, borderColor: "rgba(255,255,255,0.35)" },
  onlineDot: { position: "absolute", top: -3, right: -3, width: 14, height: 14, borderRadius: 7, borderWidth: 2.5, borderColor: "#4F46E5", backgroundColor: "#22C55E" },
  avatarEdit: { position: "absolute", bottom: -4, right: -4, width: 24, height: 24, borderRadius: 8, backgroundColor: "#FFF", alignItems: "center", justifyContent: "center" },
  heroName: { color: "#FFF", fontSize: 20, fontWeight: "800" },
  heroEmail: { color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 3 },
  heroRole: { color: "rgba(255,255,255,0.62)", fontSize: 12, marginTop: 5 },
  removePhoto: { marginTop: 14, borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", borderStyle: "dashed", backgroundColor: "rgba(255,255,255,0.1)", paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  removePhotoText: { color: "rgba(255,255,255,0.75)", fontSize: 12.5, fontWeight: "500" },

  statsGrid: { marginHorizontal: 16, marginTop: 14, flexDirection: "row", gap: 10 },
  statCard: { flex: 1, backgroundColor: "#FFF", borderRadius: 18, borderWidth: 1.5, borderColor: "#E2E8F0", alignItems: "center", paddingVertical: 14, paddingHorizontal: 10 },
  statIcon: { fontSize: 20 },
  statNum: { marginTop: 6, fontSize: 22, fontWeight: "800" },
  statLabel: { marginTop: 2, fontSize: 10.5, fontWeight: "600", color: "#64748B", textAlign: "center" },

  tabsWrap: { marginHorizontal: 16, marginTop: 18, borderRadius: 16, borderWidth: 1.5, borderColor: "#E2E8F0", backgroundColor: "#FFF", padding: 5, flexDirection: "row", gap: 4 },
  tabBtn: { flex: 1, borderRadius: 12, paddingVertical: 9, alignItems: "center", justifyContent: "center" },
  tabBtnActive: { backgroundColor: "#4F46E5" },
  tabText: { fontSize: 12.5, fontWeight: "600", color: "#64748B" },
  tabTextActive: { color: "#FFF" },

  tabContent: { marginHorizontal: 16, marginTop: 14 },
  emptyCard: { backgroundColor: "#FFF", borderRadius: 20, borderWidth: 1.5, borderStyle: "dashed", borderColor: "#E2E8F0", paddingVertical: 28, paddingHorizontal: 20, alignItems: "center" },
  emptyIcon: { fontSize: 36 },
  emptyTitle: { marginTop: 10, fontSize: 14, fontWeight: "700", color: "#0F172A" },
  emptySub: { marginTop: 5, fontSize: 12.5, color: "#64748B", textAlign: "center", lineHeight: 18 },
  emptyBtn: { marginTop: 14, backgroundColor: "#4F46E5", borderRadius: 12, paddingHorizontal: 18, paddingVertical: 9 },
  emptyBtnText: { color: "#FFF", fontSize: 12.5, fontWeight: "700" },

  reportsList: { backgroundColor: "#FFF", borderRadius: 16, borderWidth: 1.5, borderColor: "#E2E8F0", overflow: "hidden" },
  reportRow: { paddingVertical: 12, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  reportIconBox: { width: 30, height: 30, borderRadius: 8, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center" },
  reportTitle: { color: "#0F172A", fontSize: 12.5, fontWeight: "700" },
  reportSub: { marginTop: 2, color: "#64748B", fontSize: 11.5 },

  sectionLabelWrap: { marginTop: 20, marginHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 8 },
  sectionDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#4F46E5" },
  sectionLabel: { color: "#64748B", fontSize: 12, fontWeight: "700", letterSpacing: 1 },
  sectionLine: { flex: 1, height: 1, backgroundColor: "#E2E8F0" },

  activityList: { marginHorizontal: 16, marginTop: 10, backgroundColor: "#FFF", borderRadius: 20, borderWidth: 1.5, borderColor: "#E2E8F0", overflow: "hidden" },
  activityRow: { paddingVertical: 13, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 10 },
  activityBorder: { borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  activityDot: { width: 32, height: 32, borderRadius: 10, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center" },
  activityTitle: { color: "#0F172A", fontSize: 12.5, fontWeight: "600" },
  activityTime: { marginTop: 2, color: "#94A3B8", fontSize: 11 },
  activityBadge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  activityBadgeText: { fontSize: 10, fontWeight: "700" },

  signOutWrap: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 4 },
  signOutBtn: { borderRadius: 16, borderWidth: 1.5, borderColor: "#FECACA", backgroundColor: "#FFF", minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  signOutText: { color: "#DC2626", fontSize: 14, fontWeight: "700" },
});
