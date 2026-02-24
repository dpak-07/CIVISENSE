import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { safeBack } from "@/lib/navigation";

const USE_NATIVE_DRIVER = Platform.OS !== "web";

const CATEGORIES = [
  { key: "Pothole", icon: "construct" as const },
  { key: "Streetlight", icon: "bulb" as const },
  { key: "Garbage", icon: "trash" as const },
  { key: "Water Leak", icon: "water" as const },
];

export default function CameraScreen() {
  const cameraRef = useRef<CameraView | null>(null);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const [permission, requestPermission] = useCameraPermissions();
  const [isCapturing, setIsCapturing] = useState(false);
  const [facing, setFacing] = useState<"back" | "front">("back");
  const [flash, setFlash] = useState<"off" | "on">("off");
  const [category, setCategory] = useState(CATEGORIES[0].key);

  const scanAnim = useRef(new Animated.Value(0)).current;
  const ringAnim = useRef(new Animated.Value(0)).current;
  const { frameWidth, frameHeight } = useMemo(() => {
    const ratio = 1.25;
    let nextWidth = Math.min(screenWidth * 0.82, 360);
    let nextHeight = nextWidth * ratio;
    const maxHeight = screenHeight * 0.46;

    if (nextHeight > maxHeight) {
      nextHeight = maxHeight;
      nextWidth = nextHeight / ratio;
    }

    return { frameWidth: nextWidth, frameHeight: nextHeight };
  }, [screenHeight, screenWidth]);

  useEffect(() => {
    scanAnim.setValue(0);
    ringAnim.setValue(0);

    const scanLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(scanAnim, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ])
    );

    const ringLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(ringAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.out(Easing.quad),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(ringAnim, {
          toValue: 0,
          duration: 600,
          easing: Easing.in(Easing.quad),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ])
    );

    scanLoop.start();
    ringLoop.start();

    return () => {
      scanLoop.stop();
      ringLoop.stop();
    };
  }, [ringAnim, scanAnim]);

  const scanTranslateY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [4, Math.max(10, frameHeight - 8)],
  });

  const scanOpacity = scanAnim.interpolate({
    inputRange: [0, 0.1, 0.9, 1],
    outputRange: [0, 1, 1, 0],
  });

  const ringScale = ringAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.2],
  });

  const ringOpacity = ringAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.7, 0],
  });

  const handleTakePicture = async () => {
    if (!cameraRef.current || isCapturing) {
      return;
    }
    setIsCapturing(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        skipProcessing: false,
      });
      if (photo?.uri) {
        router.replace({
          pathname: "/report",
          params: {
            photo: photo.uri,
            captureTs: String(Date.now()),
            category,
          },
        });
      }
    } catch {
      // Ignore capture failures and keep camera active.
    } finally {
      setIsCapturing(false);
    }
  };

  if (!permission) {
    return (
      <View style={styles.loadingWrap}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color="#818CF8" />
        <Text style={styles.loadingText}>Loading camera...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permissionRoot} edges={["top", "left", "right", "bottom"]}>
        <StatusBar style="dark" />
        <LinearGradient colors={["#F5F7FF", "#EEF2FF"]} style={StyleSheet.absoluteFillObject} />
        <View style={styles.permissionCard}>
          <View style={styles.permissionIconWrap}>
            <Ionicons name="camera" size={34} color="#FFFFFF" />
          </View>
          <Text style={styles.permissionTitle}>Camera Access Required</Text>
          <Text style={styles.permissionSub}>
            We need your camera to capture issue photos and help resolve city problems faster.
          </Text>
          <Pressable style={styles.permissionPrimary} onPress={requestPermission}>
            <Text style={styles.permissionPrimaryText}>Grant Camera Access</Text>
          </Pressable>
          <Pressable style={styles.permissionSecondary} onPress={() => safeBack("/report")}>
            <Text style={styles.permissionSecondaryText}>Not Now</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["top", "left", "right", "bottom"]}>
      <StatusBar style="light" />
      <CameraView style={StyleSheet.absoluteFillObject} ref={cameraRef} facing={facing} flash={flash} />

      <LinearGradient
        colors={["rgba(0,0,0,0.78)", "transparent"]}
        style={styles.topBar}
      >
        <Pressable style={styles.glassButton} onPress={() => safeBack("/report")}>
          <Ionicons name="close" size={20} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.topTitle}>Capture Issue</Text>
        <Pressable
          style={styles.glassButton}
          onPress={() => setFlash((prev) => (prev === "off" ? "on" : "off"))}
        >
          <Ionicons name={flash === "off" ? "flash-off" : "flash"} size={18} color="#FFFFFF" />
        </Pressable>
      </LinearGradient>

      <View style={[styles.hintPill, { top: 76, maxWidth: screenWidth - 30 }]}>
        <Ionicons name="information-circle" size={14} color="#FFFFFF" />
        <Text style={styles.hintText} numberOfLines={1}>
          Keep the issue centered and well-lit
        </Text>
      </View>

      <View style={styles.frameCenter}>
        <View style={[styles.frame, { width: frameWidth, height: frameHeight }]}>
          <View style={[styles.gridH, { top: "33.3%" }]} />
          <View style={[styles.gridH, { top: "66.6%" }]} />
          <View style={[styles.gridV, { left: "33.3%" }]} />
          <View style={[styles.gridV, { left: "66.6%" }]} />

          <Animated.View
            style={[
              styles.scanLine,
              {
                transform: [{ translateY: scanTranslateY }],
                opacity: scanOpacity,
              },
            ]}
          />

          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>
      </View>

      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.62)", "rgba(0,0,0,0.92)"]}
        style={styles.bottomBar}
      >
        <ScrollView
          horizontal
          contentContainerStyle={styles.chips}
          showsHorizontalScrollIndicator={false}
        >
          {CATEGORIES.map((item) => {
            const active = item.key === category;
            return (
              <Pressable
                key={item.key}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setCategory(item.key)}
              >
                <Ionicons
                  name={item.icon}
                  size={12}
                  color={active ? "#FFFFFF" : "rgba(255,255,255,0.72)"}
                />
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.key}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.controlsRow}>
          <View style={styles.sideButtonSpacer} />

          <View style={styles.captureWrap}>
            <Pressable style={styles.captureOuter} onPress={() => void handleTakePicture()} disabled={isCapturing}>
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.captureRing,
                  {
                    transform: [{ scale: ringScale }],
                    opacity: ringOpacity,
                  },
                ]}
              />
              {isCapturing ? (
                <ActivityIndicator color="#111827" size="small" />
              ) : (
                <View style={styles.captureInner} />
              )}
            </Pressable>
            <Text style={styles.captureLabel}>CAPTURE</Text>
          </View>

          <Pressable
            style={styles.sideButton}
            onPress={() => setFacing((prev) => (prev === "back" ? "front" : "back"))}
          >
            <Ionicons name="camera-reverse" size={19} color="#FFFFFF" />
          </Pressable>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000000" },
  loadingWrap: {
    flex: 1,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: {
    color: "#E2E8F0",
    fontSize: 14,
    fontWeight: "600",
  },

  permissionRoot: {
    flex: 1,
    backgroundColor: "#F5F7FF",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  permissionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    padding: 20,
    alignItems: "center",
  },
  permissionIconWrap: {
    width: 82,
    height: 82,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#4F46E5",
    marginBottom: 10,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
  },
  permissionSub: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    color: "#64748B",
  },
  permissionPrimary: {
    marginTop: 16,
    width: "100%",
    borderRadius: 14,
    backgroundColor: "#4F46E5",
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  permissionPrimaryText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  permissionSecondary: {
    marginTop: 10,
    width: "100%",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  permissionSecondaryText: {
    color: "#64748B",
    fontSize: 13,
    fontWeight: "600",
  },

  topBar: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  glassButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.13)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.24)",
  },
  topTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  hintPill: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 99,
    backgroundColor: "rgba(79,70,229,0.88)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.2)",
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  hintText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
  },

  frameCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  frame: {
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  gridH: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  gridV: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  scanLine: {
    position: "absolute",
    left: 2,
    right: 2,
    height: 2,
    borderRadius: 99,
    backgroundColor: "rgba(79,70,229,0.8)",
  },
  corner: {
    position: "absolute",
    width: 24,
    height: 24,
    borderColor: "#4F46E5",
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 10,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 10,
  },
  cornerBL: {
    left: 0,
    bottom: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 10,
  },
  cornerBR: {
    right: 0,
    bottom: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 10,
  },

  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 14,
    paddingHorizontal: 20,
  },
  chips: {
    gap: 8,
    paddingBottom: 10,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 99,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipActive: {
    backgroundColor: "rgba(79,70,229,0.9)",
    borderColor: "rgba(79,70,229,0.95)",
  },
  chipText: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 10.5,
    fontWeight: "600",
  },
  chipTextActive: {
    color: "#FFFFFF",
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
  },
  sideButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  sideButtonSpacer: {
    width: 46,
    height: 46,
  },
  captureWrap: {
    alignItems: "center",
    gap: 8,
  },
  captureOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  captureRing: {
    position: "absolute",
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2,
    borderColor: "rgba(79,70,229,0.6)",
  },
  captureInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#FFFFFF",
  },
  captureLabel: {
    color: "rgba(255,255,255,0.66)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
  },

  previewRoot: {
    flex: 1,
    backgroundColor: "#000000",
  },
  previewImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  previewTopOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  previewTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  readyBadge: {
    minHeight: 24,
    paddingHorizontal: 10,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: "rgba(79,70,229,0.88)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  readyBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  previewBottomOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingTop: 20,
    gap: 10,
  },
  metaCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  metaTitle: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 11,
    fontWeight: "600",
  },
  metaSub: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 10,
    marginTop: 1,
  },
  previewActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 2,
  },
  retakeButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "rgba(255,255,255,0.12)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  retakeText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  useButtonWrap: {
    flex: 1.6,
    borderRadius: 14,
    overflow: "hidden",
  },
  useButton: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  useText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});
