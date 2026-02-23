import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  SharedValue,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

type LoaderProps = {
  txt?: string;
};

type NodePoint = {
  x: number;
  y: number;
  phase: number;
};

const TITLE = "CIVISENCE";
const SUBTITLE = "CIVIC GRID ONLINE";
const RADAR_NODES: NodePoint[] = [
  { x: -78, y: -44, phase: 0 },
  { x: -16, y: -82, phase: 0.7 },
  { x: 68, y: -52, phase: 1.4 },
  { x: 82, y: 18, phase: 2.1 },
  { x: 22, y: 82, phase: 2.8 },
  { x: -66, y: 64, phase: 3.5 },
];

export default function Loader({ txt = "Syncing civic intelligence..." }: LoaderProps) {
  const sweep = useSharedValue(0);
  const pulse = useSharedValue(0);
  const route = useSharedValue(0);
  const reveal = useSharedValue(0);
  const float = useSharedValue(0);
  const ticker = useSharedValue(0);

  useEffect(() => {
    sweep.value = withRepeat(
      withTiming(360, { duration: 3200, easing: Easing.linear }),
      -1,
      false
    );
    route.value = withRepeat(
      withTiming(1, { duration: 2600, easing: Easing.linear }),
      -1,
      false
    );
    pulse.value = withRepeat(
      withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
      -1,
      true
    );
    float.value = withRepeat(
      withTiming(Math.PI * 2, { duration: 4600, easing: Easing.inOut(Easing.ease) }),
      -1,
      false
    );
    ticker.value = withRepeat(
      withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.cubic) }),
      -1,
      false
    );
    reveal.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [float, pulse, reveal, route, sweep, ticker]);

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${sweep.value}deg` }],
  }));

  const orbitStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-sweep.value * 0.22}deg` }],
  }));

  const carrierStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(route.value, [0, 0.25, 0.5, 0.75, 1], [-68, 68, 68, -68, -68]),
      },
      {
        translateY: interpolate(route.value, [0, 0.25, 0.5, 0.75, 1], [-68, -68, 68, 68, -68]),
      },
    ],
    opacity: interpolate(route.value, [0, 0.05, 0.95, 1], [0.4, 1, 1, 0.4]),
  }));

  const centerGlowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pulse.value, [0, 1], [0.92, 1.16]) }],
    opacity: interpolate(pulse.value, [0, 1], [0.22, 0.58]),
  }));

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: Math.sin(float.value) * 4 },
      { rotate: `${Math.sin(float.value * 0.75) * 1.2}deg` },
      { scale: interpolate(pulse.value, [0, 1], [0.98, 1.02]) },
    ],
  }));

  const auraAStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: Math.sin(float.value * 0.8) * 18 },
      { translateY: Math.cos(float.value * 0.8) * 12 },
    ],
    opacity: interpolate(pulse.value, [0, 1], [0.14, 0.26]),
  }));

  const auraBStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: Math.cos(float.value) * 14 },
      { translateY: Math.sin(float.value) * 16 },
    ],
    opacity: interpolate(pulse.value, [0, 1], [0.1, 0.2]),
  }));

  const tickerStyle = useAnimatedStyle(() => ({
    width: interpolate(ticker.value, [0, 1], [24, 230]),
  }));

  return (
    <LinearGradient colors={["#040A18", "#0A1E39", "#0F3155"]} style={styles.container}>
      <Animated.View style={[styles.aura, styles.auraA, auraAStyle]} />
      <Animated.View style={[styles.aura, styles.auraB, auraBStyle]} />
      <GridBackdrop />

      <View style={styles.radarStage}>
        <Animated.View style={[styles.radarRing, styles.radarRingOuter, orbitStyle]} />
        <View style={styles.radarRing} />
        <View style={styles.radarRingSmall} />

        <Animated.View style={[styles.sweepPivot, sweepStyle]}>
          <View style={styles.sweepArm} />
        </Animated.View>
        <Animated.View style={[styles.centerGlow, centerGlowStyle]} />

        {RADAR_NODES.map((node, index) => (
          <SignalNode key={index} x={node.x} y={node.y} phase={node.phase} pulse={pulse} />
        ))}

        <View pointerEvents="none" style={styles.routeTrack}>
          <Animated.View style={[styles.routeCarrier, carrierStyle]} />
        </View>

        <Animated.View style={[styles.centerCard, cardStyle]}>
          <LinearGradient colors={["#13385D", "#0D2747"]} style={styles.centerCardFill}>
            <View style={styles.logoC} />

            <View style={styles.logoPin}>
              <View style={styles.logoPinTop} />
              <View style={styles.logoPinTail} />
            </View>

            <View style={styles.logoBars}>
              <View style={[styles.logoBar, styles.logoBarS]} />
              <View style={[styles.logoBar, styles.logoBarL]} />
              <View style={[styles.logoBar, styles.logoBarM]} />
            </View>
          </LinearGradient>
        </Animated.View>
      </View>

      <View style={styles.brandWrap}>
        <GlyphLine text={TITLE} reveal={reveal} size={26} color="#8DEBF7" delay={0.05} />
        <GlyphLine text={SUBTITLE} reveal={reveal} size={12} color="#DCEEFF" delay={0.03} />
        <GlyphLine text={txt} reveal={reveal} size={13} color="#FDBA74" delay={0.024} />
        <View style={styles.tickerTrack}>
          <Animated.View style={[styles.tickerFill, tickerStyle]} />
        </View>
      </View>
    </LinearGradient>
  );
}

