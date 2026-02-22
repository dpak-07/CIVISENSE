import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

type LoaderProps = {
  txt?: string;
};

const PETAL_COUNT = 5;
const LINE_1 = "CIVISENSE";
const LINE_2 = "SMART CIVIC INTELLIGENCE";

export default function Loader({ txt = "Initializing CiviSense..." }: LoaderProps) {
  const ringRotation = useSharedValue(0);
  const pulse = useSharedValue(0);
  const wave = useSharedValue(0);
  const reveal = useSharedValue(0);

  useEffect(() => {
    ringRotation.value = withRepeat(
      withTiming(360, { duration: 2600, easing: Easing.linear }),
      -1,
      false
    );

    pulse.value = withRepeat(
      withTiming(1, { duration: 950, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );

    wave.value = withRepeat(
      withTiming(Math.PI * 2, { duration: 1900, easing: Easing.linear }),
      -1,
      false
    );

    reveal.value = withTiming(1, { duration: 1050, easing: Easing.out(Easing.cubic) });
  }, [pulse, reveal, ringRotation, wave]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${ringRotation.value}deg` }],
  }));

  const coreStyle = useAnimatedStyle(() => {
    const scale = interpolate(pulse.value, [0, 1], [0.92, 1.08]);
    const opacity = interpolate(pulse.value, [0, 1], [0.45, 0.9]);
    return {
      transform: [{ scale }],
      opacity,
    };
  });

  return (
    <LinearGradient colors={["#030818", "#0c1e46", "#0d2b5f"]} style={styles.container}>
      <View style={styles.loaderFrame}>
        <Animated.View style={[styles.outerRing, ringStyle]} />

        <View style={styles.petalField}>
          {Array.from({ length: PETAL_COUNT }).map((_, index) => (
            <Petal key={index} index={index} wave={wave} />
          ))}
        </View>

        <Animated.View style={[styles.coreGlow, coreStyle]} />
        <View style={styles.coreDot} />
      </View>

      <View style={styles.brandWrap}>
        <AnimatedLine text={LINE_1} reveal={reveal} color="#67e8f9" size={25} delayFactor={0.05} />
        <AnimatedLine text={LINE_2} reveal={reveal} color="#dbeafe" size={12.5} delayFactor={0.032} />
        <AnimatedLine text={txt} reveal={reveal} color="#fdba74" size={13} delayFactor={0.02} />
      </View>
    </LinearGradient>
  );
}

type PetalProps = {
  index: number;
  wave: Animated.SharedValue<number>;
};

function Petal({ index, wave }: PetalProps) {
  const style = useAnimatedStyle(() => {
    const phase = wave.value + index * 0.8;
    const phaseNorm = (Math.sin(phase) + 1) / 2;
    const scale = 0.72 + phaseNorm * 0.34;
    const opacity = 0.45 + phaseNorm * 0.55;

    return {
      opacity,
      transform: [
        { rotate: `${index * (360 / PETAL_COUNT)}deg` },
        { translateY: -36 },
        { scaleY: scale },
      ],
    };
  });

  return <Animated.View style={[styles.petal, style]} />;
}

type AnimatedLineProps = {
  text: string;
  reveal: Animated.SharedValue<number>;
  color: string;
  size: number;
  delayFactor: number;
};

function AnimatedLine({ text, reveal, color, size, delayFactor }: AnimatedLineProps) {
  return (
    <View style={styles.lineRow}>
      {text.split("").map((char, index) => (
        <AnimatedGlyph
          key={`${char}-${index}`}
          char={char}
          index={index}
          reveal={reveal}
          color={color}
          size={size}
          delayFactor={delayFactor}
        />
      ))}
    </View>
  );
}

type AnimatedGlyphProps = {
  char: string;
  index: number;
  reveal: Animated.SharedValue<number>;
  color: string;
  size: number;
  delayFactor: number;
};

function AnimatedGlyph({ char, index, reveal, color, size, delayFactor }: AnimatedGlyphProps) {
  const style = useAnimatedStyle(() => {
    const start = index * delayFactor;
    const travel = Math.max(0.0001, 1 - start);
    const raw = (reveal.value - start) / travel;
    const t = Math.max(0, Math.min(1, raw));

    return {
      opacity: t,
      transform: [{ translateY: interpolate(t, [0, 1], [16, 0]) }],
    };
  });

  return (
    <Animated.Text style={[styles.letter, style, { color, fontSize: size }]}>
      {char === " " ? "\u00A0" : char}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  loaderFrame: {
    width: 140,
    height: 140,
    justifyContent: "center",
    alignItems: "center",
  },
  outerRing: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "rgba(56,189,248,0.45)",
    borderTopColor: "#67e8f9",
    borderRightColor: "#22d3ee",
  },
  petalField: {
    width: 110,
    height: 110,
    justifyContent: "center",
    alignItems: "center",
  },
  petal: {
    position: "absolute",
    width: 20,
    height: 42,
    borderRadius: 999,
    backgroundColor: "#fb923c",
    borderWidth: 1,
    borderColor: "rgba(251,146,60,0.6)",
  },
  coreGlow: {
    position: "absolute",
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: "rgba(34,211,238,0.55)",
  },
  coreDot: {
    width: 16,
    height: 16,
    borderRadius: 999,
    backgroundColor: "#e2e8f0",
  },
  brandWrap: {
    marginTop: 18,
    alignItems: "center",
    gap: 3,
  },
  lineRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
  },
  letter: {
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
