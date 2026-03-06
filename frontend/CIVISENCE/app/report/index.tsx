import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  FadeInUp,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { getApiErrorMessage } from "@/lib/api";
import { safeBack } from "@/lib/navigation";
import { sessionStore } from "@/lib/session";
import { submitComplaintOrQueue } from "@/lib/services/complaintQueue";

type Coordinates = { latitude: number; longitude: number };
type DraftData = {
  category?: string;
  description?: string;
  location?: string;
  coordinates?: Coordinates | null;
  image?: string | null;
};

const DRAFT_STORAGE_KEY = "civisense.report.draft.v1";
const CATEGORIES = [
  { name: "Pothole", icon: "construct", bg: "#FEE2E2" },
  { name: "Road Damage", icon: "warning", bg: "#FDE68A" },
  { name: "Streetlight", icon: "bulb", bg: "#FEF9C3" },
  { name: "Garbage", icon: "trash", bg: "#DCFCE7" },
  { name: "Drainage", icon: "water", bg: "#CFFAFE" },
  { name: "Water Leak", icon: "water", bg: "#DBEAFE" },
  { name: "Traffic Sign", icon: "car-sport", bg: "#EDE9FE" },
  { name: "Other", icon: "help-circle", bg: "#F1F5F9" },
];

const formatCoordinates = (latitude: number, longitude: number) => {
  const latDir = latitude >= 0 ? "N" : "S";
  const lonDir = longitude >= 0 ? "E" : "W";
  return `${Math.abs(latitude).toFixed(4)} deg ${latDir}, ${Math.abs(longitude).toFixed(4)} deg ${lonDir}`;
};

const buildTitle = (category: string, location: string) =>
  location.trim() ? `${category} issue near ${location.trim().slice(0, 70)}` : `${category} issue reported`;

const buildDefaultDescription = (category: string, location: string, coordinates: Coordinates | null) => {
  const safeCategory = category.trim() || "Issue";
  const safeLocation = location.trim();

  if (safeLocation) {
    return `${safeCategory} issue reported near ${safeLocation}.`;
  }

  if (coordinates) {
    return `${safeCategory} issue reported near coordinates ${coordinates.latitude.toFixed(6)}, ${coordinates.longitude.toFixed(6)}.`;
  }

  return `${safeCategory} issue reported near the provided location.`;
};

