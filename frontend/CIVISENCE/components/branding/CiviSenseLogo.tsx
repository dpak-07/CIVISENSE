import React from "react";
import { StyleProp, View, ViewStyle } from "react-native";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from "react-native-svg";

type CiviSenseLogoProps = {
  size?: number;
  style?: StyleProp<ViewStyle>;
};

export default function CiviSenseLogo({ size = 80, style }: CiviSenseLogoProps) {
  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 80 80" fill="none">
        <Defs>
          <LinearGradient id="logoBg" x1="0" y1="0" x2="80" y2="80" gradientUnits="userSpaceOnUse">
            <Stop offset="0%" stopColor="#4F46E5" />
            <Stop offset="100%" stopColor="#7C3AED" />
          </LinearGradient>
          <LinearGradient id="pinBg" x1="0" y1="0" x2="80" y2="80" gradientUnits="userSpaceOnUse">
            <Stop offset="0%" stopColor="#818CF8" />
            <Stop offset="100%" stopColor="#A78BFA" />
          </LinearGradient>
        </Defs>

        <Rect width="80" height="80" rx="22" fill="url(#logoBg)" />

        <Rect x="10" y="38" width="12" height="26" rx="3" fill="rgba(255,255,255,0.25)" />
        <Rect x="24" y="28" width="14" height="36" rx="3" fill="rgba(255,255,255,0.35)" />
        <Rect x="40" y="22" width="16" height="42" rx="3" fill="#FFFFFF" />
        <Rect x="58" y="32" width="12" height="32" rx="3" fill="rgba(255,255,255,0.3)" />

        <Circle cx="48" cy="19" r="9" fill="url(#pinBg)" opacity="0.95" />
        <Circle cx="48" cy="17" r="3.5" fill="#FFFFFF" />
        <Path d="M48 24L44 30" stroke="url(#pinBg)" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
        <Circle cx="48" cy="17" r="6" stroke="#FFFFFF" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.5" />

        <Rect x="8" y="62" width="64" height="2.5" rx="1.25" fill="rgba(255,255,255,0.2)" />
      </Svg>
    </View>
  );
}