function GridBackdrop() {
  return (
    <View pointerEvents="none" style={styles.gridContainer}>
      {Array.from({ length: 5 }).map((_, index) => (
        <View key={`h-${index}`} style={[styles.gridLine, { top: 120 + index * 76 }]} />
      ))}
      {Array.from({ length: 4 }).map((_, index) => (
        <View
          key={`v-${index}`}
          style={[
            styles.gridLine,
            styles.gridVertical,
            { left: 64 + index * 92, top: 80, height: "80%" },
          ]}
        />
      ))}
    </View>
  );
}

type SignalNodeProps = {
  x: number;
  y: number;
  phase: number;
  pulse: SharedValue<number>;
};

function SignalNode({ x, y, phase, pulse }: SignalNodeProps) {
  const nodeStyle = useAnimatedStyle(() => {
    const wave = (Math.sin(pulse.value * Math.PI * 2 + phase) + 1) / 2;
    return {
      opacity: 0.42 + wave * 0.58,
      transform: [{ scale: 0.9 + wave * 0.35 }],
    };
  });

  return <Animated.View style={[styles.signalNode, { left: 110 + x, top: 110 + y }, nodeStyle]} />;
}

type GlyphLineProps = {
  text: string;
  reveal: SharedValue<number>;
  size: number;
  color: string;
  delay: number;
};

function GlyphLine({ text, reveal, size, color, delay }: GlyphLineProps) {
  return (
    <View style={styles.glyphLine}>
      {text.split("").map((char, index) => (
        <Glyph
          key={`${char}-${index}`}
          char={char}
          index={index}
          reveal={reveal}
          size={size}
          color={color}
          delay={delay}
        />
      ))}
    </View>
  );
}

type GlyphProps = {
  char: string;
  index: number;
  reveal: SharedValue<number>;
  size: number;
  color: string;
  delay: number;
};

