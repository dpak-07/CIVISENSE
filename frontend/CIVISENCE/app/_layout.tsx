import React, { useEffect, useRef, useState } from "react";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { getPreferences } from "@/lib/preferences";
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

export default function RootLayout() {
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionVersion, setSessionVersion] = useState(0);
  const knownNotificationIdsRef = useRef<Set<string>>(new Set());
  const notificationBaselineReadyRef = useRef(false);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      await sessionStore.hydrate();
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
        const preferences = await getPreferences();
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
  }, [sessionReady, sessionVersion]);

  if (!sessionReady) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Loader txt="Syncing civic intelligence..." />
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "slide_from_right",
          contentStyle: { backgroundColor: "#ffffff" },
        }}
      >
        <Stack.Screen name="index" options={{ title: "Home" }} />
        <Stack.Screen 
          name="auth/login" 
          options={{ 
            title: "Login",
            animation: "slide_from_bottom" // Custom animation for login
          }} 
        />
        <Stack.Screen 
          name="auth/register" 
          options={{ 
            title: "Register",
            animation: "fade" // Fade animation for register
          }} 
        />
        <Stack.Screen name="report/index" options={{ title: "Report Issue" }} />
        <Stack.Screen 
          name="report/camera" 
          options={{ 
            title: "Camera",
            animation: "slide_from_bottom", // Modal-like for camera
            presentation: "modal" // Makes it feel more modal-like on iOS
          }} 
        />
        <Stack.Screen name="reports/index" options={{ title: "My Reports" }} />
        <Stack.Screen name="track/index" options={{ title: "Active Complaints" }} />
        <Stack.Screen name="map/index" options={{ title: "City Map" }} />
        <Stack.Screen name="dashboard/index" options={{ title: "Dashboard" }} />
        <Stack.Screen name="profile/index" options={{ title: "Profile" }} />
        <Stack.Screen name="settings/index" options={{ title: "Settings" }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
