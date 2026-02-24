import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated as RNAnimated,
  Image,
  Platform,
  Pressable,
  ScrollView,
  useWindowDimensions,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getMyComplaints, ComplaintRecord } from "@/lib/services/complaints";
import { getNotifications } from "@/lib/services/notifications";
import { useAppPreferences } from "@/lib/appPreferencesContext";
import { sessionStore } from "@/lib/session";
import CiviSenseLogo from "@/components/branding/CiviSenseLogo";

const USE_NATIVE_DRIVER = Platform.OS !== "web";

type BadgeKind = "new" | "neutral" | "live";
type MenuItem = {
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  route: string;
  iconBg: string;
  badgeLabel: string;
  badgeKind: BadgeKind;
};

function FloatingBlob({ style, duration, delay }: { style?: StyleProp<ViewStyle>; duration: number; delay: number }) {
  const translateY = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(translateY, {
          toValue: -22,
          duration,
          delay,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        RNAnimated.timing(translateY, {
          toValue: 0,
          duration,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ])
    ).start();
  }, [delay, duration, translateY]);

  return <RNAnimated.View style={[style, { transform: [{ translateY }] }]} />;
}

export default function Home() {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const params = useLocalSearchParams<{ welcome?: string | string[] }>();
  const [complaints, setComplaints] = useState<ComplaintRecord[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [user, setUser] = useState(sessionStore.getUser());
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const { preferences, setDarkMode, t } = useAppPreferences();
  const isDarkMode = preferences.darkMode;

  useEffect(() => {
    const unsubscribe = sessionStore.subscribe(() => {
      setUser(sessionStore.getUser());
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [user?.profilePhotoUrl]);

  useFocusEffect(
    useCallback(() => {
      const token = sessionStore.getAccessToken();
      if (!token) {
        router.replace("/auth");
        return;
      }

      const load = async () => {
        try {
          const [myComplaints, notifications] = await Promise.all([
            getMyComplaints(),
            getNotifications(),
          ]);
          setComplaints(myComplaints);
          setUnreadNotifications(notifications.filter((item) => !item.read).length);
        } catch {
          // Keep home screen usable even if stats fail.
        }
      };

      void load();
    }, [])
  );

  const stats = useMemo(() => {
    const total = complaints.length;
    const resolved = complaints.filter((item) => item.status === "resolved").length;
    const open = complaints.filter(
      (item) => item.status !== "resolved" && item.status !== "rejected"
    ).length;
    const responseRate = total > 0 ? Math.round((resolved / total) * 100) : 0;
    return { total, resolved, open, responseRate };
  }, [complaints]);

  const menuItems = useMemo<MenuItem[]>(
    () => [
      {
        id: "report",
        title: t("home.reportIssue"),
        subtitle: t("home.submitNewComplaint"),
        icon: "camera",
        route: "/report",
        iconBg: "#EEF2FF",
        badgeLabel: "New",
        badgeKind: "new",
      },
      {
        id: "track",
        title: t("home.trackStatus"),
        subtitle: `${stats.open} active report(s)`,
        icon: "time",
        route: "/track",
        iconBg: "#F5F3FF",
        badgeLabel: `${stats.open} open`,
        badgeKind: "neutral",
      },
      {
        id: "map",
        title: t("home.cityMap"),
        subtitle: t("home.exploreIssues"),
        icon: "map",
        route: "/map",
        iconBg: "#FFF7ED",
        badgeLabel: "Live",
        badgeKind: "live",
      },
      {
        id: "reports",
        title: t("home.myReports"),
        subtitle: t("home.unreadAlerts", { count: unreadNotifications }),
        icon: "document-text",
        route: "/reports",
        iconBg: "#FDF2F8",
        badgeLabel: `${unreadNotifications} alerts`,
        badgeKind: "neutral",
      },
    ],
    [stats.open, t, unreadNotifications]
  );

  const theme = useMemo(
    () => ({
      screenGradient: isDarkMode ? (["#0B1020", "#11172A"] as const) : (["#E9EEFF", "#F7F9FF"] as const),
      cardSurface: isDarkMode ? "#131C31" : "#FFFFFF",
      cardBorder: isDarkMode ? "rgba(148,163,184,0.22)" : "#E2E8F0",
      title: isDarkMode ? "#F8FAFC" : "#0F172A",
      subtitle: isDarkMode ? "#A3B3CF" : "#64748B",
      iconButtonBg: isDarkMode ? "#1B2642" : "#F5F7FF",
      heroGradient: isDarkMode ? (["#334155", "#312E81", "#4C1D95"] as const) : (["#4F46E5", "#6D28D9", "#7C3AED"] as const),
      quickGradient: isDarkMode ? (["#1D4ED8", "#4338CA"] as const) : (["#4F46E5", "#7C3AED"] as const),
      badgeNeutralBg: isDarkMode ? "#1E293B" : "#F8FAFC",
      footer: isDarkMode ? "#94A3B8" : "#94A3B8",
    }),
    [isDarkMode]
  );

  const firstName = (user?.name || t("home.citizen")).trim().split(" ")[0] || t("home.citizen");
  const compact = windowHeight < 780;
  const isFreshSignup = useMemo(() => {
    const value = Array.isArray(params.welcome) ? params.welcome[0] : params.welcome;
    return value === "1" || value === "true";
  }, [params.welcome]);

  return (
    <View style={styles.container}>
      <LinearGradient colors={theme.screenGradient as any} style={StyleSheet.absoluteFillObject} />

      <FloatingBlob style={[styles.blob, styles.blobOne]} duration={5200} delay={0} />
      <FloatingBlob style={[styles.blob, styles.blobTwo]} duration={6400} delay={400} />
      <FloatingBlob style={[styles.blob, styles.blobThree]} duration={5600} delay={900} />

      <ScrollView
        scrollEnabled={Platform.OS !== "ios"}
        showsVerticalScrollIndicator={false}
        bounces={false}
        alwaysBounceVertical={false}
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom: Math.max(insets.bottom, 10) + 6,
            minHeight: windowHeight,
          },
        ]}
      >
        <View style={styles.mainArea}>
          <View>
            <Animated.View
              entering={FadeInDown.duration(500)}
              style={[
                styles.header,
                { paddingTop: Math.max(insets.top, 14) + (compact ? 2 : 6) },
              ]}
            >
              <View>
                <Text style={[styles.greetingSub, { color: theme.subtitle }]}>
                  {isFreshSignup ? "Welcome" : t("home.welcomeBack")}
                </Text>
                <Text style={[styles.greetingName, compact && styles.greetingNameCompact, { color: theme.title }]}>
                  {firstName}
                </Text>
              </View>
              <View style={styles.headerActions}>
                <Pressable
                  style={[styles.iconBtn, { backgroundColor: theme.iconButtonBg, borderColor: theme.cardBorder }]}
                  onPress={() => void setDarkMode(!isDarkMode)}
                >
                  <Ionicons name={isDarkMode ? "sunny" : "moon"} size={18} color={theme.title} />
                </Pressable>
                <Pressable
                  style={[styles.iconBtn, { backgroundColor: theme.iconButtonBg, borderColor: theme.cardBorder }]}
                  onPress={() => router.push("/settings")}
                >
                  <Ionicons name="settings-outline" size={18} color={theme.title} />
                </Pressable>
                <Pressable onPress={() => router.push("/profile")}
                >
                  {user?.profilePhotoUrl && !avatarLoadFailed ? (
                    <Image
                      source={{ uri: user.profilePhotoUrl }}
                      style={styles.avatar}
                      onError={() => setAvatarLoadFailed(true)}
                    />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Ionicons name="person" size={16} color="#64748B" />
                    </View>
                  )}
                </Pressable>
              </View>
            </Animated.View>

            <Animated.View entering={FadeInUp.duration(520).delay(70)} style={[styles.heroWrap, compact && styles.heroWrapCompact]}>
              <LinearGradient colors={theme.heroGradient as any} style={[styles.hero, compact && styles.heroCompact]}>
                <View style={styles.heroDecorOne} />
                <View style={styles.heroDecorTwo} />
                <View style={styles.heroRow}>
                  <View style={styles.heroIconWrap}>
                    <CiviSenseLogo size={compact ? 40 : 46} />
                  </View>
                  <View style={styles.heroTextWrap}>
                    <Text style={[styles.heroTitle, compact && styles.heroTitleCompact]}>CiviSense</Text>
                    <View style={styles.heroTaglineRow}>
                      <View style={styles.heroDot} />
                      <Text style={[styles.heroTagline, compact && styles.heroTaglineCompact]}>{t("app.tagline")}</Text>
                    </View>
                  </View>
                </View>
                <View style={[styles.heroStatsRow, compact && styles.heroStatsRowCompact]}>
                  <View style={styles.heroStatItem}>
                    <Text style={[styles.heroStatValue, compact && styles.heroStatValueCompact]}>{stats.resolved}</Text>
                    <Text style={styles.heroStatLabel}>Resolved</Text>
                  </View>
                  <View style={styles.heroStatDivider} />
                  <View style={styles.heroStatItem}>
                    <Text style={[styles.heroStatValue, compact && styles.heroStatValueCompact]}>{stats.open}</Text>
                    <Text style={styles.heroStatLabel}>Active Reports</Text>
                  </View>
                  <View style={styles.heroStatDivider} />
                  <View style={styles.heroStatItem}>
                    <Text style={[styles.heroStatValue, compact && styles.heroStatValueCompact]}>{stats.responseRate}%</Text>
                    <Text style={styles.heroStatLabel}>Response Rate</Text>
                  </View>
                </View>
              </LinearGradient>
            </Animated.View>

            <Animated.View entering={FadeInUp.duration(520).delay(120)} style={[styles.quickWrap, compact && styles.quickWrapCompact]}>
              <Pressable onPress={() => router.push("/report")}
                style={({ pressed }) => [pressed && styles.cardPressed]}>
                <LinearGradient colors={theme.quickGradient as any} style={[styles.quickAction, compact && styles.quickActionCompact]}>
                  <View style={styles.quickIcon}>
                    <Ionicons name="camera" size={18} color="#FFFFFF" />
                  </View>
                  <View style={styles.quickTextWrap}>
                    <Text style={styles.quickTitle}>Spot an issue? Report it now</Text>
                    <Text style={styles.quickSubtitle}>Takes less than 60 seconds</Text>
                  </View>
                  <View style={styles.quickArrow}>
                    <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
                  </View>
                </LinearGradient>
              </Pressable>
            </Animated.View>
          </View>

          <View>
            <Animated.View entering={FadeInUp.duration(500).delay(160)} style={[styles.sectionWrap, compact && styles.sectionWrapCompact]}>
              <Text style={[styles.sectionTitle, { color: theme.subtitle }]}>Quick Access</Text>
              <View style={[styles.sectionLine, { backgroundColor: theme.cardBorder }]} />
            </Animated.View>

            <View style={[styles.menuGrid, compact && styles.menuGridCompact]}>
              {menuItems.map((item, index) => {
                const badgeStyle =
                  item.badgeKind === "new"
                    ? styles.badgeNew
                    : item.badgeKind === "live"
                      ? styles.badgeLive
                      : [styles.badgeNeutral, { backgroundColor: theme.badgeNeutralBg, borderColor: theme.cardBorder }];

                return (
                  <Animated.View key={item.id} entering={FadeInUp.duration(560).delay(180 + index * 90)}>
                    <Pressable
                      onPress={() => router.push(item.route as never)}
                      style={({ pressed }) => [
                        styles.menuCard,
                        compact && styles.menuCardCompact,
                        { backgroundColor: theme.cardSurface, borderColor: theme.cardBorder },
                        pressed && styles.cardPressed,
                      ]}
                    >
                      <View style={[styles.menuIconWrap, compact && styles.menuIconWrapCompact, { backgroundColor: item.iconBg }]}>
                        <Ionicons name={item.icon} size={compact ? 18 : 21} color="#0F172A" />
                      </View>
                      <View style={styles.menuTextWrap}>
                        <Text style={[styles.menuTitle, compact && styles.menuTitleCompact, { color: theme.title }]} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text style={[styles.menuSubtitle, compact && styles.menuSubtitleCompact, { color: theme.subtitle }]} numberOfLines={1}>
                          {item.subtitle}
                        </Text>
                      </View>
                      <View style={styles.menuRight}>
                        <View style={[styles.arrowBtn, { backgroundColor: theme.iconButtonBg, borderColor: theme.cardBorder }]}>
                          <Ionicons name="arrow-forward" size={13} color={theme.subtitle} />
                        </View>
                        <Text style={[styles.badgeBase, badgeStyle as any]}>{item.badgeLabel}</Text>
                      </View>
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>
          </View>
        </View>

        <Animated.View
          entering={FadeInUp.duration(580).delay(560)}
          style={[
            styles.footerWrap,
            {
              paddingBottom: Math.max(insets.bottom, 8) + 2,
              marginTop: compact ? 8 : 14,
            },
          ]}
        >
          <Text style={[styles.footerText, { color: theme.footer }]}>
            {t("home.empoweringCitizens")}
          </Text>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 16,
  },
  mainArea: {
    flexGrow: 1,
    justifyContent: "space-between",
  },
  blob: {
    position: "absolute",
    borderRadius: 999,
    opacity: 0.12,
  },
  blobOne: {
    width: 220,
    height: 220,
    backgroundColor: "#6366F1",
    top: -90,
    right: -70,
  },
  blobTwo: {
    width: 170,
    height: 170,
    backgroundColor: "#A855F7",
    top: 260,
    left: -70,
  },
  blobThree: {
    width: 140,
    height: 140,
    backgroundColor: "#F97316",
    bottom: 120,
    right: -60,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 12,
  },
  greetingSub: {
    fontSize: 12,
    fontWeight: "500",
  },
  greetingName: {
    marginTop: 2,
    fontSize: 24,
    fontWeight: "800",
  },
  greetingNameCompact: {
    fontSize: 21,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },

  heroWrap: {
    marginTop: 4,
  },
  heroWrapCompact: {
    marginTop: 2,
  },
  hero: {
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 20,
    overflow: "hidden",
  },
  heroCompact: {
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  heroDecorOne: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.08)",
    top: -30,
    right: -36,
  },
  heroDecorTwo: {
    position: "absolute",
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(255,255,255,0.06)",
    bottom: -22,
    right: 34,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  heroIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTextWrap: {
    flex: 1,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
  },
  heroTitleCompact: {
    fontSize: 19,
  },
  heroTaglineRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  heroDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#86EFAC",
  },
  heroTagline: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 12.5,
    fontWeight: "600",
  },
  heroTaglineCompact: {
    fontSize: 11.5,
  },
  heroStatsRow: {
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.18)",
    flexDirection: "row",
    alignItems: "stretch",
  },
  heroStatsRowCompact: {
    marginTop: 12,
    paddingTop: 10,
  },
  heroStatItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heroStatValue: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },
  heroStatValueCompact: {
    fontSize: 16,
  },
  heroStatLabel: {
    marginTop: 2,
    color: "rgba(255,255,255,0.66)",
    fontSize: 10.5,
    fontWeight: "600",
    textAlign: "center",
  },
  heroStatDivider: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.18)",
    marginVertical: 2,
  },

  quickWrap: {
    marginTop: 10,
  },
  quickWrapCompact: {
    marginTop: 8,
  },
  quickAction: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  quickActionCompact: {
    paddingVertical: 11,
  },
  quickIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    alignItems: "center",
    justifyContent: "center",
  },
  quickTextWrap: {
    flex: 1,
  },
  quickTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  quickSubtitle: {
    marginTop: 2,
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    fontWeight: "500",
  },
  quickArrow: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },

  sectionWrap: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionWrapCompact: {
    marginTop: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  sectionLine: {
    flex: 1,
    height: 1,
  },

  menuGrid: {
    marginTop: 9,
    gap: 8,
  },
  menuGridCompact: {
    marginTop: 7,
    gap: 7,
  },
  menuCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  menuCardCompact: {
    paddingVertical: 10,
    borderRadius: 18,
  },
  menuIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  menuIconWrapCompact: {
    width: 44,
    height: 44,
    borderRadius: 14,
  },
  menuTextWrap: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  menuTitleCompact: {
    fontSize: 14,
  },
  menuSubtitle: {
    marginTop: 2,
    fontSize: 12.5,
    fontWeight: "500",
  },
  menuSubtitleCompact: {
    fontSize: 11.5,
  },
  menuRight: {
    alignItems: "flex-end",
    gap: 6,
  },
  arrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeBase: {
    fontSize: 10,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
    overflow: "hidden",
  },
  badgeNew: {
    backgroundColor: "#FEE2E2",
    color: "#DC2626",
  },
  badgeNeutral: {
    color: "#64748B",
    borderWidth: 1,
  },
  badgeLive: {
    backgroundColor: "#DCFCE7",
    color: "#16A34A",
  },

  footerWrap: {
    borderTopWidth: 1,
    borderTopColor: "rgba(148,163,184,0.2)",
    paddingTop: 7,
    alignItems: "center",
  },
  footerText: {
    fontSize: 11,
    fontWeight: "500",
    opacity: 0.72,
    textAlign: "center",
  },

  cardPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.96,
  },
});
