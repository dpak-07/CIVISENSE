import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { getApiErrorMessage } from "@/lib/api";
import { useAppPreferences } from "@/lib/appPreferencesContext";
import { registerUser } from "@/lib/services/auth";

export default function Register() {
  const insets = useSafeAreaInsets();
  const { preferences, theme, t } = useAppPreferences();
  const isDark = preferences.darkMode;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [profilePhotoUri, setProfilePhotoUri] = useState<string | null>(null);

  const handlePickProfilePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t("auth.permissionNeeded"), t("auth.allowPhotoAccess"));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (result.canceled) {
      return;
    }

    const uri = result.assets?.[0]?.uri;
    if (uri) {
      setProfilePhotoUri(uri);
    }
  };

  const handleRemoveProfilePhoto = () => {
    setProfilePhotoUri(null);
  };

  const handleRegister = async () => {
    if (!name || !email || !password || !confirmPassword) {
      Alert.alert("Missing fields", "Please fill in all fields.");
      return;
    }

    if (password.length < 8) {
      Alert.alert("Weak password", "Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Password mismatch", "Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      await registerUser({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        profilePhotoUri,
      });

      router.replace("/");
    } catch (error) {
      Alert.alert("Registration failed", getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={isDark ? ["#0B1220", "#111C31"] : ["#F1F6FC", "#E0EAFF"]}
      style={styles.container}
    >
      <StatusBar style={theme.statusBar} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[styles.wrapper, { paddingTop: insets.top + 8 }]}
      >
        <Animated.View entering={FadeInDown.duration(600)} style={styles.header}>
          <Ionicons
            name="arrow-back"
            size={28}
            color={theme.colors.text}
            onPress={() => router.back()}
          />
          <Text style={[styles.title, { color: theme.colors.text }]}>{t("auth.createAccount")}</Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(100).duration(700)} style={styles.form}>
          <View style={styles.avatarSection}>
            <Pressable style={styles.avatarButton} onPress={handlePickProfilePhoto}>
              {profilePhotoUri ? (
                <Image source={{ uri: profilePhotoUri }} style={styles.avatarImage} />
              ) : (
                <Ionicons name="camera-outline" size={28} color={theme.colors.accent} />
              )}
              <View style={styles.avatarBadge}>
                <Ionicons name="add" size={16} color="#fff" />
              </View>
            </Pressable>
            <Text style={[styles.avatarHint, { color: theme.colors.subText }]}>
              {t("auth.addProfilePhoto")}
            </Text>
            {profilePhotoUri ? (
              <Pressable onPress={handleRemoveProfilePhoto}>
                <Text style={styles.avatarRemove}>{t("auth.removePhoto")}</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.text }]}>{t("auth.fullName")}</Text>
            <View
              style={[
                styles.inputWrapper,
                {
                  backgroundColor: isDark ? "#0F172A" : "rgba(255,255,255,0.8)",
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Ionicons
                name="person-outline"
                size={20}
                color={theme.colors.accent}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, { color: theme.colors.text }]}
                placeholder="Your name"
                placeholderTextColor="#9ca3af"
                value={name}
                onChangeText={setName}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.text }]}>{t("auth.emailAddress")}</Text>
            <View
              style={[
                styles.inputWrapper,
                {
                  backgroundColor: isDark ? "#0F172A" : "rgba(255,255,255,0.8)",
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Ionicons
                name="mail-outline"
                size={20}
                color={theme.colors.accent}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, { color: theme.colors.text }]}
                placeholder="you@example.com"
                placeholderTextColor="#9ca3af"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.text }]}>{t("auth.password")}</Text>
            <View
              style={[
                styles.inputWrapper,
                {
                  backgroundColor: isDark ? "#0F172A" : "rgba(255,255,255,0.8)",
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color={theme.colors.accent}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, { color: theme.colors.text }]}
                placeholder="Minimum 8 characters"
                placeholderTextColor="#9ca3af"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <Pressable onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? "eye-off" : "eye"}
                  size={20}
                  color={theme.colors.accent}
                />
              </Pressable>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.colors.text }]}>
              {t("auth.confirmPassword")}
            </Text>
            <View
              style={[
                styles.inputWrapper,
                {
                  backgroundColor: isDark ? "#0F172A" : "rgba(255,255,255,0.8)",
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Ionicons
                name="shield-checkmark-outline"
                size={20}
                color={theme.colors.accent}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, { color: theme.colors.text }]}
                placeholder="Re-enter password"
                placeholderTextColor="#9ca3af"
                secureTextEntry={!showPassword}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
              />
            </View>
          </View>

          <LinearGradient colors={["#2563EB", "#1d4ed8"]} style={styles.button}>
            <Pressable onPress={handleRegister} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>{t("auth.createAccountButton")}</Text>
              )}
            </Pressable>
          </LinearGradient>

          <View style={styles.registerLink}>
            <Text style={[styles.registerText, { color: theme.colors.subText }]}>
              {t("auth.alreadyHaveAccount")}{" "}
            </Text>
            <Pressable onPress={() => router.push("/auth/login")}>
              <Text style={styles.registerLink2}>{t("auth.signIn")}</Text>
            </Pressable>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  wrapper: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
  },
  header: {
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1e3a8a",
    marginTop: 12,
  },
  form: {
    gap: 20,
  },
  avatarSection: {
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  avatarButton: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.9)",
    borderWidth: 2,
    borderColor: "#dbeafe",
  },
  avatarImage: {
    width: 78,
    height: 78,
    borderRadius: 39,
  },
  avatarBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  avatarHint: {
    fontSize: 13,
    color: "#475569",
  },
  avatarRemove: {
    fontSize: 12,
    color: "#ef4444",
    fontWeight: "600",
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1e3a8a",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.8)",
    borderRadius: 12,
    borderColor: "#dbeafe",
    borderWidth: 1.5,
    paddingHorizontal: 12,
    height: 50,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: "#1f2937",
  },
  button: {
    height: 50,
    borderRadius: 12,
    marginTop: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  registerLink: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 16,
  },
  registerText: {
    color: "#6b7280",
    fontSize: 14,
  },
  registerLink2: {
    color: "#2563EB",
    fontWeight: "bold",
    fontSize: 14,
  },
});
