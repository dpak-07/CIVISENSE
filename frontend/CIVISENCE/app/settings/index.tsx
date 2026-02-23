import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import * as Location from "expo-location";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getApiErrorMessage } from "@/lib/api";
import { AppLanguage, AppPreferences } from "@/lib/preferences";
import { languageLabel } from "@/lib/i18n";
import { useAppPreferences } from "@/lib/appPreferencesContext";
import { sessionStore } from "@/lib/session";
import { logoutUser } from "@/lib/services/auth";
import {
  AppNotification,
  getNotifications,
  markNotificationRead,
} from "@/lib/services/notifications";
import { deleteAccount, updateUserLanguage } from "@/lib/services/users";

const formatTime = (value: string) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return "Unknown";
  }
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { preferences, setDarkMode, setLanguage, setPreferenceFlags, theme, t } = useAppPreferences();
  const [loading, setLoading] = useState(true);
  const [notificationStatus, setNotificationStatus] = useState("unknown");
  const [locationStatus, setLocationStatus] = useState("unknown");
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [notifModule, setNotifModule] = useState<(typeof import("expo-notifications")) | null>(null);
  const [user, setUser] = useState(sessionStore.getUser());
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const canUseNotifications = Platform.OS !== "web";
  const isDark = theme.mode === "dark";

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.read).length,
    [notifications]
  );

  const toStatusLabel = useCallback(
    (status: string) => {
      if (status === "granted") return t("settings.systemGranted");
      if (status === "denied") return t("settings.systemDenied");
      return t("settings.systemUnknown");
    },
    [t]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (canUseNotifications) {
        let module = notifModule;
        if (!module) {
          const imported = await import("expo-notifications");
          module = imported;
          setNotifModule(imported);
        }
        const permissions = await module.getPermissionsAsync();
        setNotificationStatus(permissions.status || "unknown");
      } else {
        setNotificationStatus("unavailable");
      }

      const locationPermission = await Location.getForegroundPermissionsAsync();
      setLocationStatus(locationPermission.status || "unknown");

      if (sessionStore.getAccessToken()) {
        setNotifications(await getNotifications());
      } else {
        setNotifications([]);
      }
    } catch (error) {
      Alert.alert("Settings error", getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [canUseNotifications, notifModule]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const unsubscribe = sessionStore.subscribe(() => setUser(sessionStore.getUser()));
    return unsubscribe;
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  const updateFlags = async (
    next: Pick<AppPreferences, "notificationsEnabled" | "locationEnabled">
  ) => {
    try {
      await setPreferenceFlags(next);
    } catch {
      Alert.alert("Save failed", "Could not save settings.");
    }
  };

  const toggleNotifications = async (value: boolean) => {
    if (value) {
      let module = notifModule;
      if (!module) {
        const imported = await import("expo-notifications");
        module = imported;
        setNotifModule(imported);
      }
      const permission = await module.requestPermissionsAsync();
      const granted = permission.status === "granted";
      setNotificationStatus(permission.status || "unknown");
      await updateFlags({
        notificationsEnabled: granted,
        locationEnabled: preferences.locationEnabled,
      });
      if (!granted) {
        Alert.alert(t("settings.permissionDenied"), t("settings.enableNotifications"));
      }
      return;
    }

    await updateFlags({
      notificationsEnabled: false,
      locationEnabled: preferences.locationEnabled,
    });
    Alert.alert("System setting required", "Disable notification permission from system settings.", [
      { text: "Open Settings", onPress: () => Linking.openSettings() },
      { text: t("common.close") },
    ]);
  };

  const toggleLocation = async (value: boolean) => {
    if (value) {
      const permission = await Location.requestForegroundPermissionsAsync();
      const granted = permission.status === "granted";
      setLocationStatus(permission.status || "unknown");
      await updateFlags({
        notificationsEnabled: preferences.notificationsEnabled,
        locationEnabled: granted,
      });
      if (!granted) {
        Alert.alert(t("settings.permissionDenied"), t("settings.enableLocation"));
      }
      return;
    }

    await updateFlags({
      notificationsEnabled: preferences.notificationsEnabled,
      locationEnabled: false,
    });
    Alert.alert("System setting required", "Disable location permission from system settings.", [
      { text: "Open Settings", onPress: () => Linking.openSettings() },
      { text: t("common.close") },
    ]);
  };

  const toggleDarkMode = async (value: boolean) => {
    try {
      await setDarkMode(value);
    } catch {
      Alert.alert("Save failed", "Could not save settings.");
    }
  };

  const applyLanguage = async (language: AppLanguage) => {
    try {
      await setLanguage(language);
      if (sessionStore.getAccessToken()) {
        await updateUserLanguage(language);
      }
      Alert.alert(t("settings.languageUpdated"), languageLabel(language));
    } catch {
      Alert.alert("Save failed", "Could not save settings.");
    }
  };

  const openLanguagePicker = () => {
    Alert.alert(t("settings.changeLanguage"), undefined, [
      { text: t("settings.languageEnglish"), onPress: () => void applyLanguage("en") },
      { text: t("settings.languageTamil"), onPress: () => void applyLanguage("ta") },
      { text: t("settings.languageHindi"), onPress: () => void applyLanguage("hi") },
      { text: t("common.cancel"), style: "cancel" },
    ]);
  };

  const onMarkRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((item) => (item._id === id ? { ...item, read: true } : item))
      );
    } catch (error) {
      Alert.alert("Update failed", getApiErrorMessage(error));
    }
  };

  const onLogout = async () => {
    try {
      await logoutUser();
      router.replace("/auth/login");
    } catch (error) {
      Alert.alert("Logout failed", getApiErrorMessage(error));
    }
  };

  const onDeleteAccount = async () => {
    if (deleteText.trim().toUpperCase() !== "DELETE") {
      Alert.alert("Confirmation required", "Type DELETE to confirm.");
      return;
    }

    setDeleting(true);
    try {
      await deleteAccount();
      setDeleteModal(false);
      setDeleteText("");
      Alert.alert("Account deleted", "Your account was deleted.");
      router.replace("/auth/login");
    } catch (error) {
      Alert.alert("Delete failed", getApiErrorMessage(error));
    } finally {
      setDeleting(false);
    }
  };

  const badge =
    user?.role && ["admin", "municipal"].includes(user.role.toLowerCase())
      ? "Pro"
      : t("home.citizen");

  const gradients = isDark
    ? (["#070B14", "#0D1529", "#101A31"] as const)
    : (["#DDE1F0", "#E9EDFB", "#F5F7FF"] as const);

  if (loading) {
    return (
      <LinearGradient colors={gradients} style={styles.loader}>
        <StatusBar style={theme.statusBar} />
        <ActivityIndicator size="large" color={theme.colors.accent} />
        <Text style={[styles.loaderText, { color: theme.colors.subText }]}>
          {t("common.loading")}
        </Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={gradients} style={styles.container}>
      <StatusBar style={theme.statusBar} />
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
            backgroundColor: isDark ? "rgba(15,23,42,0.9)" : "rgba(255,255,255,0.92)",
            borderBottomColor: theme.colors.border,
          },
        ]}
      >
        <Pressable
          style={[
            styles.iconBtn,
            {
              backgroundColor: theme.colors.surfaceAlt,
              borderColor: theme.colors.border,
            },
          ]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={18} color={theme.colors.text} />
        </Pressable>
        <Text style={[styles.title, { color: theme.colors.text }]}>{t("settings.title")}</Text>
        <Pressable
          style={[
            styles.iconBtn,
            {
              backgroundColor: theme.colors.surfaceAlt,
              borderColor: theme.colors.border,
            },
          ]}
          onPress={() => void loadData()}
        >
          <Ionicons name="refresh" size={18} color={theme.colors.subText} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(360)}>
          <Text style={[styles.section, { color: theme.colors.subText }]}>{t("settings.account")}</Text>
          <View
            style={[
              styles.accountCard,
              {
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surface,
              },
            ]}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{(user?.name || "U").charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: theme.colors.text }]} numberOfLines={1}>
                {user?.name || "Guest"}
              </Text>
              <Text style={[styles.email, { color: theme.colors.subText }]} numberOfLines={1}>
                {user?.email || "Not logged in"}
              </Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(360).delay(80)}>
          <Text style={[styles.section, { color: theme.colors.subText }]}>
            {t("settings.preferences")}
          </Text>
          <View
            style={[
              styles.group,
              {
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surface,
              },
            ]}
          >
            <Row
              icon="notifications"
              title={t("settings.pushNotifications")}
              sub={`System: ${toStatusLabel(notificationStatus)} · ${t("settings.unreadCount", {
                count: unreadCount,
              })}`}
              right={
                <Switch
                  value={preferences.notificationsEnabled}
                  onValueChange={(value) => void toggleNotifications(value)}
                />
              }
              isDark={isDark}
              themeText={theme.colors.text}
              themeSubText={theme.colors.subText}
              themeBorder={theme.colors.border}
              themeSurfaceAlt={theme.colors.surfaceAlt}
            />
            <Row
              icon="location"
              title={t("settings.locationServices")}
              sub={`System: ${toStatusLabel(locationStatus)} · Used in report flow`}
              right={
                <Switch
                  value={preferences.locationEnabled}
                  onValueChange={(value) => void toggleLocation(value)}
                />
              }
              isDark={isDark}
              themeText={theme.colors.text}
              themeSubText={theme.colors.subText}
              themeBorder={theme.colors.border}
              themeSurfaceAlt={theme.colors.surfaceAlt}
            />
            <Row
              icon="moon"
              title={t("settings.darkMode")}
              sub={preferences.darkMode ? "Currently: Dark theme" : "Currently: Light theme"}
              right={
                <Switch
                  value={preferences.darkMode}
                  onValueChange={(value) => void toggleDarkMode(value)}
                />
              }
              isDark={isDark}
              themeText={theme.colors.text}
              themeSubText={theme.colors.subText}
              themeBorder={theme.colors.border}
              themeSurfaceAlt={theme.colors.surfaceAlt}
            />
            <Row
              icon="language"
              title={t("settings.language")}
              sub={languageLabel(preferences.language)}
              onPress={openLanguagePicker}
              right={<Ionicons name="chevron-forward" size={14} color={theme.colors.subText} />}
              isDark={isDark}
              themeText={theme.colors.text}
              themeSubText={theme.colors.subText}
              themeBorder={theme.colors.border}
              themeSurfaceAlt={theme.colors.surfaceAlt}
            />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(360).delay(130)}>
          <Text style={[styles.section, { color: theme.colors.subText }]}>
            {t("settings.latestNotifications")}
          </Text>
          <View style={styles.list}>
            {notifications.length === 0 ? (
              <Text
                style={[
                  styles.empty,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                    color: theme.colors.subText,
                  },
                ]}
              >
                No notifications yet
              </Text>
            ) : (
              notifications.slice(0, 5).map((item) => (
                <View
                  key={item._id}
                  style={[
                    styles.notif,
                    {
                      borderColor: theme.colors.border,
                      backgroundColor: theme.colors.surface,
                    },
                  ]}
                >
                  <Text style={[styles.notifTitle, { color: theme.colors.text }]}>
                    {item.title}
                  </Text>
                  <Text
                    style={[styles.notifBody, { color: theme.colors.subText }]}
                    numberOfLines={expanded.has(item._id) ? undefined : 3}
                  >
                    {item.message}
                  </Text>
                  <View style={styles.notifFoot}>
                    <Text style={styles.notifTime}>{formatTime(item.createdAt)}</Text>
                    {!item.read ? (
                      <Pressable onPress={() => void onMarkRead(item._id)}>
                        <Text style={styles.markRead}>Mark read</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  <Pressable
                    onPress={() =>
                      setExpanded((prev) => {
                        const next = new Set(prev);
                        if (next.has(item._id)) {
                          next.delete(item._id);
                        } else {
                          next.add(item._id);
                        }
                        return next;
                      })
                    }
                  >
                    <Text style={styles.expand}>
                      {expanded.has(item._id) ? "Show less" : "Show more"}
                    </Text>
                  </Pressable>
                </View>
              ))
            )}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(360).delay(170)}>
          <Text style={[styles.section, { color: theme.colors.subText }]}>
            {t("settings.accountActions")}
          </Text>
          <View
            style={[
              styles.group,
              {
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.surface,
              },
            ]}
          >
            <Row
              icon="log-out-outline"
              title={t("settings.signOut")}
              sub="You'll need to log in again"
              onPress={() => void onLogout()}
              danger
              right={<Ionicons name="chevron-forward" size={14} color="#FCA5A5" />}
              isDark={isDark}
              themeText={theme.colors.text}
              themeSubText={theme.colors.subText}
              themeBorder={theme.colors.border}
              themeSurfaceAlt={theme.colors.surfaceAlt}
            />
            <Row
              icon="trash-outline"
              title={t("settings.deleteAccount")}
              sub="Permanently removes access to your account"
              onPress={() => setDeleteModal(true)}
              danger
              right={<Ionicons name="chevron-forward" size={14} color="#FCA5A5" />}
              isDark={isDark}
              themeText={theme.colors.text}
              themeSubText={theme.colors.subText}
              themeBorder={theme.colors.border}
              themeSurfaceAlt={theme.colors.surfaceAlt}
            />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInUp.duration(360).delay(220)}>
          <Text style={[styles.version, { color: theme.colors.subText }]}>
            CiviSense v2.1.0 · {t("app.tagline")}
          </Text>
        </Animated.View>
      </ScrollView>

      <Modal visible={deleteModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modal,
              {
                backgroundColor: theme.colors.surface,
              },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              {t("settings.deleteAccount")}
            </Text>
            <Text style={[styles.modalSub, { color: theme.colors.subText }]}>
              {t("settings.typeDelete")}
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.surfaceAlt,
                  color: theme.colors.text,
                },
              ]}
              value={deleteText}
              onChangeText={setDeleteText}
              autoCapitalize="characters"
              placeholder="Type DELETE"
              placeholderTextColor="#94A3B8"
            />
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.cancelBtn, { backgroundColor: theme.colors.surfaceAlt }]}
                onPress={() => {
                  setDeleteModal(false);
                  setDeleteText("");
                }}
              >
                <Text style={[styles.cancelText, { color: theme.colors.text }]}>
                  {t("common.cancel")}
                </Text>
              </Pressable>
              <Pressable
                style={styles.deleteBtn}
                onPress={() => void onDeleteAccount()}
                disabled={deleting}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.deleteText}>{t("settings.delete")}</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

