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
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getApiErrorMessage } from "@/lib/api";
import { useAppPreferences } from "@/lib/appPreferencesContext";
import { loginUser } from "@/lib/services/auth";

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
      colors={isDark ? ["#0B1220", "#111C31"] : ["#F1F6FC", "#E0EAFF"]}
      style={styles.container}
    >
      <StatusBar style={theme.statusBar} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[styles.wrapper, { paddingTop: insets.top + 8 }]}
      >
        <Animated.View entering={FadeInDown.duration(600)} style={styles.header}>
          <Ionicons name="arrow-back" size={28} color={theme.colors.text} onPress={() => router.back()} />
          <Text style={[styles.title, { color: theme.colors.text }]}>{t("auth.welcomeBack")}</Text>
        </Animated.View>

        <Animated.View
          entering={FadeInUp.delay(100).duration(700)}
          style={styles.form}
        >
          {/* Email Input */}
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

          {/* Password Input */}
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
                placeholder="Enter your password"
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

          {/* Forgot Password */}
          <Pressable>
            <Text style={styles.forgotPassword}>{t("auth.forgotPassword")}</Text>
          </Pressable>

          {/* Login Button */}
          <LinearGradient
            colors={["#2563EB", "#1d4ed8"]}
            style={styles.button}
          >
            <Pressable onPress={handleLogin} disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>{t("auth.signIn")}</Text>
              )}
            </Pressable>
          </LinearGradient>

          {/* Register Link */}
          <View style={styles.registerLink}>
            <Text style={[styles.registerText, { color: theme.colors.subText }]}>
              {t("auth.dontHaveAccount")}{" "}
            </Text>
            <Pressable onPress={() => router.push("/auth/register")}>
              <Text style={styles.registerLink2}>{t("auth.signUp")}</Text>
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
  forgotPassword: {
    color: "#2563EB",
    fontWeight: "600",
    textAlign: "right",
    marginTop: 4,
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