function Glyph({ char, index, reveal, size, color, delay }: GlyphProps) {
  const glyphStyle = useAnimatedStyle(() => {
    const start = index * delay;
    const travel = Math.max(0.0001, 1 - start);
    const raw = (reveal.value - start) / travel;
    const t = Math.max(0, Math.min(1, raw));

    return {
      opacity: t,
      transform: [{ translateY: interpolate(t, [0, 1], [12, 0]) }],
    };
  });

  return (
    <Animated.Text style={[styles.glyph, glyphStyle, { fontSize: size, color }]}>
      {char === " " ? "\u00A0" : char}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  aura: {
    position: "absolute",
    borderRadius: 999,
  },
  auraA: {
    width: 340,
    height: 340,
    top: 40,
    left: -130,
    backgroundColor: "#00BFA5",
  },
  auraB: {
    width: 320,
    height: 320,
    bottom: 50,
    right: -140,
    backgroundColor: "#F59E0B",
  },
  gridContainer: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.13,
  },
  gridLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "#8AB9DE",
  },
  gridVertical: {
    width: 1,
    height: "100%",
  },
  radarStage: {
    width: 220,
    height: 220,
    justifyContent: "center",
    alignItems: "center",
  },
  radarRing: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 999,
    borderWidth: 1.6,
    borderColor: "rgba(131,193,240,0.34)",
  },
  radarRingOuter: {
    width: 208,
    height: 208,
    borderColor: "rgba(131,193,240,0.24)",
    borderStyle: "dashed",
  },
  radarRingSmall: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 999,
    borderWidth: 1.4,
    borderColor: "rgba(146,228,248,0.34)",
  },
  sweepArm: {
    width: 4,
    height: 106,
    borderRadius: 999,
    backgroundColor: "rgba(162,240,255,0.6)",
  },
  sweepPivot: {
    position: "absolute",
    width: 220,
    height: 220,
    justifyContent: "flex-start",
    alignItems: "center",
    paddingTop: 2,
  },
  centerGlow: {
    position: "absolute",
    width: 112,
    height: 112,
    borderRadius: 999,
    backgroundColor: "#53CEE1",
  },
  signalNode: {
    position: "absolute",
    width: 11,
    height: 11,
    borderRadius: 999,
    backgroundColor: "#A2F0FF",
    shadowColor: "#A2F0FF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 5,
    elevation: 4,
  },
  routeTrack: {
    position: "absolute",
    width: 170,
    height: 170,
    borderRadius: 20,
    borderWidth: 1.2,
    borderColor: "rgba(141,235,247,0.28)",
  },
  routeCarrier: {
    position: "absolute",
    left: 79,
    top: 79,
    width: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: "#FDBA74",
    shadowColor: "#FDBA74",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 5,
  },
  centerCard: {
    width: 118,
    height: 118,
    borderRadius: 28,
    overflow: "hidden",
    shadowColor: "#36D2CC",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 9,
  },
  centerCardFill: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  logoC: {
    position: "absolute",
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 9,
    borderColor: "#2DD4BF",
    borderRightColor: "transparent",
    transform: [{ rotate: "-22deg" }],
  },
  logoPin: {
    position: "absolute",
    top: 25,
    alignItems: "center",
  },
  logoPinTop: {
    width: 20,
    height: 20,
    borderRadius: 999,
    backgroundColor: "#8DEBF7",
  },
  logoPinTail: {
    width: 12,
    height: 12,
    backgroundColor: "#8DEBF7",
    marginTop: -3,
    transform: [{ rotate: "45deg" }],
    borderBottomLeftRadius: 3,
  },
  logoBars: {
    position: "absolute",
    bottom: 23,
    flexDirection: "row",
    alignItems: "flex-end",
  },
  logoBar: {
    width: 7,
    marginHorizontal: 2.5,
    borderRadius: 4,
    backgroundColor: "#FDBA74",
  },
  logoBarS: {
    height: 16,
  },
  logoBarL: {
    height: 27,
  },
  logoBarM: {
    height: 21,
  },
  brandWrap: {
    marginTop: 26,
    width: "100%",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  glyphLine: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  glyph: {
    fontWeight: "700",
    letterSpacing: 0.35,
  },
  tickerTrack: {
    width: 230,
    height: 5,
    borderRadius: 999,
    marginTop: 14,
    backgroundColor: "rgba(149,210,245,0.23)",
    overflow: "hidden",
  },
  tickerFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#8DEBF7",
  },
});
