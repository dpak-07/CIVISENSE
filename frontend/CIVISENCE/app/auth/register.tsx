import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated as RNAnimated,
  Alert,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
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
import { safeBack } from "@/lib/navigation";
import { registerUser } from "@/lib/services/auth";
import CiviSenseLogo from "@/components/branding/CiviSenseLogo";

const USE_NATIVE_DRIVER = Platform.OS !== "web";

function FloatingGlow({
  style,
  duration,
  delay,
}: {
  style: object;
  duration: number;
  delay: number;
}) {
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

export default function Register() {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { preferences, theme, t } = useAppPreferences();
  const isDark = preferences.darkMode;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [profilePhotoUri, setProfilePhotoUri] = useState<string | null>(null);

  const passwordStrength = useMemo(() => {
    let score = 0;
    if (password.length >= 8) {
      score += 1;
    }
    if (/[A-Z]/.test(password)) {
      score += 1;
    }
    if (/[0-9]/.test(password)) {
      score += 1;
    }
    if (/[^A-Za-z0-9]/.test(password)) {
      score += 1;
    }
    return score;
  }, [password]);
  const compact = windowHeight < 780;
  const veryCompact = windowHeight < 710;

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

      router.replace({ pathname: "/", params: { welcome: "1" } });
    } catch (error) {
      Alert.alert("Registration failed", getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={isDark ? ["#0B1020", "#121C32"] : ["#DDE4F7", "#EEF3FF"]}
      style={styles.container}
    >
      <StatusBar style={theme.statusBar} />
      <FloatingGlow style={[styles.glow, styles.glowOne]} duration={5200} delay={0} />
      <FloatingGlow style={[styles.glow, styles.glowTwo]} duration={6200} delay={600} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.wrapper}
      >
        <View
          style={[
            styles.content,
            {
              paddingTop: insets.top + (veryCompact ? 4 : 10),
              paddingBottom: Math.max(insets.bottom, 12) + (veryCompact ? 8 : 14),
            },
          ]}
        >
          <Animated.View
            entering={FadeInDown.duration(450)}
            style={[
              styles.card,
              compact && styles.cardCompact,
              {
                backgroundColor: isDark ? "rgba(17,26,46,0.95)" : "rgba(255,255,255,0.97)",
                borderColor: isDark ? "rgba(148,163,184,0.22)" : "rgba(79,70,229,0.14)",
              },
            ]}
          >
            <Pressable style={styles.backButton} onPress={() => safeBack("/")}>
              <Ionicons name="arrow-back" size={18} color={theme.colors.subText} />
            </Pressable>

            <View style={styles.brandRow}>
              <View style={styles.logoPill}>
                <CiviSenseLogo size={28} />
              </View>
              <Text style={[styles.brandName, { color: theme.colors.subText }]}>CiviSense</Text>
            </View>

            <Text style={[styles.pageTitle, compact && styles.pageTitleCompact, { color: theme.colors.text }]}>
              Create Account
            </Text>
            <Text style={[styles.pageSub, compact && styles.pageSubCompact, { color: theme.colors.subText }]}>
              Join citizens helping make the city better.
            </Text>

            <Animated.View entering={FadeInUp.duration(520).delay(80)} style={[styles.form, compact && styles.formCompact]}>
              <View style={[styles.avatarSection, compact && styles.avatarSectionCompact]}>
                <Pressable style={[styles.avatarButton, compact && styles.avatarButtonCompact]} onPress={handlePickProfilePhoto}>
                  {profilePhotoUri ? (
                    <Image source={{ uri: profilePhotoUri }} style={[styles.avatarImage, compact && styles.avatarImageCompact]} />
                  ) : (
                    <Ionicons name="camera-outline" size={compact ? 22 : 26} color="#4F46E5" />
                  )}
                  <View style={styles.avatarBadge}>
                    <Ionicons name="add" size={14} color="#fff" />
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
                <Text style={[styles.label, { color: theme.colors.subText }]}>{t("auth.fullName")}</Text>
                <View
                  style={[
                    styles.inputWrap,
                    compact && styles.inputWrapCompact,
                    {
                      backgroundColor: isDark ? "rgba(15,23,42,0.72)" : "#F8FAFF",
                      borderColor: isDark ? "rgba(148,163,184,0.28)" : "#E2E8F0",
                    },
                  ]}
                >
                  <Ionicons name="person-outline" size={18} color="#64748B" />
                  <TextInput
                    style={[styles.input, { color: theme.colors.text }]}
                    placeholder="Your name"
                    placeholderTextColor="#94A3B8"
                    value={name}
                    onChangeText={setName}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.colors.subText }]}>{t("auth.emailAddress")}</Text>
                <View
                  style={[
                    styles.inputWrap,
                    compact && styles.inputWrapCompact,
                    {
                      backgroundColor: isDark ? "rgba(15,23,42,0.72)" : "#F8FAFF",
                      borderColor: isDark ? "rgba(148,163,184,0.28)" : "#E2E8F0",
                    },
                  ]}
                >
                  <Ionicons name="mail-outline" size={18} color="#64748B" />
                  <TextInput
                    style={[styles.input, { color: theme.colors.text }]}
                    placeholder="you@example.com"
                    placeholderTextColor="#94A3B8"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={email}
                    onChangeText={setEmail}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.colors.subText }]}>{t("auth.password")}</Text>
                <View
                  style={[
                    styles.inputWrap,
                    compact && styles.inputWrapCompact,
                    {
                      backgroundColor: isDark ? "rgba(15,23,42,0.72)" : "#F8FAFF",
                      borderColor: isDark ? "rgba(148,163,184,0.28)" : "#E2E8F0",
                    },
                  ]}
                >
                  <Ionicons name="lock-closed-outline" size={18} color="#64748B" />
                  <TextInput
                    style={[styles.input, { color: theme.colors.text }]}
                    placeholder="Minimum 8 characters"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                  />
                  <Pressable onPress={() => setShowPassword((prev) => !prev)} hitSlop={10}>
                    <Ionicons
                      name={showPassword ? "eye-off-outline" : "eye-outline"}
                      size={18}
                      color="#64748B"
                    />
                  </Pressable>
                </View>
                <View style={styles.strengthRow}>
                  {[1, 2, 3, 4].map((item) => {
                    const active = passwordStrength >= item;
                    const tone =
                      passwordStrength <= 1 ? "#EF4444" : passwordStrength <= 3 ? "#F59E0B" : "#22C55E";
                    return (
                      <View
                        key={item}
                        style={[
                          styles.strengthBar,
                          { backgroundColor: active ? tone : "#E2E8F0" },
                        ]}
                      />
                    );
                  })}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.colors.subText }]}>{t("auth.confirmPassword")}</Text>
                <View
                  style={[
                    styles.inputWrap,
                    compact && styles.inputWrapCompact,
                    {
                      backgroundColor: isDark ? "rgba(15,23,42,0.72)" : "#F8FAFF",
                      borderColor: isDark ? "rgba(148,163,184,0.28)" : "#E2E8F0",
                    },
                  ]}
                >
                  <Ionicons name="shield-checkmark-outline" size={18} color="#64748B" />
                  <TextInput
                    style={[styles.input, { color: theme.colors.text }]}
                    placeholder="Re-enter password"
                    placeholderTextColor="#94A3B8"
                    secureTextEntry={!showPassword}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                  />
                </View>
              </View>

              <Text style={[styles.terms, compact && styles.termsCompact, { color: theme.colors.subText }]}>
                By creating an account you agree to Terms of Service and Privacy Policy.
              </Text>

              <Pressable onPress={handleRegister} disabled={loading} style={styles.buttonWrap}>
                <LinearGradient colors={["#4F46E5", "#7C3AED"]} style={[styles.button, compact && styles.buttonCompact]}>
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>{t("auth.createAccountButton")}  {"\u2192"}</Text>
                  )}
                </LinearGradient>
              </Pressable>

              <View style={[styles.footerLink, compact && styles.footerLinkCompact]}>
                <Text style={[styles.footerText, { color: theme.colors.subText }]}>
                  {t("auth.alreadyHaveAccount")}{" "}
                </Text>
                <Pressable onPress={() => router.push({ pathname: "/auth", params: { mode: "signin" } })}>
                  <Text style={styles.footerAction}>{t("auth.signIn")}</Text>
                </Pressable>
              </View>
            </Animated.View>
          </Animated.View>
        </View>
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
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  glow: {
    position: "absolute",
    borderRadius: 999,
    opacity: 0.2,
  },
  glowOne: {
    width: 280,
    height: 280,
    right: -120,
    top: -90,
    backgroundColor: "#6366F1",
  },
  glowTwo: {
    width: 220,
    height: 220,
    left: -90,
    bottom: -40,
    backgroundColor: "#A855F7",
  },
  card: {
    borderRadius: 34,
    borderWidth: 1.5,
    paddingHorizontal: 20,
    paddingVertical: 22,
    shadowColor: "#4F46E5",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.17,
    shadowRadius: 30,
    elevation: 8,
  },
  cardCompact: {
    borderRadius: 28,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: "#F5F7FF",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 6,
  },
  logoPill: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  brandName: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  pageTitle: {
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.9,
    lineHeight: 34,
  },
  pageTitleCompact: {
    fontSize: 24,
    lineHeight: 28,
  },
  pageSub: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 20,
  },
  pageSubCompact: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 16,
  },
  form: {
    marginTop: 18,
    gap: 13,
  },
  formCompact: {
    marginTop: 12,
    gap: 9,
  },
  avatarSection: {
    alignItems: "center",
    gap: 7,
    marginBottom: 4,
  },
  avatarSectionCompact: {
    gap: 4,
    marginBottom: 2,
  },
  avatarButton: {
    width: 86,
    height: 86,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(79,70,229,0.08)",
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "rgba(79,70,229,0.45)",
  },
  avatarButtonCompact: {
    width: 70,
    height: 70,
    borderRadius: 20,
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 22,
  },
  avatarImageCompact: {
    width: 64,
    height: 64,
    borderRadius: 18,
  },
  avatarBadge: {
    position: "absolute",
    right: -4,
    bottom: -4,
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: "#4F46E5",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  avatarHint: {
    fontSize: 12,
    fontWeight: "600",
  },
  avatarRemove: {
    fontSize: 12,
    color: "#ef4444",
    fontWeight: "600",
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    height: 52,
    gap: 10,
  },
  inputWrapCompact: {
    height: 46,
    borderRadius: 12,
    paddingHorizontal: 10,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
  },
  strengthRow: {
    flexDirection: "row",
    gap: 4,
    marginTop: 2,
  },
  strengthBar: {
    flex: 1,
    height: 3,
    borderRadius: 99,
    backgroundColor: "#E2E8F0",
  },
  terms: {
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
    marginTop: 4,
  },
  termsCompact: {
    marginTop: 2,
    fontSize: 10,
    lineHeight: 14,
  },
  buttonWrap: {
    marginTop: 4,
  },
  button: {
    height: 52,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#4F46E5",
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.33,
    shadowRadius: 20,
    elevation: 6,
  },
  buttonCompact: {
    height: 46,
    borderRadius: 13,
  },
  buttonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  footerLink: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 4,
  },
  footerLinkCompact: {
    marginTop: 2,
  },
  footerText: {
    fontSize: 14,
  },
  footerAction: {
    color: "#4F46E5",
    fontWeight: "700",
    fontSize: 14,
  },
});
