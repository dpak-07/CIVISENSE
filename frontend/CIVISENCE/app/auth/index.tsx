import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated as RNAnimated,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getApiErrorMessage } from "@/lib/api";
import { useAppPreferences } from "@/lib/appPreferencesContext";
import { loginUser, registerUser, requestRegisterOtp } from "@/lib/services/auth";
import CiviSenseLogo from "@/components/branding/CiviSenseLogo";

type Mode = "signin" | "signup";

const USE_NATIVE_DRIVER = Platform.OS !== "web";
const OTP_RESEND_SECONDS = 60;

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
          toValue: -20,
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

export default function AuthEntryScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ mode?: string | string[]; returnTo?: string | string[] }>();
  const { preferences, theme } = useAppPreferences();
  const isDark = preferences.darkMode;

  const modeParam = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const returnToParam = Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;

  const [mode, setMode] = useState<Mode>(modeParam === "signup" ? "signup" : "signin");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [profilePhotoUri, setProfilePhotoUri] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);

  useEffect(() => {
    if (modeParam === "signup") {
      setMode("signup");
    } else if (modeParam === "signin") {
      setMode("signin");
    }
  }, [modeParam]);

  const afterAuthRoute = useMemo(() => {
    if (returnToParam && typeof returnToParam === "string" && returnToParam.length > 0) {
      return returnToParam;
    }
    return "/";
  }, [returnToParam]);

  const resetSharedFields = () => {
    setPassword("");
    setConfirmPassword("");
    setOtp("");
  };

  useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = setInterval(() => {
      setOtpCooldown((value) => Math.max(0, value - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [otpCooldown]);

  const handlePickProfilePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow photo access to set profile image.");
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

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert("Missing fields", "Please fill in all fields.");
      return;
    }

    setLoading(true);
    try {
      await loginUser({
        email: email.trim().toLowerCase(),
        password,
      });
      router.replace(afterAuthRoute as never);
    } catch (error) {
      Alert.alert("Login failed", getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
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

    if (!otp.trim()) {
      Alert.alert("OTP required", "Enter the OTP sent to your email.");
      return;
    }

    setLoading(true);
    try {
      await registerUser({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        otp: otp.trim(),
        profilePhotoUri,
      });
      if (afterAuthRoute !== "/") {
        router.replace(afterAuthRoute as never);
      } else {
        router.replace({ pathname: "/", params: { welcome: "1" } });
      }
    } catch (error) {
      Alert.alert("Registration failed", getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    if (!email.trim()) {
      Alert.alert("Missing email", "Enter your email to receive OTP.");
      return;
    }

    setOtpSending(true);
    try {
      await requestRegisterOtp(email.trim().toLowerCase());
      setOtpCooldown(OTP_RESEND_SECONDS);
      Alert.alert("OTP sent", "Check your email for the verification code.");
    } catch (error) {
      Alert.alert("OTP failed", getApiErrorMessage(error));
    } finally {
      setOtpSending(false);
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
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 10, paddingBottom: Math.max(insets.bottom, 14) + 14 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={[
              styles.card,
              {
                backgroundColor: isDark ? "rgba(17,26,46,0.95)" : "rgba(255,255,255,0.97)",
                borderColor: isDark ? "rgba(148,163,184,0.22)" : "rgba(79,70,229,0.14)",
              },
            ]}
          >
            <View style={styles.brandRow}>
              <View style={styles.logoPill}>
                <CiviSenseLogo size={28} />
              </View>
              <Text style={[styles.brandName, { color: theme.colors.subText }]}>CiviSense</Text>
            </View>

            <Text style={[styles.pageTitle, { color: theme.colors.text }]}>Welcome to CiviSense</Text>
            <Text style={[styles.pageSub, { color: theme.colors.subText }]}>
              Sign in if you already have an account, or create a new one.
            </Text>

            <View
              style={[
                styles.toggleWrap,
                {
                  backgroundColor: isDark ? "rgba(30,41,59,0.8)" : "#F3F5FF",
                  borderColor: isDark ? "rgba(148,163,184,0.25)" : "#E2E8F0",
                },
              ]}
            >
              <Pressable
                style={[styles.toggleBtn, mode === "signin" && styles.toggleBtnActive]}
                onPress={() => {
                  setMode("signin");
                  resetSharedFields();
                }}
              >
                <Text style={[styles.toggleTxt, mode === "signin" && styles.toggleTxtActive]}>
                  Sign In
                </Text>
              </Pressable>
              <Pressable
                style={[styles.toggleBtn, mode === "signup" && styles.toggleBtnActive]}
                onPress={() => {
                  setMode("signup");
                  resetSharedFields();
                }}
              >
                <Text style={[styles.toggleTxt, mode === "signup" && styles.toggleTxtActive]}>
                  Sign Up
                </Text>
              </Pressable>
            </View>

            {mode === "signup" ? (
              <View style={styles.avatarSection}>
                <Pressable style={styles.avatarButton} onPress={handlePickProfilePhoto}>
                  {profilePhotoUri ? (
                    <Image source={{ uri: profilePhotoUri }} style={styles.avatarImage} />
                  ) : (
                    <Ionicons name="camera-outline" size={24} color="#4F46E5" />
                  )}
                  <View style={styles.avatarBadge}>
                    <Ionicons name="add" size={12} color="#fff" />
                  </View>
                </Pressable>
              </View>
            ) : null}

            <View style={styles.form}>
              {mode === "signup" ? (
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: theme.colors.subText }]}>Full Name</Text>
                  <View style={[styles.inputWrap, { borderColor: isDark ? "rgba(148,163,184,0.25)" : "#E2E8F0" }]}>
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
              ) : null}

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.colors.subText }]}>Email Address</Text>
                <View style={[styles.inputWrap, { borderColor: isDark ? "rgba(148,163,184,0.25)" : "#E2E8F0" }]}>
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
                <Text style={[styles.label, { color: theme.colors.subText }]}>Password</Text>
                <View style={[styles.inputWrap, { borderColor: isDark ? "rgba(148,163,184,0.25)" : "#E2E8F0" }]}>
                  <Ionicons name="lock-closed-outline" size={18} color="#64748B" />
                  <TextInput
                    style={[styles.input, { color: theme.colors.text }]}
                    placeholder={mode === "signup" ? "Minimum 8 characters" : "Enter your password"}
                    placeholderTextColor="#94A3B8"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                  />
                  <Pressable onPress={() => setShowPassword((prev) => !prev)} hitSlop={10}>
                    <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={18} color="#64748B" />
                  </Pressable>
                </View>
              </View>

              {mode === "signup" ? (
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: theme.colors.subText }]}>Confirm Password</Text>
                  <View style={[styles.inputWrap, { borderColor: isDark ? "rgba(148,163,184,0.25)" : "#E2E8F0" }]}>
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
              ) : null}

              {mode === "signup" ? (
                <View style={styles.otpGroup}>
                  <View style={styles.otpRow}>
                    <View style={styles.otpInput}>
                      <Text style={[styles.label, { color: theme.colors.subText }]}>Email OTP</Text>
                      <View style={[styles.inputWrap, { borderColor: isDark ? "rgba(148,163,184,0.25)" : "#E2E8F0" }]}>
                        <Ionicons name="mail-outline" size={18} color="#64748B" />
                        <TextInput
                          style={[styles.input, { color: theme.colors.text }]}
                          placeholder="6-digit code"
                          placeholderTextColor="#94A3B8"
                          keyboardType="number-pad"
                          value={otp}
                          onChangeText={setOtp}
                          maxLength={6}
                        />
                      </View>
                    </View>
                    <Pressable
                      onPress={handleSendOtp}
                      disabled={otpSending || otpCooldown > 0}
                      style={[styles.otpButton, otpCooldown > 0 && styles.otpButtonDisabled]}
                    >
                      {otpSending ? (
                        <ActivityIndicator color="#4F46E5" />
                      ) : (
                        <Text style={styles.otpButtonText}>
                          {otpCooldown > 0 ? `Resend ${otpCooldown}s` : "Send OTP"}
                        </Text>
                      )}
                    </Pressable>
                  </View>
                  <Text style={[styles.otpHint, { color: theme.colors.subText }]}>
                    We will send the OTP to your Gmail address to verify your account.
                  </Text>
                </View>
              ) : null}

              <Pressable
                onPress={() => void (mode === "signin" ? handleSignIn() : handleSignUp())}
                disabled={loading}
                style={styles.buttonWrap}
              >
                <LinearGradient colors={["#4F46E5", "#7C3AED"]} style={styles.button}>
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>
                      {mode === "signin" ? "Sign In" : "Create Account"} {"\u2192"}
                    </Text>
                  )}
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  wrapper: { flex: 1 },
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
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  card: {
    borderRadius: 30,
    borderWidth: 1.5,
    paddingHorizontal: 18,
    paddingVertical: 20,
    shadowColor: "#4F46E5",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.17,
    shadowRadius: 30,
    elevation: 8,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
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
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.8,
    lineHeight: 33,
  },
  pageSub: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 20,
  },
  toggleWrap: {
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: "row",
    padding: 4,
    gap: 4,
  },
  toggleBtn: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleBtnActive: {
    backgroundColor: "#4F46E5",
  },
  toggleTxt: {
    color: "#64748B",
    fontWeight: "700",
    fontSize: 13,
  },
  toggleTxtActive: {
    color: "#FFFFFF",
  },
  avatarSection: {
    alignItems: "center",
    marginTop: 12,
  },
  avatarButton: {
    width: 74,
    height: 74,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(79,70,229,0.08)",
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "rgba(79,70,229,0.45)",
  },
  avatarImage: {
    width: 68,
    height: 68,
    borderRadius: 18,
  },
  avatarBadge: {
    position: "absolute",
    right: -4,
    bottom: -4,
    width: 22,
    height: 22,
    borderRadius: 8,
    backgroundColor: "#4F46E5",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  form: {
    marginTop: 14,
    gap: 11,
  },
  inputGroup: { gap: 6 },
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 10,
    height: 48,
    gap: 8,
    backgroundColor: "rgba(248,250,255,0.9)",
  },
  input: {
    flex: 1,
    fontSize: 14,
  },
  otpGroup: {
    gap: 6,
  },
  otpRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  otpInput: {
    flex: 1,
  },
  otpButton: {
    height: 48,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "rgba(79,70,229,0.4)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(79,70,229,0.08)",
  },
  otpButtonDisabled: {
    opacity: 0.7,
  },
  otpButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#4F46E5",
  },
  otpHint: {
    fontSize: 11,
    lineHeight: 16,
  },
  buttonWrap: {
    marginTop: 4,
  },
  button: {
    height: 50,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#4F46E5",
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 0.33,
    shadowRadius: 20,
    elevation: 6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});