function Row({
  icon,
  title,
  sub,
  right,
  onPress,
  danger,
  isDark,
  themeText,
  themeSubText,
  themeBorder,
  themeSurfaceAlt,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  sub: string;
  right: React.ReactNode;
  onPress?: () => void;
  danger?: boolean;
  isDark: boolean;
  themeText: string;
  themeSubText: string;
  themeBorder: string;
  themeSurfaceAlt: string;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: themeBorder },
        pressed && [styles.rowPressed, { backgroundColor: isDark ? "#101A31" : "#EEF2FF" }],
      ]}
      onPress={onPress}
    >
      <View
        style={[
          styles.rowIcon,
          { backgroundColor: themeSurfaceAlt },
          danger && styles.rowIconDanger,
        ]}
      >
        <Ionicons name={icon} size={18} color={danger ? "#DC2626" : themeText} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: danger ? "#DC2626" : themeText }]}>{title}</Text>
        <Text style={[styles.rowSub, { color: danger ? "#F87171" : themeSubText }]} numberOfLines={1}>
          {sub}
        </Text>
      </View>
      {right}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loader: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  loaderText: { fontSize: 14, fontWeight: "600" },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { flex: 1, fontSize: 17, fontWeight: "800" },
  content: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 30, gap: 20 },
  section: { fontSize: 12, fontWeight: "800", letterSpacing: 1.1 },
  accountCard: {
    marginTop: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4F46E5",
  },
  avatarText: { color: "#FFF", fontSize: 20, fontWeight: "800" },
  name: { fontSize: 15, fontWeight: "700" },
  email: { fontSize: 12, marginTop: 2 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
    backgroundColor: "#EEF2FF",
    borderWidth: 1,
    borderColor: "#C7D2FE",
  },
  badgeText: { color: "#4F46E5", fontSize: 10, fontWeight: "700" },
  group: {
    marginTop: 10,
    borderRadius: 18,
    borderWidth: 1.5,
    overflow: "hidden",
  },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
  },
  rowPressed: {},
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rowIconDanger: { backgroundColor: "#FFF1F2" },
  rowTitle: { fontSize: 13.5, fontWeight: "700" },
  rowSub: { fontSize: 11.5, marginTop: 2 },
  list: { marginTop: 10, gap: 10 },
  empty: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    fontWeight: "600",
  },
  notif: { borderRadius: 16, borderWidth: 1.5, padding: 12 },
  notifTitle: { fontSize: 13, fontWeight: "700" },
  notifBody: { marginTop: 4, fontSize: 12, lineHeight: 18 },
  notifFoot: { marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  notifTime: { color: "#94A3B8", fontSize: 11 },
  markRead: { color: "#4F46E5", fontSize: 11.5, fontWeight: "700" },
  expand: { marginTop: 6, color: "#4F46E5", fontSize: 11.5, fontWeight: "700", textAlign: "right" },
  version: { textAlign: "center", fontSize: 11.5 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modal: { width: "100%", maxWidth: 360, borderRadius: 16, padding: 16 },
  modalTitle: { textAlign: "center", fontSize: 20, fontWeight: "800" },
  modalSub: { textAlign: "center", marginTop: 8, fontSize: 13 },
  input: {
    marginTop: 12,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: "600",
  },
  modalActions: { marginTop: 12, flexDirection: "row", gap: 10 },
  cancelBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: { fontSize: 14, fontWeight: "700" },
  deleteBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteText: { color: "#FFF", fontSize: 14, fontWeight: "700" },
});
