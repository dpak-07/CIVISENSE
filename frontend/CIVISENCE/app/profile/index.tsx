import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
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
import { safeBack } from "@/lib/navigation";
import { sessionStore } from "@/lib/session";
import { logoutUser } from "@/lib/services/auth";
import { ComplaintRecord, getMyComplaints } from "@/lib/services/complaints";
import { getNotifications, AppNotification } from "@/lib/services/notifications";
import { getMunicipalOffices, MunicipalOffice } from "@/lib/services/municipalOffices";
import { removeProfilePhoto, uploadProfilePhoto } from "@/lib/services/users";

type TabKey = "statistics" | "reports" | "zones";
type ZoneRow = {
  id: string;
  officeName: string;
  zone: string;
  complaintsCount: number;
  isActive: boolean;
  coordinates: { latitude: number; longitude: number } | null;
};
type ActivityBadge = {
  key: "new" | "assigned" | "low" | "done";
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

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

const activityStatusFromTitle = (title: string): ActivityBadge => {
  const t = title.toLowerCase();
  if (t.includes("assigned")) return { key: "assigned", label: "Assigned", icon: "business" as const };
  if (t.includes("priority") || t.includes("low") || t.includes("high") || t.includes("rejected")) {
    return { key: "low", label: "Update", icon: "warning" as const };
  }
  if (t.includes("resolved")) return { key: "done", label: "Done", icon: "checkmark-circle" as const };
  return { key: "new", label: "New", icon: "sparkles" as const };
};

const activityStatusFromComplaint = (status: string): ActivityBadge => {
  if (status === "resolved") return { key: "done", label: "Done", icon: "checkmark-circle" };
  if (status === "assigned" || status === "in_progress") {
    return { key: "assigned", label: "Assigned", icon: "business" };
  }
  if (status === "rejected") return { key: "low", label: "Rejected", icon: "close-circle" };
  return { key: "new", label: "New", icon: "document-text" };
};

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const user = sessionStore.getUser();
  const accessToken = sessionStore.getAccessToken();
  const [activeTab, setActiveTab] = useState<TabKey>("statistics");
  const [complaints, setComplaints] = useState<ComplaintRecord[]>([]);
  const [offices, setOffices] = useState<MunicipalOffice[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [profilePhotoUri, setProfilePhotoUri] = useState<string | null>(user?.profilePhotoUrl ?? null);
  const [selectedZone, setSelectedZone] = useState<ZoneRow | null>(null);

  const loadData = useCallback(async () => {
    if (!accessToken || !user?.id) {
      setComplaints([]);
      setOffices([]);
      setNotifications([]);
      setProfilePhotoUri(null);
      return;
    }

    try {
      const [myComplaints, myNotifications, officeData] = await Promise.all([
        getMyComplaints(),
        getNotifications(),
        getMunicipalOffices(),
      ]);
      setComplaints(myComplaints);
      setNotifications(myNotifications);
      setOffices(officeData);
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
      router.replace("/auth");
    } catch (error) {
      Alert.alert("Logout failed", getApiErrorMessage(error));
    }
  };

  const stats = useMemo(() => {
    const total = complaints.length;
    const inProgress = complaints.filter((c) => c.status === "assigned" || c.status === "in_progress").length;
    const resolved = complaints.filter((c) => c.status === "resolved").length;
    const rejected = complaints.filter((c) => c.status === "rejected").length;
    const open = Math.max(0, total - resolved - rejected);
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;
    const latestReport = complaints.reduce<string | undefined>((latest, complaint) => {
      if (!complaint.createdAt) return latest;
      if (!latest) return complaint.createdAt;
      return new Date(complaint.createdAt).getTime() > new Date(latest).getTime()
        ? complaint.createdAt
        : latest;
    }, undefined);
    return { total, inProgress, resolved, rejected, open, resolutionRate, latestReport };
  }, [complaints]);

  const zoneRows = useMemo(() => {
    const complaintsPerOffice = new Map<string, number>();
    const fallbackZoneByOffice = new Map<string, string>();

    for (const complaint of complaints) {
      const officeName = complaint.assignedMunicipalOffice?.name;
      if (!officeName) continue;
      complaintsPerOffice.set(officeName, (complaintsPerOffice.get(officeName) || 0) + 1);
      if (complaint.assignedMunicipalOffice?.zone) {
        fallbackZoneByOffice.set(officeName, complaint.assignedMunicipalOffice.zone);
      }
    }

    const officeByName = new Map(offices.map((office) => [office.name, office]));
    const rows: ZoneRow[] = [];

    complaintsPerOffice.forEach((count, officeName) => {
      const office = officeByName.get(officeName);
      rows.push({
        id: office?._id || `zone-${officeName}`,
        officeName,
        zone: office?.zone || fallbackZoneByOffice.get(officeName) || "Unknown",
        complaintsCount: count,
        isActive: office?.isActive ?? true,
        coordinates: toLatLng(office?.location?.coordinates),
      });
    });

    if (rows.length === 0) {
      return offices.slice(0, 6).map((office) => ({
        id: office._id,
        officeName: office.name,
        zone: office.zone,
        complaintsCount: 0,
        isActive: office.isActive,
        coordinates: toLatLng(office.location?.coordinates),
      }));
    }

    return rows.sort((a, b) => b.complaintsCount - a.complaintsCount);
  }, [complaints, offices]);

  const activityRows = useMemo(() => {
    const joinedTs = user?.createdAt ? new Date(user.createdAt).getTime() : Date.now();
    const seeded = [
      {
        id: "joined",
        title: "Joined CiviSense",
        status: { key: "new", label: "New", icon: "person" } as ActivityBadge,
        createdAt: joinedTs,
      },
    ];

    const fromComplaints = complaints.map((item) => {
      const ts = new Date(item.updatedAt || item.createdAt).getTime();
      let title = `Reported: ${item.title}`;
      if (item.status === "resolved") {
        title = `Resolved: ${item.title}`;
      } else if (item.status === "assigned" || item.status === "in_progress") {
        const office = item.assignedMunicipalOffice?.name ? ` to ${item.assignedMunicipalOffice.name}` : "";
        title = `Assigned${office}: ${item.title}`;
      } else if (item.status === "rejected") {
        title = `Rejected: ${item.title}`;
      }

      return {
        id: `complaint-${item._id}`,
        title,
        status: activityStatusFromComplaint(item.status),
        createdAt: Number.isFinite(ts) ? ts : Date.now(),
      };
    });

    const fromNotifications = notifications.map((item) => {
      const ts = new Date(item.createdAt).getTime();
      return {
        id: `notif-${item._id}`,
        title: item.title,
        status: activityStatusFromTitle(item.title),
        createdAt: Number.isFinite(ts) ? ts : Date.now(),
      };
    });

    return [...fromComplaints, ...fromNotifications, ...seeded]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 8)
      .map((entry) => ({
        id: entry.id,
        title: entry.title,
        time: `${formatLocal(new Date(entry.createdAt).toISOString())} - ${timeAgo(
          new Date(entry.createdAt).toISOString()
        )}`,
        status: entry.status,
      }));
  }, [complaints, notifications, user?.createdAt]);

  if (!accessToken || !user) {
    return (
      <LinearGradient colors={["#667eea", "#764ba2"]} style={styles.center}>
        <StatusBar style="light" />
        <Text style={styles.loggedOutTitle}>Login Required</Text>
        <Text style={styles.loggedOutSub}>Sign in to view your profile.</Text>
        <Pressable style={styles.loggedOutBtn} onPress={() => router.push("/auth")}>
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
          <Pressable style={styles.headerBtn} onPress={() => safeBack("/")}>
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
                <Text style={styles.heroRole}>Citizen - CiviSense User</Text>
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
            <Ionicons name="document-text-outline" size={20} color="#4F46E5" />
            <Text style={[styles.statNum, { color: "#4F46E5" }]}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total Reports</Text>
          </Pressable>
          <Pressable style={styles.statCard} onPress={() => setActiveTab("statistics")}>
            <Ionicons name="time-outline" size={20} color="#F97316" />
            <Text style={[styles.statNum, { color: "#F97316" }]}>{stats.inProgress}</Text>
            <Text style={styles.statLabel}>In Progress</Text>
          </Pressable>
          <Pressable style={styles.statCard} onPress={() => setActiveTab("statistics")}>
            <Ionicons name="checkmark-circle-outline" size={20} color="#16A34A" />
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
            stats.total === 0 ? (
              <EmptyState
                iconName="stats-chart"
                title="No statistics yet"
                sub="Start reporting issues in your city and your stats will appear here."
                cta="Report First Issue"
                onPress={() => router.push("/report")}
              />
            ) : (
              <View style={styles.statisticsCard}>
                <View style={styles.statisticsRow}>
                  <View style={styles.statisticsMetric}>
                    <Text style={styles.statisticsMetricValue}>{stats.open}</Text>
                    <Text style={styles.statisticsMetricLabel}>Open</Text>
                  </View>
                  <View style={styles.statisticsMetric}>
                    <Text style={styles.statisticsMetricValue}>{stats.inProgress}</Text>
                    <Text style={styles.statisticsMetricLabel}>Assigned/In progress</Text>
                  </View>
                </View>
                <View style={styles.statisticsRow}>
                  <View style={styles.statisticsMetric}>
                    <Text style={[styles.statisticsMetricValue, { color: "#16A34A" }]}>{stats.resolved}</Text>
                    <Text style={styles.statisticsMetricLabel}>Resolved</Text>
                  </View>
                  <View style={styles.statisticsMetric}>
                    <Text style={[styles.statisticsMetricValue, { color: "#DC2626" }]}>{stats.rejected}</Text>
                    <Text style={styles.statisticsMetricLabel}>Rejected</Text>
                  </View>
                </View>
                <View style={styles.statisticsFooter}>
                  <Text style={styles.statisticsFooterText}>Resolution rate: {stats.resolutionRate}%</Text>
                  <Text style={styles.statisticsFooterText}>
                    Last report: {stats.latestReport ? formatLocal(stats.latestReport) : "N/A"}
                  </Text>
                </View>
              </View>
            )
          ) : null}

          {activeTab === "reports" ? (
            complaints.length === 0 ? (
              <EmptyState
                iconName="document-text"
                title="No reports submitted"
                sub="You have not submitted any reports yet. Help make your city better."
                cta="Submit a Report"
                onPress={() => router.push("/report")}
              />
            ) : (
              <View style={styles.reportsList}>
                {complaints.slice(0, 5).map((complaint, index) => (
                  <View
                    key={complaint._id}
                    style={[styles.reportRow, index === Math.min(complaints.length, 5) - 1 && styles.reportRowLast]}
                  >
                    <View style={styles.reportIconBox}>
                      <Ionicons name="document-text-outline" size={16} color="#4F46E5" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reportTitle} numberOfLines={1}>{complaint.title}</Text>
                      <Text style={styles.reportSub}>
                        {toReadable(complaint.category)} - {toReadable(complaint.status)} - {timeAgo(complaint.createdAt)}
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
                iconName="map"
                title="No zones assigned"
                sub="You have not been assigned to any zones yet."
                cta="Explore City Map"
                onPress={() => router.push("/map")}
              />
            ) : (
              <View style={styles.reportsList}>
                {zoneRows.map((zone, index) => (
                  <Pressable
                    key={zone.id}
                    style={[styles.reportRow, index === zoneRows.length - 1 && styles.reportRowLast]}
                    onPress={() => setSelectedZone(zone)}
                  >
                    <View style={styles.reportIconBox}>
                      <Ionicons name="location-outline" size={16} color="#4F46E5" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reportTitle} numberOfLines={1}>{zone.officeName}</Text>
                      <Text style={styles.reportSub}>
                        Zone {zone.zone} - {zone.complaintsCount} complaint(s)
                      </Text>
                    </View>
                    <View style={styles.zoneRight}>
                      <Text style={[styles.zoneBadge, zone.isActive ? styles.zoneBadgeActive : styles.zoneBadgeInactive]}>
                        {zone.isActive ? "Active" : "Inactive"}
                      </Text>
                      <Ionicons name="chevron-forward" size={14} color="#94A3B8" />
                    </View>
                  </Pressable>
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
      <Modal
        visible={Boolean(selectedZone)}
        transparent
        animationType="fade"
        statusBarTranslucent
        presentationStyle="overFullScreen"
        onRequestClose={() => setSelectedZone(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle} numberOfLines={2}>
                  {selectedZone?.officeName}
                </Text>
                <Text style={styles.modalSub}>Zone {selectedZone?.zone}</Text>
              </View>
              <Pressable onPress={() => setSelectedZone(null)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={18} color="#475569" />
              </Pressable>
            </View>
            <View style={styles.modalInfoRow}>
              <Text style={styles.modalInfoLabel}>Assigned complaints</Text>
              <Text style={styles.modalInfoValue}>{selectedZone?.complaintsCount ?? 0}</Text>
            </View>
            <View style={styles.modalInfoRow}>
              <Text style={styles.modalInfoLabel}>Office status</Text>
              <Text style={styles.modalInfoValue}>{selectedZone?.isActive ? "Active" : "Inactive"}</Text>
            </View>
            <View style={styles.modalActions}>
              <Pressable style={styles.modalSecondaryBtn} onPress={() => setSelectedZone(null)}>
                <Text style={styles.modalSecondaryText}>Close</Text>
              </Pressable>
              <Pressable
                style={[styles.modalPrimaryBtn, !selectedZone?.coordinates && styles.modalPrimaryBtnDisabled]}
                onPress={() =>
                  selectedZone?.coordinates
                    ? void openDirections(
                        selectedZone.coordinates.latitude,
                        selectedZone.coordinates.longitude
                      )
                    : Alert.alert("Location unavailable", "No map coordinates for this office.")
                }
              >
                <Ionicons name="navigate" size={14} color="#FFFFFF" />
                <Text style={styles.modalPrimaryText}>Get Directions</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function EmptyState({
  iconName,
  title,
  sub,
  cta,
  onPress,
}: {
  iconName: keyof typeof Ionicons.glyphMap;
  title: string;
  sub: string;
  cta: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.emptyCard}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name={iconName} size={28} color="#4F46E5" />
      </View>
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

const toLatLng = (coords?: [number, number]) => {
  if (!coords || coords.length !== 2) {
    return null;
  }
  const [longitude, latitude] = coords;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  return { latitude, longitude };
};

const openDirections = async (latitude: number, longitude: number) => {
  const url =
    Platform.OS === "ios"
      ? `http://maps.apple.com/?ll=${latitude},${longitude}`
      : `https://www.google.com/maps?q=${latitude},${longitude}`;
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert("Directions unavailable", "Could not open maps on this device.");
  }
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
  statNum: { marginTop: 6, fontSize: 22, fontWeight: "800" },
  statLabel: { marginTop: 2, fontSize: 10.5, fontWeight: "600", color: "#64748B", textAlign: "center" },

  tabsWrap: { marginHorizontal: 16, marginTop: 18, borderRadius: 16, borderWidth: 1.5, borderColor: "#E2E8F0", backgroundColor: "#FFF", padding: 5, flexDirection: "row", gap: 4 },
  tabBtn: { flex: 1, borderRadius: 12, paddingVertical: 9, alignItems: "center", justifyContent: "center" },
  tabBtnActive: { backgroundColor: "#4F46E5" },
  tabText: { fontSize: 12.5, fontWeight: "600", color: "#64748B" },
  tabTextActive: { color: "#FFF" },

  tabContent: { marginHorizontal: 16, marginTop: 14 },
  statisticsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    padding: 14,
    gap: 10,
  },
  statisticsRow: {
    flexDirection: "row",
    gap: 10,
  },
  statisticsMetric: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  statisticsMetricValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1E3A8A",
  },
  statisticsMetricLabel: {
    marginTop: 3,
    fontSize: 11.5,
    color: "#64748B",
    fontWeight: "600",
    textAlign: "center",
  },
  statisticsFooter: {
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    paddingTop: 10,
    gap: 4,
  },
  statisticsFooterText: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "600",
  },
  emptyCard: { backgroundColor: "#FFF", borderRadius: 20, borderWidth: 1.5, borderStyle: "dashed", borderColor: "#E2E8F0", paddingVertical: 28, paddingHorizontal: 20, alignItems: "center" },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { marginTop: 10, fontSize: 14, fontWeight: "700", color: "#0F172A" },
  emptySub: { marginTop: 5, fontSize: 12.5, color: "#64748B", textAlign: "center", lineHeight: 18 },
  emptyBtn: { marginTop: 14, backgroundColor: "#4F46E5", borderRadius: 12, paddingHorizontal: 18, paddingVertical: 9 },
  emptyBtnText: { color: "#FFF", fontSize: 12.5, fontWeight: "700" },

  reportsList: { backgroundColor: "#FFF", borderRadius: 16, borderWidth: 1.5, borderColor: "#E2E8F0", overflow: "hidden" },
  reportRow: { paddingVertical: 12, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: "#E2E8F0" },
  reportRowLast: { borderBottomWidth: 0 },
  reportIconBox: { width: 30, height: 30, borderRadius: 8, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center" },
  reportTitle: { color: "#0F172A", fontSize: 12.5, fontWeight: "700" },
  reportSub: { marginTop: 2, color: "#64748B", fontSize: 11.5 },
  zoneRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  zoneBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    fontSize: 10,
    fontWeight: "700",
    overflow: "hidden",
  },
  zoneBadgeActive: { color: "#15803D", borderColor: "#86EFAC", backgroundColor: "#F0FDF4" },
  zoneBadgeInactive: { color: "#B45309", borderColor: "#FCD34D", backgroundColor: "#FFFBEB" },

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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  modalSub: {
    marginTop: 3,
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600",
  },
  modalCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  modalInfoRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalInfoLabel: {
    fontSize: 12.5,
    color: "#64748B",
    fontWeight: "600",
  },
  modalInfoValue: {
    fontSize: 12.5,
    color: "#0F172A",
    fontWeight: "700",
  },
  modalActions: {
    marginTop: 16,
    flexDirection: "row",
    gap: 10,
  },
  modalSecondaryBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
  },
  modalSecondaryText: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "700",
  },
  modalPrimaryBtn: {
    flex: 1.3,
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  modalPrimaryBtnDisabled: {
    opacity: 0.55,
  },
  modalPrimaryText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});
