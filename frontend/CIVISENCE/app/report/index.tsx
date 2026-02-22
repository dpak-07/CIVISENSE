import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { getApiErrorMessage } from "@/lib/api";
import { sessionStore } from "@/lib/session";
import {
  flushQueuedComplaints,
  getQueuedComplaints,
  type QueuedComplaint,
  submitComplaintOrQueue,
} from "@/lib/services/complaintQueue";

const { width } = Dimensions.get("window");

const CATEGORIES = [
  { id: 1, name: "Pothole", icon: "alert-circle", color: "#FF6B6B", bg: "#FFE5E5" },
  { id: 2, name: "Streetlight", icon: "sunny", color: "#F59E0B", bg: "#FFF4E5" },
  { id: 3, name: "Garbage", icon: "trash", color: "#10B981", bg: "#E5F9F1" },
  { id: 4, name: "Water Leak", icon: "water", color: "#3B82F6", bg: "#E5F0FF" },
  { id: 5, name: "Traffic Sign", icon: "alert", color: "#8B5CF6", bg: "#F3E5FF" },
  { id: 6, name: "Other", icon: "help-circle", color: "#6B7280", bg: "#F3F4F6" },
];

const DRAFT_STORAGE_KEY = "civisense.report.draft.v1";

type Coordinates = {
  latitude: number;
  longitude: number;
};

const formatCoordinates = (latitude: number, longitude: number): string =>
  `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;

const formatQueueTime = (value: string): string => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "Unknown time";
  }

  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

const formatAddressParts = (parts: Array<string | null | undefined>): string | null => {
  const normalized = parts
    .filter((part): part is string => Boolean(part && part.trim()))
    .map((part) => part.trim());

  if (normalized.length === 0) {
    return null;
  }

  const deduped = Array.from(new Set(normalized));
  return deduped.join(", ");
};

const reverseGeocodeWithExpo = async (
  latitude: number,
  longitude: number
): Promise<string | null> => {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (!results || results.length === 0) {
      return null;
    }

    const address = results[0];
    return (
      formatAddressParts([
        address.name,
        address.street,
        address.district,
        address.subregion,
        address.city,
        address.region,
        address.country,
      ]) ?? null
    );
  } catch {
    return null;
  }
};

const reverseGeocodeWithNominatim = async (
  latitude: number,
  longitude: number
): Promise<string | null> => {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=16&addressdetails=1`;
  const headers = {
    "User-Agent": "CiviSense/1.0",
    "Accept-Language": "en",
  };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, { headers });

      if (response.status === 429 || response.status >= 500) {
        await sleep(700);
        continue;
      }

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as {
        address?: Record<string, string | undefined>;
        display_name?: string;
      };

      const address = data.address ?? {};
      const area = formatAddressParts([
        address.suburb,
        address.neighbourhood,
        address.city_district,
        address.city || address.town || address.village,
        address.state,
      ]);

      if (area) {
        return area;
      }

      if (typeof data.display_name === "string" && data.display_name.trim()) {
        return data.display_name.trim();
      }

      return null;
    } catch {
      await sleep(500);
    }
  }

  return null;
};

const reverseGeocodeToArea = async (
  latitude: number,
  longitude: number
): Promise<string | null> => {
  const expoResult = await reverseGeocodeWithExpo(latitude, longitude);
  if (expoResult) {
    return expoResult;
  }

  return reverseGeocodeWithNominatim(latitude, longitude);
};