export default function ReportIssueScreen() {
  const log = (...args: unknown[]) => console.log("[Report]", ...args);
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const params = useLocalSearchParams<{
    photo?: string | string[];
    captureTs?: string | string[];
    category?: string | string[];
  }>();
  const photoParam = useMemo(
    () => {
      const raw = Array.isArray(params.photo) ? params.photo[0] : params.photo;
      if (!raw) {
        return undefined;
      }
      try {
        return decodeURIComponent(raw);
      } catch {
        return raw;
      }
    },
    [params.photo]
  );
  const categoryParam = useMemo(
    () => (Array.isArray(params.category) ? params.category[0] : params.category),
    [params.category]
  );

  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [locationText, setLocationText] = useState("");
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeModal, setActiveModal] = useState<"none" | "confirm" | "success">("none");
  const [queued, setQueued] = useState(false);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const capturePulse = useSharedValue(0);
  const captureSweep = useSharedValue(0);
  const isCompact = windowWidth < 380;
  const categoryCardWidth = isCompact ? "48.3%" : "31.3%";

  useEffect(() => {
    const loadDraft = async () => {
      try {
        const raw = await AsyncStorage.getItem(DRAFT_STORAGE_KEY);
        if (!raw) {
          return;
        }
        const draft = JSON.parse(raw) as DraftData;
        if (draft.category) setCategory(draft.category);
        if (draft.description) setDescription(draft.description);
        if (draft.location) setLocationText(draft.location);
        if (draft.coordinates) setCoordinates(draft.coordinates);
        if (draft.image) setImage(draft.image);
      } catch {
        // ignore
      }
    };
    void loadDraft();
  }, []);

  useEffect(() => {
    if (photoParam && photoParam.length > 0) {
      log("Photo param received", { uri: photoParam });
      setImage(photoParam);
      setImageLoadFailed(false);
    }
  }, [photoParam, params.captureTs]);

  useEffect(() => {
    if (!categoryParam) {
      return;
    }
    const matched = CATEGORIES.find((item) => item.name === categoryParam);
    if (matched) {
      setCategory(matched.name);
      log("Category param received", { category: matched.name });
    }
  }, [categoryParam]);

  useEffect(() => {
    capturePulse.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
    captureSweep.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.linear }),
      -1,
      false
    );
  }, [capturePulse, captureSweep]);

  const capturePulseStyle = useAnimatedStyle(() => ({
    opacity: interpolate(capturePulse.value, [0, 1], [0.16, 0.34]),
    transform: [{ scale: interpolate(capturePulse.value, [0, 1], [0.94, 1.08]) }],
  }));

  const captureSweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(captureSweep.value, [0, 1], [-240, 240]) }],
    opacity: interpolate(captureSweep.value, [0, 0.15, 0.85, 1], [0, 0.36, 0.36, 0]),
  }));

  const getCurrentLocation = useCallback(async () => {
    console.log("[Report]", "Requesting location permission");
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      console.log("[Report]", "Location permission status", status);
      if (status !== "granted") {
        Alert.alert("Permission denied", "Location permission is required.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = pos.coords;
      console.log("[Report]", "Got GPS coordinates", { latitude, longitude });
      setCoordinates({ latitude, longitude });

      let resolved = "";
      try {
        const rev = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (rev[0]) {
          const a = rev[0];
          resolved = [a.name, a.street, a.district, a.city, a.region, a.country]
            .filter((v): v is string => Boolean(v && v.trim()))
            .join(", ");
        }
      } catch {
        // ignore
      }
      console.log("[Report]", "Reverse geocode result", resolved || null);
      setLocationText(resolved || formatCoordinates(latitude, longitude));
    } catch (e) {
      console.error("Location error:", e);
      Alert.alert("Error", "Could not get your location.");
    } finally {
      setLocationLoading(false);
    }
  }, []);

  useEffect(() => {
    if (image && !locationText) {
      log("Image set, fetching location");
      void getCurrentLocation();
    }
  }, [image, locationText, getCurrentLocation]);

  const saveDraft = async () => {
    try {
      await AsyncStorage.setItem(
        DRAFT_STORAGE_KEY,
        JSON.stringify({ category, description, location: locationText, coordinates, image })
      );
    } catch {
      // ignore
    }
  };

  const clearDraft = async () => {
    try {
      await AsyncStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  const ensureAuthenticated = () => {
    if (sessionStore.getAccessToken()) {
      log("Auth OK");
      return true;
    }
    log("Auth missing");
    void saveDraft();
    Alert.alert("Login required", "Please sign in before submitting.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign In", onPress: () => router.push({ pathname: "/auth", params: { returnTo: "/report" } }) },
    ]);
    return false;
  };

  const validateBeforeReview = () => {
    log("Submit pressed");
    if (!ensureAuthenticated()) return false;
    if (!image) return Alert.alert("Required", "Please take a photo of the issue"), false;
    if (!category) return Alert.alert("Required", "Please select a category"), false;
    if (!locationText) return Alert.alert("Required", "Please get your location"), false;
    if (!coordinates) return Alert.alert("Required", "Location coordinates are missing."), false;
    if (description.trim().length > 0 && description.trim().length < 10) {
      return Alert.alert("Invalid", "Description should be at least 10 characters or left empty"), false;
    }
    log("Validation OK, opening confirmation");
    return true;
  };

  const submit = async () => {
    if (submitting) {
      return;
    }
    log("Confirm submit pressed");
    if (!ensureAuthenticated()) return;
    if (!coordinates) {
      Alert.alert("Missing location", "Please capture your location first.");
      return;
    }
    setSubmitting(true);
    setActiveModal("none");
    try {
      const payload = {
        title: buildTitle(category, locationText),
        description: description.trim() || buildDefaultDescription(category, locationText, coordinates),
        category,
        longitude: coordinates.longitude,
        latitude: coordinates.latitude,
        imageUri: image,
      };
      log("Submitting complaint", payload);
      const result = await submitComplaintOrQueue(payload);
      log("Submit result", result);
      setQueued(result.queued);
      setActiveModal("success");
      await clearDraft();
    } catch (error) {
      log("Submit failed", getApiErrorMessage(error));
      Alert.alert("Submission failed", getApiErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setCategory("");
    setDescription("");
    setLocationText("");
    setCoordinates(null);
    setImage(null);
    setImageLoadFailed(false);
    setQueued(false);
  };

  const canSubmit =
    Boolean(image) &&
    Boolean(category) &&
    Boolean(locationText) &&
    Boolean(coordinates) &&
    (description.trim().length === 0 || description.trim().length >= 10);

  const openConfirmModal = () => {
    if (activeModal !== "none" || submitting) {
      return;
    }
    if (validateBeforeReview()) {
      setActiveModal("confirm");
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <StatusBar style="dark" translucent backgroundColor="transparent" />
      <LinearGradient
        pointerEvents="none"
        colors={["#EEF2FF", "#F5F7FF", "#FFFFFF"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <View style={styles.screen}>
          <Animated.View
            entering={FadeInDown.duration(520)}
            style={[
              styles.header,
              {
                paddingTop: Math.max(insets.top, 12) + 6,
                backgroundColor: Platform.OS === "ios" ? "rgba(255,255,255,0.82)" : "#FFFFFF",
              },
            ]}
          >
            <Pressable style={styles.backBtn} onPress={() => safeBack("/")}>
              <Text style={styles.backText}>{"\u2190"}</Text>
            </Pressable>
            <Text style={styles.headerTitle}>Report Issue</Text>
            <View style={styles.steps}><View style={[styles.step, styles.stepDone]} /><View style={[styles.step, styles.stepActive]} /><View style={[styles.step, styles.stepOff]} /></View>
          </Animated.View>

          <ScrollView
            contentContainerStyle={[
              styles.content,
              {
                paddingBottom: Math.max(insets.bottom, 12) + 20,
              },
            ]}
            showsVerticalScrollIndicator={false}
            contentInsetAdjustmentBehavior="never"
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View entering={FadeInDown.duration(520).delay(90)}>
              <Text style={styles.section}>Take a Photo</Text>
              {!image ? (
                <>
                  <Pressable
                    style={({ pressed }) => [styles.captureCard, pressed && styles.captureCardPressed]}
                    onPress={() => router.push("/report/camera")}
                  >
                    <LinearGradient colors={["#4F46E5", "#6366F1"]} style={styles.captureRow}>
                      <Animated.View pointerEvents="none" style={[styles.capturePulseHalo, capturePulseStyle]} />
                      <View style={styles.captureIcon}><Ionicons name="camera" size={24} color="#FFF" /></View>
                      <View style={styles.captureTextWrap}>
                        <Text style={styles.captureTitle}>Tap to Capture Photo</Text>
                        <Text style={styles.captureSub}>Capture clear issue photo</Text>
                      </View>
                      <View style={styles.captureArrow}><Text style={{ color: "#FFF", fontWeight: "700" }}>{"\u2192"}</Text></View>
                      <Animated.View pointerEvents="none" style={[styles.captureSweep, captureSweepStyle]} />
                    </LinearGradient>
                  </Pressable>
                  <Text style={styles.captureHelpText}>
                    Capture a clear photo to continue
                  </Text>
                </>
              ) : (
                <Animated.View entering={FadeInUp.duration(360)} style={styles.photoCapturedCard}>
                  {!imageLoadFailed ? (
                    <Image
                      source={{ uri: image }}
                      style={styles.photoPreview}
                      resizeMode="cover"
                      onError={() => setImageLoadFailed(true)}
                    />
                  ) : null}
                  <View style={styles.photoCapturedRow}>
                    <Ionicons
                      name={imageLoadFailed ? "warning-outline" : "checkmark-circle"}
                      size={20}
                      color={imageLoadFailed ? "#F59E0B" : "#10B981"}
                    />
                    <Text style={styles.photoCapturedText}>
                      {imageLoadFailed
                        ? "Preview unavailable, but photo is attached"
                        : "Photo captured successfully"}
                    </Text>
                  </View>
                  <Pressable style={styles.retakeBtn} onPress={() => router.push("/report/camera")}>
                    <Ionicons name="camera-reverse" size={16} color="#4F46E5" />
                    <Text style={styles.retakeText}>Retake Photo</Text>
                  </Pressable>
                </Animated.View>
              )}
            </Animated.View>

            <Animated.View entering={FadeInDown.duration(520).delay(150)}>
              <Text style={styles.section}>Select Category</Text>
              <View style={styles.grid}>
                {CATEGORIES.map((c) => (
                  <Pressable
                    key={c.name}
                    style={[
                      styles.cat,
                      { width: categoryCardWidth },
                      category === c.name && styles.catActive,
                    ]}
                    onPress={() => setCategory(c.name)}
                  >
                    <View style={[styles.catIcon, { backgroundColor: c.bg }]}><Ionicons name={c.icon as never} size={16} color="#0F172A" /></View>
                    <Text style={styles.catText}>{c.name}</Text>
                  </Pressable>
                ))}
              </View>
            </Animated.View>

            <Animated.View entering={FadeInDown.duration(520).delay(210)}>
              <Text style={styles.section}>Location</Text>
              <Pressable style={[styles.locBtn, locationText && styles.locBtnActive]} onPress={() => void getCurrentLocation()} disabled={locationLoading}>
                <View style={styles.locIcon}><Ionicons name="location" size={20} color="#4F46E5" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.locStrong} numberOfLines={1}>{locationLoading ? "Detecting..." : locationText || "Get Current Location"}</Text>
                  <Text style={styles.locSub} numberOfLines={2}>{locationLoading ? "Please wait" : coordinates ? formatCoordinates(coordinates.latitude, coordinates.longitude) : "Tap to auto-detect your location"}</Text>
                </View>
                <View style={styles.locBadge}>{locationLoading ? <ActivityIndicator size="small" color="#4F46E5" /> : <Text style={styles.locBadgeText}>{locationText ? "Found" : "GPS"}</Text>}</View>
              </Pressable>
            </Animated.View>

            <Animated.View entering={FadeInDown.duration(520).delay(270)}>
              <View style={styles.descHead}><Text style={[styles.section, styles.sectionInline]}>Description</Text><Text style={styles.optional}>(Optional)</Text></View>
              <View style={styles.textWrap}>
                <TextInput
                  style={styles.textInput}
                  placeholder="Describe the issue - helps us resolve it faster..."
                  placeholderTextColor="#CBD5E1"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  textAlignVertical="top"
                  maxLength={200}
                />
                <Text style={styles.count}>{description.length}/200</Text>
              </View>
            </Animated.View>
          </ScrollView>

          <Animated.View
            entering={FadeInUp.duration(520).delay(300)}
            style={[
              styles.bottom,
              {
                paddingBottom: Math.max(insets.bottom, 14),
                backgroundColor: Platform.OS === "ios" ? "rgba(255,255,255,0.92)" : "#FFFFFF",
              },
            ]}
          >
            <Pressable
              style={[styles.submit, (!canSubmit || submitting) && styles.submitDisabled]}
              onPress={openConfirmModal}
              disabled={!canSubmit || submitting}
            >
              {submitting ? (
                <>
                  <ActivityIndicator size="small" color="#FFF" />
                  <Text style={styles.submitText}>Submitting...</Text>
                </>
              ) : (
                <>
                  <Text style={styles.submitText}>Review & Submit</Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFF" />
                </>
              )}
            </Pressable>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={activeModal !== "none"}
        transparent
        animationType="fade"
        statusBarTranslucent
        presentationStyle="overFullScreen"
        onRequestClose={() => {
          if (!submitting) {
            setActiveModal("none");
          }
        }}
      >
        <View style={styles.modalOverlay}>
          {activeModal === "confirm" ? (
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Review Your Report</Text>
              <Text style={styles.modalSub}>Please verify the details before submitting</Text>
              <Text style={styles.modalText}>Category: {category}</Text>
              <Text style={styles.modalText}>Location: {locationText}</Text>
              {!!description.trim() && <Text style={styles.modalText}>Description: {description.trim()}</Text>}
              <View style={styles.modalActions}>
                <Pressable style={styles.modalEdit} onPress={() => setActiveModal("none")}>
                  <Text style={styles.modalEditText}>Edit</Text>
                </Pressable>
                <Pressable style={styles.modalSubmit} onPress={() => void submit()} disabled={submitting}>
                  {submitting ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <Text style={styles.modalSubmitText}>Submit Report</Text>
                  )}
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.modalCard}>
              <Ionicons
                name="checkmark-circle"
                size={84}
                color="#10B981"
                style={{ alignSelf: "center", marginBottom: 10 }}
              />
              <Text style={styles.modalTitle}>{queued ? "Queued for upload" : "Issue Reported"}</Text>
              <Text style={styles.modalSub}>
                {queued
                  ? "No internet detected. Your report is saved and will be sent automatically."
                  : "Your complaint has been submitted successfully."}
              </Text>
              <View style={styles.modalActions}>
                <Pressable
                  style={styles.modalEdit}
                  onPress={() => {
                    setActiveModal("none");
                    resetForm();
                    router.push("/");
                  }}
                >
                  <Text style={styles.modalEditText}>Back to Home</Text>
                </Pressable>
                <Pressable
                  style={styles.modalSubmit}
                  onPress={() => {
                    setActiveModal("none");
                    resetForm();
                    router.push("/track");
                  }}
                >
                  <Text style={styles.modalSubmitText}>Track</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#EEF2FF" },
  root: { flex: 1 },
  screen: { flex: 1, width: "100%", backgroundColor: "transparent" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 8,
  },
  backBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#F5F7FF", alignItems: "center", justifyContent: "center" },
  backText: { fontSize: 20, fontWeight: "700", color: "#0F172A", lineHeight: 22 },
  headerTitle: { flexShrink: 1, fontSize: 18, fontWeight: "700", color: "#0F172A" },
  steps: { marginLeft: "auto", flexDirection: "row", gap: 6 },
  step: { height: 4, borderRadius: 99 },
  stepDone: { width: 24, backgroundColor: "#4F46E5" },
  stepActive: { width: 32, backgroundColor: "#4F46E5" },
  stepOff: { width: 16, backgroundColor: "#E2E8F0" },
  content: { padding: 16, gap: 24 },
  section: { fontSize: 12, fontWeight: "700", letterSpacing: 1.1, color: "#64748B", textTransform: "uppercase", marginBottom: 10 },
  sectionInline: { marginBottom: 0 },
  captureCard: { borderRadius: 20, overflow: "hidden", shadowColor: "#4F46E5", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.26, shadowRadius: 18, elevation: 8 },
  captureCardPressed: { transform: [{ scale: 0.97 }] },
  captureRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingVertical: 18, overflow: "hidden" },
  captureTextWrap: { flex: 1, paddingRight: 4 },
  capturePulseHalo: { position: "absolute", width: 200, height: 200, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.18)", top: -70, right: -60 },
  captureSweep: { position: "absolute", width: 80, height: 220, backgroundColor: "rgba(255,255,255,0.2)", transform: [{ rotate: "18deg" }] },
  captureIcon: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: "rgba(255,255,255,0.35)", backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  captureTitle: { color: "#FFF", fontSize: 16, fontWeight: "700", lineHeight: 20 },
  captureSub: { color: "rgba(255,255,255,0.82)", fontSize: 12, marginTop: 4, fontWeight: "600", lineHeight: 17 },
  captureArrow: { width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  captureHelpText: { color: "#64748B", fontSize: 12, fontWeight: "600", marginTop: 10, marginLeft: 2 },
  photoCapturedCard: {
    gap: 12,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#C7D2FE",
    backgroundColor: "rgba(238,242,255,0.75)",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  photoPreview: {
    width: "100%",
    height: 180,
    borderRadius: 12,
    backgroundColor: "#E2E8F0",
  },
  photoCapturedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  photoCapturedText: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "600",
  },
  retakeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#EEF2FF", borderRadius: 10, paddingVertical: 9 },
  retakeText: { color: "#4F46E5", fontSize: 13, fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10 },
  cat: { borderRadius: 12, borderWidth: 2, borderColor: "transparent", backgroundColor: "#FFF", alignItems: "center", paddingTop: 10, paddingBottom: 8, paddingHorizontal: 6 },
  catActive: { borderColor: "#4F46E5", backgroundColor: "#EEF2FF" },
  catIcon: { width: 34, height: 34, borderRadius: 9, alignItems: "center", justifyContent: "center", marginBottom: 5 },
  catText: { fontSize: 10.5, fontWeight: "700", color: "#0F172A", textAlign: "center", lineHeight: 14 },
  locBtn: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 2, borderColor: "#E2E8F0", borderRadius: 16, backgroundColor: "#FFF", paddingHorizontal: 14, paddingVertical: 13 },
  locBtnActive: { borderColor: "#4F46E5", backgroundColor: "#EEF2FF" },
  locIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center" },
  locStrong: { color: "#3730A3", fontSize: 14, fontWeight: "700" },
  locSub: { color: "#64748B", fontSize: 12, marginTop: 3, lineHeight: 17 },
  locBadge: { minWidth: 54, minHeight: 28, borderRadius: 20, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
  locBadgeText: { color: "#4F46E5", fontSize: 11, fontWeight: "700" },
  descHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  optional: { color: "#94A3B8", fontSize: 12, fontWeight: "500" },
  textWrap: { borderWidth: 2, borderColor: "#E2E8F0", borderRadius: 16, backgroundColor: "#FFF", paddingHorizontal: 14, paddingVertical: 12, position: "relative" },
  textInput: { minHeight: 96, fontSize: 14, color: "#0F172A", lineHeight: 21, paddingBottom: 22 },
  count: { position: "absolute", right: 14, bottom: 10, color: "#CBD5E1", fontSize: 11 },
  bottom: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },
  submit: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderRadius: 18, paddingVertical: 16, backgroundColor: "#4F46E5" },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: "#FFF", fontSize: 15, fontWeight: "700" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.5)", alignItems: "center", justifyContent: "center", padding: 20 },
  modalCard: { width: "100%", maxWidth: 360, backgroundColor: "#FFF", borderRadius: 20, padding: 18 },
  modalTitle: { color: "#0F172A", fontSize: 20, fontWeight: "800", textAlign: "center" },
  modalSub: { color: "#64748B", fontSize: 12, textAlign: "center", marginTop: 4, marginBottom: 12 },
  modalText: { color: "#0F172A", fontSize: 14, marginTop: 4, lineHeight: 20 },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 12 },
  modalEdit: { flex: 1, minHeight: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#F1F5F9" },
  modalEditText: { color: "#334155", fontSize: 14, fontWeight: "700" },
  modalSubmit: { flex: 1, minHeight: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#4F46E5" },
  modalSubmitText: { color: "#FFF", fontSize: 14, fontWeight: "700" },
});

