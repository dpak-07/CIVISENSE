import React, { useEffect, useRef, useState } from "react";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppPreferencesProvider, useAppPreferences } from "@/lib/appPreferencesContext";
import { sendLocalPush } from "@/lib/push";
import { sessionStore } from "@/lib/session";
import { getNotifications } from "@/lib/services/notifications";
import Loader from "@/components/ui/Loader";
import {
  flushQueuedComplaints,
  initComplaintQueueSync,
  stopComplaintQueueSync,
} from "@/lib/services/complaintQueue";

const NOTIFICATION_POLL_INTERVAL_MS = 30000;
const MIN_LOADER_DURATION_MS = 2200;

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppPreferencesProvider>
        <RootLayoutContent />
      </AppPreferencesProvider>
    </SafeAreaProvider>
  );
}

function RootLayoutContent() {
  const { preferences, theme, t } = useAppPreferences();
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionVersion, setSessionVersion] = useState(0);
  const knownNotificationIdsRef = useRef<Set<string>>(new Set());
  const notificationBaselineReadyRef = useRef(false);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      const startedAt = Date.now();
      await sessionStore.hydrate();
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, MIN_LOADER_DURATION_MS - elapsed);

      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }

      if (active) {
        setSessionReady(true);
      }
    };

    void bootstrap();

    const unsubscribe = sessionStore.subscribe(() => {
      setSessionVersion((prev) => prev + 1);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!sessionReady) {
      return;
    }

    initComplaintQueueSync();
    const unsubscribe = sessionStore.subscribe(() => {
      if (sessionStore.getAccessToken()) {
        void flushQueuedComplaints();
      }
    });

    return () => {
      unsubscribe();
      stopComplaintQueueSync();
    };
  }, [sessionReady]);

  useEffect(() => {
    if (!sessionReady) {
      return;
    }

    knownNotificationIdsRef.current = new Set();
    notificationBaselineReadyRef.current = false;

    const accessToken = sessionStore.getAccessToken();
    if (!accessToken) {
      return;
    }

    let active = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const pollNotifications = async () => {
      try {
        const notifications = await getNotifications();
        if (!active) {
          return;
        }

        if (!notificationBaselineReadyRef.current) {
          notifications.forEach((item) => {
            knownNotificationIdsRef.current.add(item._id);
          });
          notificationBaselineReadyRef.current = true;
          return;
        }

        const unread = notifications.filter((item) => !item.read);
        if (!preferences.notificationsEnabled) {
          unread.forEach((item) => {
            knownNotificationIdsRef.current.add(item._id);
          });
          return;
        }

        for (const item of unread) {
          if (knownNotificationIdsRef.current.has(item._id)) {
            continue;
          }

          knownNotificationIdsRef.current.add(item._id);
          await sendLocalPush(item.title, item.message);
        }
      } catch {
        // Ignore polling errors; next cycle will retry.
      }
    };

    void pollNotifications();
    timer = setInterval(() => {
      void pollNotifications();
    }, NOTIFICATION_POLL_INTERVAL_MS);

    return () => {
      active = false;
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [preferences.notificationsEnabled, sessionReady, sessionVersion]);

  if (!sessionReady) {
    return (
      <GestureHandlerRootView style={[styles.root, { backgroundColor: theme.colors.appBackground }]}>
        <StatusBar style={theme.statusBar} />
        <Loader txt={t("common.loading")} />
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={[styles.root, { backgroundColor: theme.colors.appBackground }]}>
      <StatusBar style={theme.statusBar} />
      <View style={styles.stackWrapper}>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: "slide_from_right",
            contentStyle: { backgroundColor: theme.colors.appBackground },
          }}
        >
          <Stack.Screen name="index" options={{ title: "Home" }} />
          <Stack.Screen
            name="auth/index"
            options={{
              title: "Auth",
              animation: "fade",
            }}
          />
          <Stack.Screen
            name="auth/login"
            options={{
              title: "Login",
              animation: "slide_from_bottom",
            }}
          />
          <Stack.Screen
            name="auth/register"
            options={{
              title: "Register",
              animation: "fade",
            }}
          />
          <Stack.Screen name="report/index" options={{ title: t("home.reportIssue") }} />
          <Stack.Screen
            name="report/camera"
            options={{
              title: "Camera",
              animation: "slide_from_bottom",
              presentation: "modal",
            }}
          />
          <Stack.Screen name="reports/index" options={{ title: t("home.myReports") }} />
          <Stack.Screen name="track/index" options={{ title: t("home.trackStatus") }} />
          <Stack.Screen name="map/index" options={{ title: t("home.cityMap") }} />
          <Stack.Screen name="dashboard/index" options={{ title: "Dashboard" }} />
          <Stack.Screen name="profile/index" options={{ title: "Profile" }} />
          <Stack.Screen name="settings/index" options={{ title: t("settings.title") }} />
        </Stack>
        {theme.mode === "dark" ? (
          <View pointerEvents="none" style={[styles.darkOverlay, { backgroundColor: theme.colors.overlay }]} />
        ) : null}
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  stackWrapper: {
    flex: 1,
  },
  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
});