export default function ReportIssue() {
  const log = (...args: unknown[]) => {
    console.log("[Report]", ...args);
  };

  const params = useLocalSearchParams();
  const scrollViewRef = useRef(null);
  
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [queuedSubmission, setQueuedSubmission] = useState(false);
  const [queuedComplaints, setQueuedComplaints] = useState<QueuedComplaint[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueSyncing, setQueueSyncing] = useState(false);

  const loadDraft = async () => {
    try {
      const raw = await AsyncStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) {
        return;
      }
      const draft = JSON.parse(raw) as {
        category?: string;
        description?: string;
        location?: string;
        coordinates?: Coordinates | null;
        image?: string | null;
      };

      if (!category && draft.category) {
        setCategory(draft.category);
      }
      if (!description && draft.description) {
        setDescription(draft.description);
      }
      if (!location && draft.location) {
        setLocation(draft.location);
      }
      if (!coordinates && draft.coordinates) {
        setCoordinates(draft.coordinates);
      }
      if (!image && draft.image) {
        setImage(draft.image);
      }
    } catch {
      // Ignore draft restore errors.
    }
  };

  const saveDraft = async () => {
    try {
      await AsyncStorage.setItem(
        DRAFT_STORAGE_KEY,
        JSON.stringify({
          category,
          description,
          location,
          coordinates,
          image,
        })
      );
    } catch {
      // Ignore draft save errors.
    }
  };

  const clearDraft = async () => {
    try {
      await AsyncStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // Ignore draft remove errors.
    }
  };

  const loadQueuedItems = async (showLoader = true) => {
    if (showLoader) {
      setQueueLoading(true);
    }

    try {
      const queued = await getQueuedComplaints();
      setQueuedComplaints(queued);
    } finally {
      if (showLoader) {
        setQueueLoading(false);
      }
    }
  };

  // Update image when params change
  useEffect(() => {
    const photoParam = params?.photo;
    if (typeof photoParam === "string" && photoParam.length > 0) {
      log("Photo param received", { uri: photoParam });
      setImage(photoParam);
    }
  }, [params?.photo, params?.captureTs]);

  useEffect(() => {
    void loadDraft();
    void loadQueuedItems();
  }, []);

  useEffect(() => {
    if (image && !location) {
      log("Image set, fetching location");
      getCurrentLocation();
    }
  }, [image]);

  const getCurrentLocation = async () => {
    log("Requesting location permission");
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      log("Location permission status", status);
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Location permission is required");
        setLocationLoading(false);
        return;
      }

      const userLocation = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = userLocation.coords;
      log("Got GPS coordinates", { latitude, longitude });
      setCoordinates({ latitude, longitude });

      const area = await reverseGeocodeToArea(latitude, longitude);
      log("Reverse geocode result", area);
      setLocation(area || formatCoordinates(latitude, longitude));
    } catch (error) {
      console.error("Location Error:", error);
      Alert.alert("Error", "Could not get your location. Please try again.");
    } finally {
      setLocationLoading(false);
    }
  };

  const handlePhotoCapture = () => {
    log("Open camera");
    router.push("/report/camera");
  };

  const handleRemovePhoto = () => {
    log("Photo removed");
    setImage(null);
  };

  const ensureAuthenticated = () => {
    const accessToken = sessionStore.getAccessToken();

    if (accessToken) {
      log("Auth OK");
      return true;
    }

    log("Auth missing");
    void saveDraft();
    Alert.alert("Login required", "Please sign in before submitting a complaint.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign In",
        onPress: () => router.push({ pathname: "/auth/login", params: { returnTo: "/report" } }),
      },
    ]);

    return false;
  };

  const buildComplaintTitle = (selectedCategory: string, locationText: string) => {
    if (!locationText.trim()) {
      return `${selectedCategory} issue reported`;
    }

    return `${selectedCategory} issue near ${locationText.trim().slice(0, 70)}`;
  };

  const handleConfirmSubmit = async () => {
    log("Confirm submit pressed");
    if (!ensureAuthenticated()) {
      return;
    }

    if (!coordinates) {
      log("Submit blocked: no coordinates");
      Alert.alert("Missing location", "Please capture your location before submitting.");
      return;
    }

    setShowConfirmation(false);
    setLoading(true);

    try {
      const normalizedDescription =
        description.trim().length > 0
          ? description.trim()
          : `${category} issue reported via mobile app.`;

      const payload = {
        title: buildComplaintTitle(category, location),
        description: normalizedDescription,
        category,
        longitude: coordinates.longitude,
        latitude: coordinates.latitude,
        imageUri: image,
      };
      log("Submitting complaint", payload);

      const result = await submitComplaintOrQueue({
        ...payload,
      });

      log("Submit result", result);
      setQueuedSubmission(result.queued);
      setShowSuccess(true);
      await clearDraft();
      await loadQueuedItems(false);
    } catch (error) {
      log("Submit failed", getApiErrorMessage(error));
      Alert.alert("Submission failed", getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleQueueSync = async () => {
    setQueueSyncing(true);
    try {
      const result = await flushQueuedComplaints();
      await loadQueuedItems(false);

      if (result.sent > 0) {
        Alert.alert(
          "Queue synced",
          `${result.sent} queued complaint${result.sent === 1 ? "" : "s"} sent successfully.`
        );
        return;
      }

      if (result.remaining > 0) {
        Alert.alert(
          "Queue pending",
          `${result.remaining} complaint${result.remaining === 1 ? "" : "s"} still queued.`
        );
        return;
      }

      Alert.alert("Queue empty", "No queued complaints to sync.");
    } catch (error) {
      Alert.alert("Sync failed", getApiErrorMessage(error));
    } finally {
      setQueueSyncing(false);
    }
  };

  const handleSubmit = () => {
    log("Submit pressed");
    if (!ensureAuthenticated()) {
      return;
    }

    if (!image) {
      log("Validation failed: missing photo");
      Alert.alert("Required", "Please take a photo of the issue");
      return;
    }
    if (!category) {
      log("Validation failed: missing category");
      Alert.alert("Required", "Please select a category");
      return;
    }
    if (!location) {
      log("Validation failed: missing location");
      Alert.alert("Required", "Please get your location");
      return;
    }
    if (!coordinates) {
      log("Validation failed: missing coordinates");
      Alert.alert("Required", "Location coordinates are missing. Tap refresh location.");
      return;
    }
    if (description.trim().length > 0 && description.trim().length < 10) {
      log("Validation failed: description too short");
      Alert.alert("Invalid", "Description should be at least 10 characters or leave it empty");
      return;
    }

    log("Validation OK, opening confirmation");
    setShowConfirmation(true);
  };

  const isPhotoValid = !!image;
  const isCategoryValid = !!category;
  const isLocationValid = !!location && !!coordinates;
  const isDescriptionValid = description.trim().length === 0 || description.trim().length >= 10;
  const isFormValid =
    isPhotoValid && isCategoryValid && isLocationValid && isDescriptionValid;

  const getCategoryColor = () => {
    const cat = CATEGORIES.find(c => c.name === category);
    return cat ? cat.color : "#3B82F6";
  };

  return (
    <LinearGradient
      colors={["#FFFFFF", "#F8FAFC", "#FFFFFF"]}
      style={styles.container}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={28} color="#1F2937" />
          </Pressable>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Report Issue</Text>
          </View>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Queue Status Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="cloud-upload" size={20} color="#6366F1" />
              <Text style={styles.sectionTitle}>Queued Reports</Text>
              <View style={styles.queueCountBadge}>
                <Text style={styles.queueCountText}>{queuedComplaints.length}</Text>
              </View>
            </View>

            <View style={styles.queueCard}>
              <View style={styles.queueCardHeader}>
                <Text style={styles.queueSummaryText}>
                  {queuedComplaints.length === 0
                    ? "No complaints in offline queue."
                    : `${queuedComplaints.length} report${queuedComplaints.length === 1 ? "" : "s"} waiting to sync.`}
                </Text>
                <Pressable
                  style={[styles.queueSyncButton, queueSyncing && styles.queueSyncButtonDisabled]}
                  onPress={handleQueueSync}
                  disabled={queueSyncing || queueLoading}
                >
                  {queueSyncing ? (
                    <ActivityIndicator size="small" color="#4F46E5" />
                  ) : (
                    <>
                      <Ionicons name="sync" size={14} color="#4F46E5" />
                      <Text style={styles.queueSyncText}>Sync</Text>
                    </>
                  )}
                </Pressable>
              </View>

              {queueLoading ? (
                <View style={styles.queueLoaderWrap}>
                  <ActivityIndicator size="small" color="#4F46E5" />
                  <Text style={styles.queueLoaderText}>Loading queue...</Text>
                </View>
              ) : (
                queuedComplaints.slice(0, 3).map((item) => (
                  <View key={item.id} style={styles.queueItem}>
                    <View style={styles.queueItemTop}>
                      <Text style={styles.queueItemCategory}>{item.payload.category}</Text>
                      <Text style={styles.queueItemTime}>{formatQueueTime(item.createdAt)}</Text>
                    </View>
                    <Text style={styles.queueItemMeta}>
                      {formatCoordinates(item.payload.latitude, item.payload.longitude)} | Attempts: {item.attempts}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </View>

          {/* Photo Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="camera" size={20} color="#3B82F6" />
              <Text style={styles.sectionTitle}>Take a Photo</Text>
            </View>

            {!image ? (
              <Pressable
                style={styles.photoButton}
                onPress={handlePhotoCapture}
              >
                <LinearGradient
                  colors={["#3B82F6", "#1E40AF"]}
                  style={styles.photoButtonGradient}
                >
                  <Ionicons name="camera" size={28} color="#fff" />
                  <Text style={styles.photoButtonText}>Tap to Capture Photo</Text>
                </LinearGradient>
              </Pressable>
            ) : (
              <View style={styles.photoPreviewContainer}>
                <Image
                  source={{ uri: image }}
                  style={styles.photoPreview}
                  resizeMode="cover"
                />
                <View style={styles.photoCheckmark}>
                  <Ionicons name="checkmark-circle" size={40} color="#10B981" />
                </View>
                <View style={styles.photoActions}>
                  <Pressable
                    style={styles.photoActionBtn}
                    onPress={handlePhotoCapture}
                  >
                    <Ionicons name="refresh" size={18} color="#3B82F6" />
                    <Text style={styles.photoActionText}>Retake</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.photoActionBtn, styles.photoActionBtnDanger]}
                    onPress={handleRemovePhoto}
                  >
                    <Ionicons name="trash" size={18} color="#FF6B6B" />
                    <Text style={[styles.photoActionText, styles.photoActionTextDanger]}>
                      Remove
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>

          {/* Category Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="list" size={20} color="#8B5CF6" />
              <Text style={styles.sectionTitle}>Select Category</Text>
            </View>

            <View style={styles.categoryGrid}>
              {CATEGORIES.map((cat) => (
                <Pressable
                  key={cat.id}
                  style={[
                    styles.categoryCard,
                    category === cat.name && styles.categoryCardActive,
                  ]}
                  onPress={() => setCategory(cat.name)}
                >
                  <View
                    style={[
                      styles.categoryIconBox,
                      {
                        backgroundColor: category === cat.name ? cat.color : cat.bg,
                      },
                    ]}
                  >
                    <Ionicons
                      name={cat.icon as keyof typeof Ionicons.glyphMap}
                      size={24}
                      color={cat.color}
                    />
                  </View>
                  <Text style={[
                    styles.categoryName,
                    category === cat.name && styles.categoryNameActive,
                  ]}>
                    {cat.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Location Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="location" size={20} color="#10B981" />
              <Text style={styles.sectionTitle}>Location</Text>
            </View>

            {locationLoading ? (
              <View style={styles.locationBox}>
                <ActivityIndicator size="small" color="#3B82F6" />
                <Text style={styles.locationLoadingText}>
                  Getting location...
                </Text>
              </View>
            ) : location ? (
              <View style={styles.locationBox}>
                <Ionicons
                  name="checkmark-circle"
                  size={24}
                  color="#10B981"
                />
                <View style={styles.locationContent}>
                  <Text style={styles.locationText}>{location}</Text>
                </View>
              </View>
            ) : null}

            <Pressable
              style={[
                styles.getLocationBtn,
                location && styles.getLocationBtnActive,
              ]}
              onPress={getCurrentLocation}
              disabled={locationLoading}
            >
              <Ionicons
                name={location ? "refresh" : "location"}
                size={18}
                color={location ? "#10B981" : "#3B82F6"}
              />
              <Text
                style={[
                  styles.getLocationBtnText,
                  location && styles.getLocationBtnTextActive,
                ]}
              >
                {location ? "Refresh Location" : "Get Current Location"}
              </Text>
            </Pressable>
          </View>

          {/* Description Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="document-text" size={20} color="#F59E0B" />
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.optional}>(Optional)</Text>
            </View>

            <View style={styles.inputBox}>
              <TextInput
                style={styles.textarea}
                placeholder="Describe the issue (optional - helps us resolve it faster)"
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={4}
                value={description}
                onChangeText={setDescription}
                textAlignVertical="top"
                maxLength={500}
              />
            </View>

            <View style={styles.charCount}>
              <Text style={styles.charCountText}>
                {description.length}/500 characters
              </Text>
              {description.trim().length >= 10 && (
                <View style={styles.validBadge}>
                  <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                  <Text style={styles.validText}>Good description!</Text>
                </View>
              )}
            </View>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Bottom Button */}
        <View style={styles.bottomButton}>
          <LinearGradient
            colors={
              isFormValid
                ? ["#3B82F6", "#1E40AF"]
                : ["#D1D5DB", "#9CA3AF"]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.submitGradient}
          >
            <Pressable
              onPress={handleSubmit}
              disabled={!isFormValid}
              style={styles.submitButton}
            >
              <Text style={styles.submitButtonText}>Review & Submit</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </Pressable>
          </LinearGradient>
        </View>
      </KeyboardAvoidingView>

      {/* Confirmation Modal */}
      <Modal visible={showConfirmation} transparent animationType="slide">
        <View style={styles.confirmationOverlay}>
          <View style={styles.confirmationCard}>
            <View style={styles.confirmationHeader}>
              <Text style={styles.confirmationTitle}>Review Your Report</Text>
              <Text style={styles.confirmationSubtitle}>
                Please verify the details before submitting
              </Text>
            </View>

            <ScrollView style={styles.confirmationContent} showsVerticalScrollIndicator={false}>
              {/* Photo Preview */}
              <View style={styles.confirmationItem}>
                <View style={styles.confirmationItemHeader}>
                  <Ionicons name="camera" size={20} color="#3B82F6" />
                  <Text style={styles.confirmationItemTitle}>Photo</Text>
                </View>
                {image && (
                  <Image
                    source={{ uri: image }}
                    style={styles.confirmationPhoto}
                    resizeMode="cover"
                  />
                )}
              </View>

              {/* Category */}
              <View style={styles.confirmationItem}>
                <View style={styles.confirmationItemHeader}>
                  <Ionicons name="list" size={20} color={getCategoryColor()} />
                  <Text style={styles.confirmationItemTitle}>Category</Text>
                </View>
                <View style={[styles.confirmationBadge, { backgroundColor: getCategoryColor() + "20" }]}>
                  <Text style={[styles.confirmationBadgeText, { color: getCategoryColor() }]}>
                    {category}
                  </Text>
                </View>
              </View>

              {/* Location */}
              <View style={styles.confirmationItem}>
                <View style={styles.confirmationItemHeader}>
                  <Ionicons name="location" size={20} color="#10B981" />
                  <Text style={styles.confirmationItemTitle}>Location</Text>
                </View>
                <Text style={styles.confirmationDetailText}>{location}</Text>
              </View>

              {/* Description */}
              {description && description.trim().length > 0 && (
                <View style={styles.confirmationItem}>
                  <View style={styles.confirmationItemHeader}>
                    <Ionicons name="document-text" size={20} color="#F59E0B" />
                    <Text style={styles.confirmationItemTitle}>Description</Text>
                  </View>
                  <Text style={styles.confirmationDetailText}>{description}</Text>
                </View>
              )}
            </ScrollView>

            {/* Action Buttons */}
            <View style={styles.confirmationActions}>
              <Pressable
                style={styles.confirmationBtnCancel}
                onPress={() => setShowConfirmation(false)}
              >
                <Text style={styles.confirmationBtnCancelText}>Edit</Text>
              </Pressable>

              <LinearGradient
                colors={["#3B82F6", "#1E40AF"]}
                style={styles.confirmationBtnSubmit}
              >
                <Pressable
                  onPress={handleConfirmSubmit}
                  disabled={loading}
                  style={styles.confirmationBtnSubmitPress}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <>
                      <Ionicons name="send" size={18} color="#fff" />
                      <Text style={styles.confirmationBtnSubmitText}>
                        Submit Report
                      </Text>
                    </>
                  )}
                </Pressable>
              </LinearGradient>
            </View>
          </View>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal visible={showSuccess} transparent animationType="fade">
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <View style={styles.successIconContainer}>
              <Ionicons name="checkmark-circle" size={100} color="#10B981" />
            </View>

            <Text style={styles.successTitle}>
              {queuedSubmission ? "Queued for upload" : "Issue Reported!"}
            </Text>
            <Text style={styles.successMessage}>
              {queuedSubmission
                ? "No internet detected. Your report is saved on this device and will be sent automatically when you are back online."
                : "Your complaint has been successfully submitted to the nearest municipality. You can track its progress anytime."}
            </Text>

            {/* Action Buttons */}
            <View style={styles.successActions}>
              <Pressable
                style={styles.successBtnSecondary}
                onPress={() => {
                  setShowSuccess(false);
                  setQueuedSubmission(false);
                  setCategory("");
                  setDescription("");
                  setLocation("");
                  setCoordinates(null);
                  setImage(null);
                  router.push("/");
                }}
              >
                <Ionicons name="home" size={20} color="#3B82F6" />
                <Text style={styles.successBtnSecondaryText}>Back to Home</Text>
              </Pressable>

              <Pressable
                style={styles.successBtnPrimaryWrapper}
                onPress={() => {
                  setShowSuccess(false);
                  setQueuedSubmission(false);
                  setCategory("");
                  setDescription("");
                  setLocation("");
                  setCoordinates(null);
                  setImage(null);
                  router.push("/track");
                }}
              >
                <LinearGradient
                  colors={["#3B82F6", "#1E40AF"]}
                  style={styles.successBtnPrimary}
                >
                  <Ionicons name="list" size={20} color="#fff" />
                  <Text style={styles.successBtnPrimaryText}>Track Complaints</Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },

  /* Header */
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerContent: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1F2937",
  },

  /* Section */
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
  },
  optional: {
    fontSize: 12,
    color: "#9CA3AF",
    fontWeight: "500",
    marginLeft: "auto",
  },
  queueCountBadge: {
    marginLeft: "auto",
    minWidth: 26,
    height: 26,
    paddingHorizontal: 8,
    borderRadius: 13,
    backgroundColor: "#E0E7FF",
    alignItems: "center",
    justifyContent: "center",
  },
  queueCountText: {
    color: "#3730A3",
    fontSize: 12,
    fontWeight: "800",
  },
  queueCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E0E7FF",
    backgroundColor: "#F8FAFF",
    padding: 12,
    gap: 10,
  },
  queueCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  queueSummaryText: {
    flex: 1,
    fontSize: 13,
    color: "#334155",
    fontWeight: "600",
  },
  queueSyncButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#EEF2FF",
    borderWidth: 1,
    borderColor: "#C7D2FE",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minHeight: 32,
  },
  queueSyncButtonDisabled: {
    opacity: 0.7,
  },
  queueSyncText: {
    color: "#4F46E5",
    fontSize: 12,
    fontWeight: "700",
  },
  queueLoaderWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  queueLoaderText: {
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600",
  },
  queueItem: {
    borderTopWidth: 1,
    borderTopColor: "#DBEAFE",
    paddingTop: 10,
    gap: 4,
  },
  queueItemTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  queueItemCategory: {
    color: "#1E3A8A",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  queueItemTime: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "600",
  },
  queueItemMeta: {
    color: "#475569",
    fontSize: 11,
    fontWeight: "600",
  },

  /* Photo - New Design */
  photoButton: {
    borderRadius: 16,
    overflow: "hidden",
  },
  photoButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    gap: 12,
  },
  photoButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  photoPreviewContainer: {
    position: "relative",
  },
  photoPreview: {
    width: "100%",
    height: 200,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
  },
  photoCheckmark: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 20,
  },
  photoActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  photoActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    gap: 8,
  },
  photoActionBtnDanger: {
    backgroundColor: "#FEE2E2",
    borderColor: "#FECACA",
  },
  photoActionText: {
    color: "#3B82F6",
    fontSize: 14,
    fontWeight: "600",
  },
  photoActionTextDanger: {
    color: "#FF6B6B",
  },

  /* Category */
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  categoryCard: {
    width: (width - 60) / 3,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  categoryCardActive: {
    backgroundColor: "#EFF6FF",
    borderColor: "#3B82F6",
  },
  categoryIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  categoryName: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1F2937",
    textAlign: "center",
  },
  categoryNameActive: {
    color: "#3B82F6",
  },

  /* Location */
  locationBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#DCFCE7",
    gap: 12,
  },
  locationContent: {
    flex: 1,
  },
  locationText: {
    fontSize: 13,
    color: "#374151",
    fontWeight: "600",
  },
  locationLoadingText: {
    fontSize: 13,
    color: "#3B82F6",
    fontWeight: "600",
  },
  getLocationBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#BFDBFE",
    gap: 8,
  },
  getLocationBtnActive: {
    backgroundColor: "#F0FDF4",
    borderColor: "#DCFCE7",
  },
  getLocationBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#3B82F6",
  },
  getLocationBtnTextActive: {
    color: "#10B981",
  },

  /* Input - Improved */
  inputBox: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  textarea: {
    color: "#1F2937",
    fontSize: 14,
    textAlignVertical: "top",
    minHeight: 100,
    lineHeight: 20,
  },
  charCount: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  charCountText: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },
  validBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F0FDF4",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  validText: {
    fontSize: 11,
    color: "#10B981",
    fontWeight: "600",
  },

  /* Bottom Button */
  bottomButton: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingVertical: 12,
    paddingBottom: 20,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  submitGradient: {
    borderRadius: 12,
    overflow: "hidden",
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 8,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },

  /* Confirmation Modal */
  confirmationOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  confirmationCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
    paddingTop: 20,
  },
  confirmationHeader: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  confirmationTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1F2937",
  },
  confirmationSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
  },
  confirmationContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    maxHeight: "60%",
  },
  confirmationItem: {
    marginBottom: 18,
  },
  confirmationItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  confirmationItemTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1F2937",
  },
  confirmationPhoto: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
  },
  confirmationBadge: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  confirmationBadgeText: {
    fontSize: 13,
    fontWeight: "700",
  },
  confirmationDetailText: {
    fontSize: 13,
    color: "#374151",
    lineHeight: 18,
  },
  confirmationActions: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  confirmationBtnCancel: {
    flex: 0.4,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  confirmationBtnCancelText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#6B7280",
  },
  confirmationBtnSubmit: {
    flex: 0.6,
    borderRadius: 10,
    overflow: "hidden",
  },
  confirmationBtnSubmitPress: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    gap: 8,
  },
  confirmationBtnSubmitText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },

  /* Success Modal - Updated */
  successOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  successCard: {
    width: width - 48,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
  },
  successIconContainer: {
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#10B981",
    marginBottom: 12,
  },
  successMessage: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  successActions: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  successBtnSecondary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#BFDBFE",
    gap: 8,
  },
  successBtnSecondaryText: {
    color: "#3B82F6",
    fontSize: 14,
    fontWeight: "700",
  },
  successBtnPrimaryWrapper: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  successBtnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 8,
  },
  successBtnPrimaryText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
});
