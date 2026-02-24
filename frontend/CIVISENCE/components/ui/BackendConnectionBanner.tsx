import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { BackendHealthStatus } from "@/lib/services/backendHealth";

type BackendConnectionBannerProps = {
  status: BackendHealthStatus;
  topInset: number;
  isDarkMode: boolean;
  onlineLabel: string;
  offlineLabel: string;
  checkingLabel: string;
};

type BannerPalette = {
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  dotColor: string;
};

const getPalette = (status: BackendHealthStatus, isDarkMode: boolean): BannerPalette => {
  if (status === "online") {
    return isDarkMode
      ? {
          backgroundColor: "#052E16",
          borderColor: "#166534",
          textColor: "#BBF7D0",
          dotColor: "#22C55E",
        }
      : {
          backgroundColor: "#DCFCE7",
          borderColor: "#86EFAC",
          textColor: "#166534",
          dotColor: "#16A34A",
        };
  }

  if (status === "offline") {
    return isDarkMode
      ? {
          backgroundColor: "#450A0A",
          borderColor: "#7F1D1D",
          textColor: "#FECACA",
          dotColor: "#F87171",
        }
      : {
          backgroundColor: "#FEE2E2",
          borderColor: "#FCA5A5",
          textColor: "#991B1B",
          dotColor: "#DC2626",
        };
  }

  return isDarkMode
    ? {
        backgroundColor: "#111827",
        borderColor: "#334155",
        textColor: "#CBD5E1",
        dotColor: "#94A3B8",
      }
    : {
        backgroundColor: "#E2E8F0",
        borderColor: "#CBD5E1",
        textColor: "#334155",
        dotColor: "#64748B",
      };
};

export default function BackendConnectionBanner({
  status,
  topInset,
  isDarkMode,
  onlineLabel,
  offlineLabel,
  checkingLabel,
}: BackendConnectionBannerProps) {
  const label = useMemo(() => {
    if (status === "online") {
      return onlineLabel;
    }
    if (status === "offline") {
      return offlineLabel;
    }
    return checkingLabel;
  }, [checkingLabel, offlineLabel, onlineLabel, status]);

  const palette = useMemo(
    () => getPalette(status, isDarkMode),
    [isDarkMode, status]
  );

  return (
    <View
      style={[
        styles.container,
        {
          marginTop: Math.max(topInset, 6),
          backgroundColor: palette.backgroundColor,
          borderColor: palette.borderColor,
        },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: palette.dotColor }]} />
      <Text style={[styles.label, { color: palette.textColor }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: "flex-end",
    marginRight: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 8,
    shadowColor: "#000000",
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    elevation: 3,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
});
