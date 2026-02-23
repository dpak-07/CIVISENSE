import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import CiviSenseLogo from "@/components/branding/CiviSenseLogo";

type LoaderProps = {
  txt?: string;
};

export default function Loader({ txt = "Loading CiviSense..." }: LoaderProps) {
  const ringSpin = useSharedValue(0);
  const breathe = useSharedValue(0);
  const progress = useSharedValue(0);
  const drift = useSharedValue(0);

  useEffect(() => {
    ringSpin.value = withRepeat(
      withTiming(360, { duration: 4500, easing: Easing.linear }),
      -1,
      false
    );
    breathe.value = withRepeat(
      withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
    progress.value = withRepeat(
      withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.cubic) }),
      -1,
      false
    );
    drift.value = withRepeat(
      withTiming(1, { duration: 5200, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [breathe, drift, progress, ringSpin]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${ringSpin.value}deg` }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(breathe.value, [0, 1], [0.9, 1.12]) }],
    opacity: interpolate(breathe.value, [0, 1], [0.2, 0.46]),
  }));

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(breathe.value, [0, 1], [1, -3]) },
      { scale: interpolate(breathe.value, [0, 1], [0.985, 1.02]) },
    ],
  }));

  const tickerStyle = useAnimatedStyle(() => ({
    width: interpolate(progress.value, [0, 0.5, 1], [28, 184, 64]),
  }));

  const orbAStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(drift.value, [0, 1], [-12, 14]) },
      { translateY: interpolate(drift.value, [0, 1], [8, -6]) },
    ],
  }));

  const orbBStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(drift.value, [0, 1], [16, -12]) },
      { translateY: interpolate(drift.value, [0, 1], [-10, 10]) },
    ],
  }));

  return (
    <LinearGradient colors={["#070D1E", "#101D39", "#132B51"]} style={styles.container}>
      <Animated.View style={[styles.orb, styles.orbA, orbAStyle]} />
      <Animated.View style={[styles.orb, styles.orbB, orbBStyle]} />

      <View style={styles.logoStage}>
        <Animated.View style={[styles.logoGlow, glowStyle]} />
        <Animated.View style={[styles.ringOuter, ringStyle]} />
        <Animated.View style={[styles.logoCard, cardStyle]}>
          <LinearGradient colors={["#0F2A49", "#123861"]} style={styles.logoCardFill}>
            <CiviSenseLogo size={88} />
          </LinearGradient>
        </Animated.View>
      </View>

      <Text style={styles.brandTitle}>CiviSense</Text>
      <Text style={styles.brandTag}>Making Cities Better</Text>
      <Text style={styles.caption}>{txt}</Text>

      <View style={styles.tickerTrack}>
        <Animated.View style={[styles.tickerFill, tickerStyle]} />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    paddingHorizontal: 24,
  },
  orb: {
    position: "absolute",
    borderRadius: 999,
    opacity: 0.16,
  },
  orbA: {
    width: 300,
    height: 300,
    top: 40,
    left: -110,
    backgroundColor: "#4F46E5",
  },
  orbB: {
    width: 260,
    height: 260,
    bottom: 40,
    right: -110,
    backgroundColor: "#7C3AED",
  },
  logoStage: {
    width: 210,
    height: 210,
    justifyContent: "center",
    alignItems: "center",
  },
  logoGlow: {
    position: "absolute",
    width: 146,
    height: 146,
    borderRadius: 999,
    backgroundColor: "#7DD3FC",
  },
  ringOuter: {
    position: "absolute",
    width: 186,
    height: 186,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "rgba(141,235,247,0.35)",
    borderTopColor: "rgba(255,255,255,0.9)",
    borderRightColor: "rgba(255,255,255,0.8)",
    borderStyle: "dashed",
  },
  logoCard: {
    width: 124,
    height: 124,
    borderRadius: 28,
    overflow: "hidden",
    shadowColor: "#5EEAD4",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  logoCardFill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  brandTitle: {
    marginTop: 8,
    color: "#F8FAFC",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  brandTag: {
    marginTop: 3,
    color: "#C7D2FE",
    fontSize: 12.5,
    fontWeight: "600",
  },
  caption: {
    marginTop: 16,
    color: "#F9A8D4",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  tickerTrack: {
    marginTop: 16,
    width: 184,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(196,225,255,0.25)",
    overflow: "hidden",
  },
  tickerFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#8DEBF7",
  },
});

