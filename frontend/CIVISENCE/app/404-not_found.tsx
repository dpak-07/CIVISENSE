import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "slide_from_right", // Replace animationEnabled with animation
          contentStyle: { backgroundColor: "#ffffff" }, // Replace cardStyle with contentStyle
        }}
      >
        <Stack.Screen name="index" options={{ title: "Home" }} />
        <Stack.Screen name="auth/login" options={{ title: "Login" }} />
        <Stack.Screen name="auth/register" options={{ title: "Register" }} />
        <Stack.Screen name="report/index" options={{ title: "Report Issue" }} />
        <Stack.Screen name="report/camera" options={{ title: "Camera" }} />
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
