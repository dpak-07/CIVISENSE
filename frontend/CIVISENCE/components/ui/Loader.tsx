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
  const pulse = useSharedValue(0);
  const sweep = useSharedValue(0);
  const route = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
    sweep.value = withRepeat(
      withTiming(1, { duration: 1650, easing: Easing.inOut(Easing.cubic) }),
      -1,
      false
    );
    route.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [pulse, route, sweep]);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(pulse.value, [0, 1], [2, -4]) },
      { scale: interpolate(pulse.value, [0, 1], [0.98, 1.02]) },
    ],
  }));

  const beaconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.16, 0.42]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [0.9, 1.18]) }],
  }));

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(sweep.value, [0, 1], [-56, 218]) }],
  }));

  const routeDotStyle = useAnimatedStyle(() => ({
    left: interpolate(route.value, [0, 0.34, 0.68, 1], [22, 88, 146, 202]),
    top: interpolate(route.value, [0, 0.34, 0.68, 1], [30, 62, 34, 60]),
  }));

  const blockStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.54, 1]),
  }));

  return (
    <LinearGradient colors={["#F8FBFF", "#EAF3F6", "#FFF8F0"]} style={styles.container}>
      <View style={styles.cityGrid} pointerEvents="none">
        <View style={[styles.road, styles.roadA]} />
        <View style={[styles.road, styles.roadB]} />
        <View style={[styles.road, styles.roadC]} />
        <Animated.View style={[styles.cityBlock, styles.blockA, blockStyle]} />
        <Animated.View style={[styles.cityBlock, styles.blockB, blockStyle]} />
        <Animated.View style={[styles.cityBlock, styles.blockC, blockStyle]} />
        <Animated.View style={[styles.cityBlock, styles.blockD, blockStyle]} />
        <View style={styles.routeLine} />
        <Animated.View style={[styles.routeDot, routeDotStyle]} />
      </View>

      <View style={styles.brandStage}>
        <Animated.View style={[styles.beacon, beaconStyle]} />
        <Animated.View style={[styles.logoPlate, logoStyle]}>
          <CiviSenseLogo size={92} />
        </Animated.View>
      </View>

      <Text style={styles.brandTitle}>CiviSense</Text>
      <Text style={styles.brandTag}>Making cities better</Text>
      <Text style={styles.caption}>{txt}</Text>

      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressSweep, sweepStyle]} />
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
  cityGrid: {
    position: "absolute",
    width: 252,
    height: 104,
    bottom: 78,
    opacity: 0.9,
  },
  road: {
    position: "absolute",
    backgroundColor: "rgba(15,23,42,0.08)",
    borderRadius: 999,
  },
  roadA: {
    left: 12,
    right: 12,
    top: 52,
    height: 5,
  },
  roadB: {
    left: 74,
    top: 14,
    width: 5,
    height: 78,
  },
  roadC: {
    right: 46,
    top: 10,
    width: 5,
    height: 82,
  },
  cityBlock: {
    position: "absolute",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.08)",
  },
  blockA: {
    left: 18,
    top: 18,
    width: 42,
    height: 24,
  },
  blockB: {
    left: 94,
    top: 18,
    width: 40,
    height: 26,
  },
  blockC: {
    right: 18,
    top: 28,
    width: 44,
    height: 22,
  },
  blockD: {
    left: 112,
    bottom: 12,
    width: 58,
    height: 24,
  },
  routeLine: {
    position: "absolute",
    left: 22,
    right: 42,
    top: 60,
    height: 3,
    borderRadius: 999,
    backgroundColor: "#2AA876",
    opacity: 0.34,
  },
  routeDot: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#FF8A3D",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  brandStage: {
    width: 190,
    height: 174,
    justifyContent: "center",
    alignItems: "center",
  },
  beacon: {
    position: "absolute",
    width: 136,
    height: 136,
    borderRadius: 999,
    backgroundColor: "#2AA876",
  },
  logoPlate: {
    width: 124,
    height: 124,
    borderRadius: 30,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1D3557",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 8,
  },
  brandTitle: {
    color: "#12263A",
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: 0,
  },
  brandTag: {
    marginTop: 5,
    color: "#2AA876",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0,
  },
  caption: {
    marginTop: 18,
    color: "#52657A",
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    letterSpacing: 0,
  },
  progressTrack: {
    marginTop: 16,
    width: 218,
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(18,38,58,0.1)",
    overflow: "hidden",
  },
  progressSweep: {
    width: 56,
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#2AA876",
  },
});

