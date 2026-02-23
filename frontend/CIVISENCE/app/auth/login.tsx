import React, { useEffect, useRef, useState } from "react";
import {
  Animated as RNAnimated,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getApiErrorMessage } from "@/lib/api";
import { useAppPreferences } from "@/lib/appPreferencesContext";
import { safeBack } from "@/lib/navigation";
import { loginUser } from "@/lib/services/auth";
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

export default function Login() {
  const insets = useSafeAreaInsets();
  const { preferences, theme, t } = useAppPreferences();
  const isDark = preferences.darkMode;
  const params = useLocalSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
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

      const returnTo = typeof params?.returnTo === "string" ? params.returnTo : "/";
      router.replace(returnTo as never);
    } catch (error) {
      Alert.alert("Login failed", getApiErrorMessage(error));
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
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + 10, paddingBottom: Math.max(insets.bottom, 16) + 14 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View
            entering={FadeInDown.duration(450)}
            style={[
              styles.card,
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

            <Text style={[styles.pageTitle, { color: theme.colors.text }]}>Welcome Back</Text>
            <Text style={[styles.pageSub, { color: theme.colors.subText }]}>
              Sign in to continue reporting issues in your city.
            </Text>

            <Animated.View entering={FadeInUp.duration(520).delay(80)} style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.colors.subText }]}>{t("auth.emailAddress")}</Text>
                <View
                  style={[
                    styles.inputWrap,
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
                    {
                      backgroundColor: isDark ? "rgba(15,23,42,0.72)" : "#F8FAFF",
                      borderColor: isDark ? "rgba(148,163,184,0.28)" : "#E2E8F0",
                    },
                  ]}
                >
                  <Ionicons name="lock-closed-outline" size={18} color="#64748B" />
                  <TextInput
                    style={[styles.input, { color: theme.colors.text }]}
                    placeholder="Enter your password"
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
              </View>

              <Pressable style={styles.forgotRow}>
                <Text style={styles.forgotPassword}>{t("auth.forgotPassword")}</Text>
              </Pressable>

              <Pressable onPress={handleLogin} disabled={loading} style={styles.buttonWrap}>
                <LinearGradient colors={["#4F46E5", "#7C3AED"]} style={styles.button}>
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.buttonText}>{t("auth.signIn")}  {"\u2192"}</Text>
                  )}
                </LinearGradient>
              </Pressable>

              <View style={styles.footerLink}>
                <Text style={[styles.footerText, { color: theme.colors.subText }]}>
                  {t("auth.dontHaveAccount")}{" "}
                </Text>
                <Pressable onPress={() => router.push({ pathname: "/auth", params: { mode: "signup" } })}>
                  <Text style={styles.footerAction}>{t("auth.signUp")}</Text>
                </Pressable>
              </View>
            </Animated.View>
          </Animated.View>
        </ScrollView>
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
  pageSub: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 20,
  },
  form: {
    marginTop: 22,
    gap: 14,
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
  input: {
    flex: 1,
    fontSize: 14,
  },
  forgotRow: {
    alignItems: "flex-end",
    marginTop: -2,
  },
  forgotPassword: {
    color: "#6D5EF8",
    fontWeight: "600",
    fontSize: 12,
  },
  buttonWrap: {
    marginTop: 8,
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
  buttonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  footerLink: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 8,
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
