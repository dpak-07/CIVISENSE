import React, { useRef, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Animated as RNAnimated,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import Animated, { FadeInDown, FadeInUp, ZoomIn } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { getMyComplaints } from "@/lib/services/complaints";
import { getNotifications } from "@/lib/services/notifications";
import { useAppPreferences } from "@/lib/appPreferencesContext";
import { sessionStore } from "@/lib/session";

const USE_NATIVE_DRIVER = Platform.OS !== "web";

function LogoAnimation({ isDark }: { isDark: boolean }) {
  const rotate = useRef(new RNAnimated.Value(0)).current;

  useEffect(() => {
    RNAnimated.loop(
      RNAnimated.timing(rotate, {
        toValue: 1,
        duration: 8000,
        useNativeDriver: USE_NATIVE_DRIVER,
      })
    ).start();
  }, []);

  const rotation = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <RNAnimated.View
      style={[
        isDark ? styles.rotatingBorderDark : styles.rotatingBorder,
        {
          transform: [{ rotate: rotation }],
        },
      ]}
    />
  );
}

function FloatingCircle({ delay = 0, duration = 4000, style }: any) {
  const translateY = useRef(new RNAnimated.Value(0)).current;
  const translateX = useRef(new RNAnimated.Value(0)).current;
  const scale = useRef(new RNAnimated.Value(1)).current;

  useEffect(() => {
    RNAnimated.loop(
      RNAnimated.parallel([
        RNAnimated.sequence([
          RNAnimated.timing(translateY, {
            toValue: -30,
            duration: duration,
            delay,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          RNAnimated.timing(translateY, {
            toValue: 0,
            duration: duration,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ]),
        RNAnimated.sequence([
          RNAnimated.timing(translateX, {
            toValue: 20,
            duration: duration / 2,
            delay,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          RNAnimated.timing(translateX, {
            toValue: -20,
            duration: duration,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          RNAnimated.timing(translateX, {
            toValue: 0,
            duration: duration / 2,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ]),
        RNAnimated.sequence([
          RNAnimated.timing(scale, {
            toValue: 1.1,
            duration: duration / 2,
            delay,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
          RNAnimated.timing(scale, {
            toValue: 1,
            duration: duration / 2,
            useNativeDriver: USE_NATIVE_DRIVER,
          }),
        ]),
      ])
    ).start();
  }, []);

  return (
    <RNAnimated.View
      style={[
        style,
        {
          transform: [{ translateY }, { translateX }, { scale }],
        },
      ]}
    />
  );
}

function BackgroundDots({ isDark }: { isDark: boolean }) {
  const opacity = useRef(new RNAnimated.Value(0.3)).current;

  useEffect(() => {
    RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(opacity, {
          toValue: 0.6,
          duration: 3000,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        RNAnimated.timing(opacity, {
          toValue: 0.3,
          duration: 3000,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ])
    ).start();
  }, []);

  return (
    <RNAnimated.View style={[styles.dotsContainer, { opacity }]}>
      {[...Array(20)].map((_, i) => (
        <View
          key={i}
          style={[
            isDark ? styles.dotDark : styles.dot,
            {
              left: `${(i % 5) * 20 + 10}%`,
              top: `${Math.floor(i / 5) * 25 + 10}%`,
            },
          ]}
        />
      ))}
    </RNAnimated.View>
  );
}

export default function Home() {
  const [myReportsCount, setMyReportsCount] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [user, setUser] = useState(sessionStore.getUser());
  const { preferences, setDarkMode, t } = useAppPreferences();
  const isDarkMode = preferences.darkMode;

  useEffect(() => {
    if (!sessionStore.getAccessToken()) {
      router.replace("/auth/login");
    }
  }, []);

  useEffect(() => {
    const unsubscribe = sessionStore.subscribe(() => {
      setUser(sessionStore.getUser());
    });
    return unsubscribe;
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      const load = async () => {
        if (!sessionStore.getAccessToken()) {
          return;
        }

        try {
          const [complaints, notifications] = await Promise.all([
            getMyComplaints(),
            getNotifications(),
          ]);
          setMyReportsCount(complaints.length);
          setUnreadNotifications(notifications.filter((item) => !item.read).length);
        } catch {
          // Ignore home stats errors, user can still navigate.
        }
      };

      void load();
    }, [])
  );

  const menuItems = [
    {
      id: 1,
      title: t("home.reportIssue"),
      subtitle: t("home.submitNewComplaint"),
      icon: "camera",
      color: "#2DD4BF",
      route: "/report",
    },
    {
      id: 2,
      title: t("home.trackStatus"),
      subtitle: t("home.reportsCount", { count: myReportsCount }),
      icon: "time",
      color: "#A78BFA",
      route: "/track",
    },
    {
      id: 3,
      title: t("home.cityMap"),
      subtitle: t("home.exploreIssues"),
      icon: "map",
      color: "#FB923C",
      route: "/map",
    },
    {
      id: 4,
      title: t("home.myReports"),
      subtitle: t("home.unreadAlerts", { count: unreadNotifications }),
      icon: "document-text",
      color: "#F472B6",
      route: "/reports",
    },
  ];

  const theme = {
    background: isDarkMode ? ["#1a1a2e", "#16213e"] : ["#ffffff", "#f0fdfa"],
    text: isDarkMode ? "#ffffff" : "#0f766e",
    subText: isDarkMode ? "#cbd5e1" : "#64748b",
    cardBg: isDarkMode ? "#0f3460" : "#fff",
    brandGradient: isDarkMode ? ["#0f3460", "#16213e"] : ["#14b8a6", "#0d9488"],
  };

  return (
    <View style={[styles.container, isDarkMode && styles.containerDark]}>
      {/* Gradient Background */}
      <LinearGradient
        colors={theme.background as any}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Background Dots Animation */}
      <BackgroundDots isDark={isDarkMode} />

      {/* Floating Decorative Circles */}
      <FloatingCircle delay={0} duration={5000} style={[styles.circle, styles.circle1]} />
      <FloatingCircle delay={1000} duration={6000} style={[styles.circle, styles.circle2]} />
      <FloatingCircle delay={2000} duration={4500} style={[styles.circle, styles.circle3]} />

      {/* Header */}
      <Animated.View entering={FadeInDown.duration(600)} style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: theme.subText }]}>{t("home.welcomeBack")}</Text>
          <Text style={[styles.userName, { color: theme.text }]}>
            {user?.name || t("home.citizen")}
          </Text>
        </View>
        <View style={styles.headerRight}>
          {/* Dark Mode Toggle */}
          <Pressable
            style={[styles.themeToggle, isDarkMode && styles.themeToggleDark]}
            onPress={() => void setDarkMode(!isDarkMode)}
          >
            <Ionicons
              name={isDarkMode ? "sunny" : "moon"}
              size={20}
              color={isDarkMode ? "#fbbf24" : "#0f766e"}
            />
          </Pressable>

          <Pressable
            style={[styles.iconButton, isDarkMode && styles.iconButtonDark]}
            onPress={() => router.push("/settings")}
          >
            <Ionicons
              name="settings-outline"
              size={24}
              color={isDarkMode ? "#14b8a6" : "#0f766e"}
            />
          </Pressable>
          <Pressable onPress={() => router.push("/profile")}>
            <Image
              key={user?.profilePhotoUrl || "default-avatar"}
              source={{
                uri: user?.profilePhotoUrl || "https://i.pravatar.cc/150?u=user",
              }}
              style={[styles.profilePic, isDarkMode && styles.profilePicDark]}
            />
          </Pressable>
        </View>
      </Animated.View>

      {/* Logo Section */}
      <Animated.View entering={ZoomIn.duration(800).delay(100)} style={styles.logoSection}>
        <View style={styles.brandCard}>
          <LinearGradient
            colors={theme.brandGradient as any}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.brandGradient}
          >
            <View style={styles.logoContainer}>
              <LogoAnimation isDark={isDarkMode} />
              <View style={styles.logoIconWrapper}>
                <Ionicons name="business" size={32} color="#fff" />
              </View>
            </View>
            <View style={styles.brandTextContainer}>
              <Text style={styles.brandName}>CiviSense</Text>
              <View style={styles.taglineContainer}>
                <View style={styles.taglineDot} />
                <Text style={styles.brandTagline}>{t("app.tagline")}</Text>
              </View>
            </View>
          </LinearGradient>
        </View>
      </Animated.View>

      {/* Menu Cards */}
      <View style={styles.menuContainer}>
        {menuItems.map((item, index) => (
          <Animated.View
            key={item.id}
            entering={FadeInUp.delay(200 + index * 100).duration(700)}
            style={styles.cardWrapper}
          >
            <Pressable
              style={({ pressed }) => [
                styles.menuCard,
                isDarkMode && styles.menuCardDark,
                pressed && styles.cardPressed,
              ]}
              onPress={() => router.push(item.route as never)}
            >
              <View style={[styles.iconBox, { backgroundColor: item.color }]}>
                <Ionicons name={item.icon as any} size={28} color="#fff" />
              </View>
              <View style={styles.cardText}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>
                  {item.title}
                </Text>
                <Text style={[styles.cardSubtitle, { color: theme.subText }]}>
                  {item.subtitle}
                </Text>
              </View>
              <View style={[styles.arrowBox, isDarkMode && styles.arrowBoxDark]}>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={isDarkMode ? "#64748b" : "#94a3b8"}
                />
              </View>
            </Pressable>
          </Animated.View>
        ))}
      </View>

      {/* Footer */}
      <Animated.View entering={FadeInUp.delay(600).duration(700)} style={styles.footer}>
        <Text style={[styles.footerText, { color: theme.subText }]}>
          {t("home.empoweringCitizens")}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  containerDark: {
    backgroundColor: "#1a1a2e",
  },

  /* Background Dots */
  dotsContainer: {
    position: "absolute",
    width: "100%",
    height: "100%",
    zIndex: 0,
  },
  dot: {
    position: "absolute",
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#14b8a6",
    opacity: 0.2,
  },
  dotDark: {
    position: "absolute",
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#14b8a6",
    opacity: 0.3,
  },

  /* Decorative Elements */
  circle: {
    position: "absolute",
    borderRadius: 999,
    opacity: 0.05,
  },
  circle1: {
    width: 300,
    height: 300,
    backgroundColor: "#2DD4BF",
    top: -150,
    right: -100,
  },
  circle2: {
    width: 200,
    height: 200,
    backgroundColor: "#A78BFA",
    bottom: 100,
    left: -80,
  },
  circle3: {
    width: 150,
    height: 150,
    backgroundColor: "#FB923C",
    top: 200,
    left: -50,
  },

  /* Header */
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 24,
    zIndex: 10,
  },
  greeting: {
    fontSize: 14,
    fontWeight: "500",
  },
  userName: {
    fontSize: 26,
    fontWeight: "bold",
    marginTop: 2,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  themeToggle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#14b8a6",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 2,
  },
  themeToggleDark: {
    backgroundColor: "#0f3460",
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#14b8a6",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 2,
  },
  iconButtonDark: {
    backgroundColor: "#0f3460",
  },
  profilePic: {
    width: 48,
    height: 48,
    borderRadius: 14,
    borderWidth: 3,
    borderColor: "#ccfbf1",
    shadowColor: "#14b8a6",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
  },
  profilePicDark: {
    borderColor: "#0f3460",
  },

  /* Logo Section */
  logoSection: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    zIndex: 10,
  },
  brandCard: {
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#14b8a6",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  brandGradient: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
  },
  logoContainer: {
    position: "relative",
    width: 70,
    height: 70,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  rotatingBorder: {
    position: "absolute",
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 3,
    borderColor: "transparent",
    borderTopColor: "#fff",
    borderRightColor: "#fff",
  },
  rotatingBorderDark: {
    position: "absolute",
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 3,
    borderColor: "transparent",
    borderTopColor: "#14b8a6",
    borderRightColor: "#14b8a6",
  },
  logoIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  brandTextContainer: {
    flex: 1,
  },
  brandName: {
    fontSize: 26,
    fontWeight: "bold",
    color: "#fff",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  taglineContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  taglineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#fff",
    marginRight: 8,
    opacity: 0.8,
  },
  brandTagline: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.9)",
    fontWeight: "500",
  },

  /* Menu Cards */
  menuContainer: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
    zIndex: 10,
    gap: 14,
  },
  cardWrapper: {
    width: "100%",
  },
  menuCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 18,
    borderRadius: 18,
    shadowColor: "#14b8a6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  menuCardDark: {
    backgroundColor: "#0f3460",
  },
  cardPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  iconBox: {
    width: 60,
    height: 60,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "bold",
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    fontWeight: "500",
  },
  arrowBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#f0fdfa",
    alignItems: "center",
    justifyContent: "center",
  },
  arrowBoxDark: {
    backgroundColor: "#1a1a2e",
  },

  /* Footer */
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    alignItems: "center",
    zIndex: 10,
  },
  footerText: {
    fontSize: 13,
    textAlign: "center",
    fontWeight: "500",
  },
});

