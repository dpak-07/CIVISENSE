import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Alert,
  Image,
  Linking,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { router } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getApiErrorMessage } from "@/lib/api";
import { safeBack } from "@/lib/navigation";
import { sessionStore } from "@/lib/session";
import { ComplaintRecord, getComplaints } from "@/lib/services/complaints";
import {
  MunicipalOffice,
  getMunicipalOffices,
} from "@/lib/services/municipalOffices";

type LatLng = { latitude: number; longitude: number };
type MapRegion = LatLng & { latitudeDelta: number; longitudeDelta: number };
type PriorityLevel = "high" | "medium" | "low" | "all";
type ComplaintStatusFilter = "all" | "open" | "resolved" | "rejected";

type MapItem = {
  id: string;
  type: "complaint" | "office";
  title: string;
  subtitle: string;
  latitude: number;
  longitude: number;
  status?: string;
  priority?: string;
  category?: string;
  mapLink?: string | null;
  googleMapsLink?: string | null;
  googleMapsDirectionsLink?: string | null;
};

const DEFAULT_REGION: MapRegion = {
  latitude: 20,
  longitude: 0,
  latitudeDelta: 60,
  longitudeDelta: 60,
};

const OSM_TILE_SIZE = 256;
const OSM_ATTRIBUTION = "© OpenStreetMap contributors";
const OSM_LINK = "https://www.openstreetmap.org";

const priorityColor = (level?: string) => {
  if (level === "high") return "#ef4444";
  if (level === "medium") return "#f59e0b";
  return "#10b981";
};

const statusColor = (status?: string) => {
  if (status === "resolved") return "#10b981";
  if (status === "in_progress") return "#f59e0b";
  if (status === "assigned") return "#2563eb";
  if (status === "rejected") return "#ef4444";
  return "#64748b";
};

const formatStatusLabel = (status?: string) =>
  status ? status.replace("_", " ") : "reported";

const toLatLng = (coords?: [number, number]): LatLng | null => {
  if (!coords || coords.length !== 2) {
    return null;
  }
  const [longitude, latitude] = coords;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  return { latitude, longitude };
};

const buildRegionFromPoints = (
  points: LatLng[],
  fallback?: LatLng
): MapRegion => {
  if (points.length === 0) {
    if (fallback) {
      return {
        latitude: fallback.latitude,
        longitude: fallback.longitude,
        latitudeDelta: 0.35,
        longitudeDelta: 0.35,
      };
    }
    return DEFAULT_REGION;
  }

  let minLat = points[0].latitude;
  let maxLat = points[0].latitude;
  let minLng = points[0].longitude;
  let maxLng = points[0].longitude;

  points.forEach((point) => {
    minLat = Math.min(minLat, point.latitude);
    maxLat = Math.max(maxLat, point.latitude);
    minLng = Math.min(minLng, point.longitude);
    maxLng = Math.max(maxLng, point.longitude);
  });

  const latitude = (minLat + maxLat) / 2;
  const longitude = (minLng + maxLng) / 2;
  const latitudeDelta = Math.max(0.02, (maxLat - minLat) * 1.8);
  const longitudeDelta = Math.max(0.02, (maxLng - minLng) * 1.8);

  return { latitude, longitude, latitudeDelta, longitudeDelta };
};

const buildGoogleMapsDirectionsUrl = (lat: number, lng: number) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;

const openDirections = (item: MapItem) => {
  const url =
    item.googleMapsDirectionsLink ||
    item.googleMapsLink ||
    item.mapLink ||
    buildGoogleMapsDirectionsUrl(item.latitude, item.longitude);
  Linking.openURL(url).catch(() => undefined);
};

const longitudeToTileX = (longitude: number, zoom: number) =>
  ((longitude + 180) / 360) * 2 ** zoom;

const latitudeToTileY = (latitude: number, zoom: number) => {
  const latRad = (latitude * Math.PI) / 180;
  return (
    ((1 -
      Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) /
      2) *
    2 ** zoom
  );
};

const getZoomForRegion = (region: MapRegion, width: number) => {
  const safeWidth = Math.max(width, 1);
  const zoom = Math.log2((360 * safeWidth) / (Math.max(region.longitudeDelta, 0.01) * OSM_TILE_SIZE));
  return clamp(Math.round(zoom), 2, 18);
};

const buildTileLayout = (region: MapRegion, width: number, height: number) => {
  const zoom = getZoomForRegion(region, width);
  const centerX = longitudeToTileX(region.longitude, zoom);
  const centerY = latitudeToTileY(region.latitude, zoom);
  const tilesWide = Math.ceil(width / OSM_TILE_SIZE) + 2;
  const tilesHigh = Math.ceil(height / OSM_TILE_SIZE) + 2;
  const startX = Math.floor(centerX - tilesWide / 2);
  const startY = Math.floor(centerY - tilesHigh / 2);
  const centerPixelX = centerX * OSM_TILE_SIZE;
  const centerPixelY = centerY * OSM_TILE_SIZE;
  const tiles: { key: string; url: string; left: number; top: number }[] = [];
  const tileCount = 2 ** zoom;

  for (let x = startX; x < startX + tilesWide; x += 1) {
    for (let y = startY; y < startY + tilesHigh; y += 1) {
      if (y < 0 || y >= tileCount) {
        continue;
      }
      const wrappedX = ((x % tileCount) + tileCount) % tileCount;
      tiles.push({
        key: `${zoom}-${wrappedX}-${y}`,
        url: `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${y}.png`,
        left: x * OSM_TILE_SIZE - centerPixelX + width / 2,
        top: y * OSM_TILE_SIZE - centerPixelY + height / 2,
      });
    }
  }

  return { zoom, tiles };
};

const getMarkerPosition = (
  point: LatLng,
  region: MapRegion,
  zoom: number,
  width: number,
  height: number
) => {
  const centerX = longitudeToTileX(region.longitude, zoom) * OSM_TILE_SIZE;
  const centerY = latitudeToTileY(region.latitude, zoom) * OSM_TILE_SIZE;
  const pointX = longitudeToTileX(point.longitude, zoom) * OSM_TILE_SIZE;
  const pointY = latitudeToTileY(point.latitude, zoom) * OSM_TILE_SIZE;
  return {
    left: pointX - centerX + width / 2,
    top: pointY - centerY + height / 2,
  };
};

const matchesStatus = (status: string | undefined, filter: ComplaintStatusFilter) => {
  if (filter === "all") {
    return true;
  }
  if (filter === "open") {
    return status !== "resolved" && status !== "rejected";
  }
  return status === filter;
};

const clamp = (value: number, min: number, max: number) => {
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

export default function CityMap() {
  const insets = useSafeAreaInsets();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const sheetStartRef = useRef(1);
  const [loading, setLoading] = useState(true);
  const [complaints, setComplaints] = useState<ComplaintRecord[]>([]);
  const [offices, setOffices] = useState<MunicipalOffice[]>([]);
  const [selectedItem, setSelectedItem] = useState<MapItem | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<PriorityLevel>("all");
  const [statusFilter, setStatusFilter] = useState<ComplaintStatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showComplaints, setShowComplaints] = useState(true);
  const [showOffices, setShowOffices] = useState(true);
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [region, setRegion] = useState<MapRegion | null>(null);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const sheetProgress = useRef(new Animated.Value(1)).current;
  const sheetExpandedHeight = Math.min(Math.max(windowHeight * 0.56, 310), 430);
  const sheetCollapsedHeight = 138;
  const sheetTravel = Math.max(1, sheetExpandedHeight - sheetCollapsedHeight);

  const handleSelectItem = useCallback((item: MapItem) => {
    setSelectedItem(item);
    setSheetExpanded(true);
    setRegion({
      latitude: item.latitude,
      longitude: item.longitude,
      latitudeDelta: 0.06,
      longitudeDelta: 0.06,
    });
  }, []);

  useEffect(() => {
    Animated.spring(sheetProgress, {
      toValue: sheetExpanded ? 0 : 1,
      useNativeDriver: true,
      damping: 18,
      stiffness: 170,
      mass: 0.7,
    }).start();
  }, [sheetExpanded, sheetProgress]);

  const sheetPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dy) > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderGrant: () => {
          sheetProgress.stopAnimation((value) => {
            sheetStartRef.current = value;
          });
        },
        onPanResponderMove: (_, gesture) => {
          const next = clamp(sheetStartRef.current + gesture.dy / sheetTravel, 0, 1);
          sheetProgress.setValue(next);
        },
        onPanResponderRelease: (_, gesture) => {
          const projected = clamp(
            sheetStartRef.current + (gesture.dy + gesture.vy * 42) / sheetTravel,
            0,
            1
          );
          setSheetExpanded(projected < 0.5);
        },
        onPanResponderTerminate: () => {
          sheetProgress.stopAnimation((value) => {
            setSheetExpanded(value < 0.5);
          });
        },
      }),
    [sheetProgress, sheetTravel]
  );

  const sheetTranslateY = sheetProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, sheetTravel],
  });

  const loadData = useCallback(async () => {
    if (!sessionStore.getAccessToken()) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [complaintData, officeData] = await Promise.all([
        getComplaints({ scope: "all" }),
        getMunicipalOffices(),
      ]);

      setComplaints(complaintData);
      setOffices(officeData);
    } catch (error) {
      Alert.alert("Map error", getApiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  useEffect(() => {
    if (userLocation) {
      return;
    }

    const loadLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          return;
        }
        const position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      } catch {
        // Ignore location errors; map will still work.
      }
    };

    void loadLocation();
  }, [userLocation]);

  const complaintMarkers = useMemo<MapItem[]>(() => {
    const mapped: (MapItem | null)[] = complaints.map((item): MapItem | null => {
        const coords = toLatLng(item.location?.coordinates);
        if (!coords) {
          return null;
        }
        return {
          id: item._id,
          type: "complaint",
          title: item.title,
          subtitle: item.status.replace("_", " "),
          latitude: coords.latitude,
          longitude: coords.longitude,
          status: item.status,
          priority: item.priority?.level,
          category: item.category,
          mapLink: item.mapLink,
          googleMapsLink: item.googleMapsLink,
          googleMapsDirectionsLink: item.googleMapsDirectionsLink,
        };
      });
    return mapped.filter((item): item is MapItem => item !== null);
  }, [complaints]);

  const officeMarkers = useMemo<MapItem[]>(() => {
    const mapped: (MapItem | null)[] = offices.map((office): MapItem | null => {
        const coords = toLatLng(office.location?.coordinates);
        if (!coords) {
          return null;
        }
        return {
          id: office._id,
          type: "office",
          title: office.name,
          subtitle: `Zone ${office.zone}`,
          latitude: coords.latitude,
          longitude: coords.longitude,
          status: office.isActive ? "active" : "inactive",
          mapLink: office.mapLink,
          googleMapsLink: office.googleMapsLink,
          googleMapsDirectionsLink: office.googleMapsDirectionsLink,
        };
      });
    return mapped.filter((item): item is MapItem => item !== null);
  }, [offices]);

  const normalizedSearch = searchQuery.trim().toLowerCase();

  const searchedComplaints = useMemo(() => {
    if (!normalizedSearch) {
      return complaintMarkers;
    }
    return complaintMarkers.filter((item) => {
      const searchable = `${item.title} ${item.subtitle} ${item.category || ""}`.toLowerCase();
      return searchable.includes(normalizedSearch);
    });
  }, [complaintMarkers, normalizedSearch]);

  const searchedOffices = useMemo(() => {
    if (!normalizedSearch) {
      return officeMarkers;
    }
    return officeMarkers.filter((item) => {
      const searchable = `${item.title} ${item.subtitle}`.toLowerCase();
      return searchable.includes(normalizedSearch);
    });
  }, [normalizedSearch, officeMarkers]);

  const statusFilteredComplaints = useMemo(
    () => searchedComplaints.filter((item) => matchesStatus(item.status, statusFilter)),
    [searchedComplaints, statusFilter]
  );

  const filteredComplaints = useMemo(() => {
    if (priorityFilter === "all") {
      return statusFilteredComplaints;
    }
    return statusFilteredComplaints.filter((item) => item.priority === priorityFilter);
  }, [priorityFilter, statusFilteredComplaints]);

  const visibleMarkers = useMemo(() => {
    const items: MapItem[] = [];
    if (showComplaints) {
      items.push(...filteredComplaints);
    }
    if (showOffices) {
      items.push(...searchedOffices);
    }
    return items;
  }, [filteredComplaints, searchedOffices, showComplaints, showOffices]);

  const markerPoints = useMemo(() => {
    return visibleMarkers.map((item) => ({
      latitude: item.latitude,
      longitude: item.longitude,
    }));
  }, [visibleMarkers]);

  const stats = useMemo(() => {
    const high = complaintMarkers.filter((item) => item.priority === "high").length;
    const medium = complaintMarkers.filter((item) => item.priority === "medium").length;
    const low = complaintMarkers.filter(
      (item) => !item.priority || item.priority === "low"
    ).length;
    return {
      high,
      medium,
      low,
      total: complaintMarkers.length,
      offices: officeMarkers.length,
    };
  }, [complaintMarkers, officeMarkers]);

  const mapHeight = windowHeight;
  const mapWidth = windowWidth;
  const activeRegion = region || buildRegionFromPoints(markerPoints, userLocation || undefined);
  const { tiles: osmTiles, zoom: osmZoom } = useMemo(
    () => buildTileLayout(activeRegion, mapWidth, mapHeight),
    [activeRegion, mapHeight, mapWidth]
  );
  const mapCreditsBottom = sheetExpanded ? sheetExpandedHeight + 42 : sheetCollapsedHeight + 52;

  useEffect(() => {
    if (region || markerPoints.length === 0) {
      return;
    }
    setRegion(buildRegionFromPoints(markerPoints, userLocation || undefined));
  }, [markerPoints, region, userLocation]);

  const handleLocate = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Location needed", "Enable location to center on your position.");
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const next = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      setUserLocation(next);
      const nextRegion = buildRegionFromPoints(markerPoints, next);
      setRegion(nextRegion);
    } catch (error) {
      Alert.alert("Location error", getApiErrorMessage(error));
    }
  };

  const handleFitToMarkers = () => {
    if (markerPoints.length === 0) {
      return;
    }
    setRegion(buildRegionFromPoints(markerPoints, userLocation || undefined));
  };

  if (!sessionStore.getAccessToken()) {
    return (
      <LinearGradient colors={["#f1f6fc", "#e0eaff"]} style={styles.container}>
        <View style={styles.centerState}>
          <Ionicons name="lock-closed" size={48} color="#1e3a8a" />
          <Text style={styles.centerTitle}>Login Required</Text>
          <Text style={styles.centerText}>Please login to view city map insights.</Text>
          <Pressable
            style={styles.ctaButton}
            onPress={() => router.push("/auth")}
          >
            <Text style={styles.ctaText}>Go to Login</Text>
          </Pressable>
        </View>
      </LinearGradient>
    );
  }

  if (loading) {
    return (
      <LinearGradient colors={["#f1f6fc", "#e0eaff"]} style={styles.container}>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#1e3a8a" />
          <Text style={styles.centerText}>Loading map data...</Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.map}>
        {osmTiles.map((tile) => (
          <Image
            key={tile.key}
            source={{ uri: tile.url }}
            style={[
              styles.osmTile,
              {
                left: tile.left,
                top: tile.top,
              },
            ]}
          />
        ))}
        <Pressable style={styles.mapDismissLayer} onPress={() => setSelectedItem(null)} />
        {userLocation ? (
          <View
            pointerEvents="none"
            style={[
              styles.userMarker,
              {
                left: getMarkerPosition(userLocation, activeRegion, osmZoom, mapWidth, mapHeight).left - 9,
                top: getMarkerPosition(userLocation, activeRegion, osmZoom, mapWidth, mapHeight).top - 9,
              },
            ]}
          />
        ) : null}
        {visibleMarkers.map((item) => {
          const position = getMarkerPosition(item, activeRegion, osmZoom, mapWidth, mapHeight);
          const markerStyle =
            item.type === "office"
              ? [
                  styles.officeMarker,
                  {
                    left: position.left - 12,
                    top: position.top - 12,
                  },
                ]
              : [
                  styles.markerDot,
                  {
                    left: position.left - 9,
                    top: position.top - 9,
                    backgroundColor: priorityColor(item.priority),
                  },
                ];
          return (
            <Pressable
              key={`${item.type}-${item.id}`}
              style={markerStyle}
              onPress={() => handleSelectItem(item)}
            >
              {item.type === "office" ? (
                <Ionicons name="business" size={14} color="#fff" />
              ) : null}
            </Pressable>
          );
        })}
        {selectedItem ? (
          <View style={[styles.mapInfoCard, { top: insets.top + 258 }]}>
            <Text style={styles.calloutTitle} numberOfLines={2}>
              {selectedItem.title}
            </Text>
            <Text style={styles.calloutSub} numberOfLines={1}>
              {selectedItem.category || selectedItem.subtitle}
            </Text>
            <View style={styles.calloutMetaRow}>
              <Text
                style={[
                  styles.calloutTag,
                  {
                    color:
                      selectedItem.type === "office"
                        ? statusColor(selectedItem.status)
                        : priorityColor(selectedItem.priority),
                    borderColor:
                      selectedItem.type === "office"
                        ? statusColor(selectedItem.status)
                        : priorityColor(selectedItem.priority),
                  },
                ]}
              >
                {selectedItem.type === "office"
                  ? (selectedItem.status || "active").toUpperCase()
                  : `${(selectedItem.priority || "low").toUpperCase()} PRIORITY`}
              </Text>
              <Text
                style={[
                  styles.calloutTag,
                  {
                    color: statusColor(selectedItem.status),
                    borderColor: statusColor(selectedItem.status),
                  },
                ]}
              >
                {formatStatusLabel(selectedItem.status).toUpperCase()}
              </Text>
            </View>
          </View>
        ) : null}
        <Pressable
          style={[styles.mapAttribution, { bottom: mapCreditsBottom }]}
          onPress={() => Linking.openURL(OSM_LINK).catch(() => undefined)}
        >
          <Text style={styles.mapAttributionText}>{OSM_ATTRIBUTION}</Text>
        </Pressable>
      </View>

      <LinearGradient
        colors={["#f8fafc", "#e0e7ff"]}
        style={[styles.header, { paddingTop: insets.top + 8 }]}
      >
        <Pressable onPress={() => safeBack("/")} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={20} color="#1e3a8a" />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title}>City Map</Text>
          <Text style={styles.subtitle}>
            {stats.total} complaints | {stats.offices} offices
          </Text>
        </View>
        <Pressable onPress={() => void loadData()} style={styles.headerButton}>
          <Ionicons name="refresh" size={20} color="#1e3a8a" />
        </Pressable>
      </LinearGradient>

      <View style={[styles.filters, { top: insets.top + 72 }]} pointerEvents="box-none">
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={16} color="#64748b" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search complaints / offices"
            placeholderTextColor="#94a3b8"
            style={styles.searchInput}
          />
          {searchQuery.length > 0 ? (
            <Pressable onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={16} color="#94a3b8" />
            </Pressable>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {(["all", "high", "medium", "low"] as PriorityLevel[]).map((level) => (
            <Pressable
              key={level}
              onPress={() => setPriorityFilter(level)}
              style={[
                styles.filterChip,
                priorityFilter === level && styles.filterChipActive,
              ]}
            >
              <Text
                style={[
                  styles.filterText,
                  priorityFilter === level && styles.filterTextActive,
                ]}
              >
                {level === "all" ? "All priorities" : `${level} priority`}
              </Text>
            </Pressable>
          ))}
          {(["all", "open", "resolved", "rejected"] as ComplaintStatusFilter[]).map(
            (level) => (
              <Pressable
                key={level}
                onPress={() => setStatusFilter(level)}
                style={[styles.filterChip, statusFilter === level && styles.filterChipActive]}
              >
                <Text
                  style={[
                    styles.filterText,
                    statusFilter === level && styles.filterTextActive,
                  ]}
                >
                  {level === "all" ? "All status" : level}
                </Text>
              </Pressable>
            )
          )}
          <Pressable
            onPress={() => setShowComplaints((prev) => !prev)}
            style={[
              styles.filterChip,
              showComplaints && styles.filterChipActive,
            ]}
          >
            <Text
              style={[
                styles.filterText,
                showComplaints && styles.filterTextActive,
              ]}
            >
              Complaints
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setShowOffices((prev) => !prev)}
            style={[styles.filterChip, showOffices && styles.filterChipActive]}
          >
            <Text
              style={[styles.filterText, showOffices && styles.filterTextActive]}
            >
              Offices
            </Text>
          </Pressable>
        </ScrollView>
      </View>

      <View style={[styles.mapActions, { top: insets.top + 180 }]} pointerEvents="box-none">
        <Pressable style={styles.actionButton} onPress={handleLocate}>
          <Ionicons name="locate" size={18} color="#1e3a8a" />
        </Pressable>
        <Pressable style={styles.actionButton} onPress={handleFitToMarkers}>
          <Ionicons name="scan" size={18} color="#1e3a8a" />
        </Pressable>
      </View>

      <View style={[styles.legend, { top: insets.top + 210 }]} pointerEvents="box-none">
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: "#ef4444" }]} />
          <Text style={styles.legendText}>High</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: "#f59e0b" }]} />
          <Text style={styles.legendText}>Medium</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: "#10b981" }]} />
          <Text style={styles.legendText}>Low</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: "#1e3a8a" }]} />
          <Text style={styles.legendText}>Office</Text>
        </View>
      </View>

      <Animated.View
        style={[
          styles.bottomSheet,
          { height: sheetExpandedHeight, transform: [{ translateY: sheetTranslateY }] },
        ]}
      >
        <View style={[styles.sheetCard, { paddingBottom: Math.max(12, insets.bottom + 2) }]}>
          <View style={styles.sheetHandleWrap} {...sheetPanResponder.panHandlers}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetPeekTitle}>City overview</Text>
            <Pressable onPress={() => setSheetExpanded((prev) => !prev)} style={styles.sheetToggleButton}>
              <Ionicons
                name={sheetExpanded ? "chevron-down" : "chevron-up"}
                size={18}
                color="#475569"
              />
            </Pressable>
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{stats.high}</Text>
              <Text style={styles.summaryLabel}>High priority</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{stats.medium}</Text>
              <Text style={styles.summaryLabel}>Medium</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{stats.low}</Text>
              <Text style={styles.summaryLabel}>Low</Text>
            </View>
          </View>

          {!sheetExpanded ? (
            <Text style={styles.sheetHintText}>
              Swipe up to view recent complaints across the city.
            </Text>
          ) : (
            <View style={styles.sheetExpandedBody}>
              {selectedItem ? (
                <View style={styles.selectedCard}>
                  <View style={styles.sheetHeader}>
                    <View style={styles.sheetTitleWrap}>
                      <Text style={styles.sheetTitle}>{selectedItem.title}</Text>
                      <Text style={styles.sheetSub}>{selectedItem.subtitle}</Text>
                    </View>
                    <Pressable onPress={() => setSelectedItem(null)}>
                      <Ionicons name="close" size={18} color="#64748b" />
                    </Pressable>
                  </View>
                  <View style={styles.sheetRow}>
                    <View
                      style={[
                        styles.statusPill,
                        {
                          backgroundColor: `${statusColor(selectedItem.status)}20`,
                          borderColor: statusColor(selectedItem.status),
                        },
                      ]}
                    >
                      <Text
                        style={[styles.statusText, { color: statusColor(selectedItem.status) }]}
                      >
                        {selectedItem.type === "office"
                          ? selectedItem.status || "active"
                          : formatStatusLabel(selectedItem.status)}
                      </Text>
                    </View>
                    {selectedItem.type === "complaint" ? (
                      <View
                        style={[
                          styles.statusPill,
                          {
                            backgroundColor: `${priorityColor(selectedItem.priority)}20`,
                            borderColor: priorityColor(selectedItem.priority),
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusText,
                            { color: priorityColor(selectedItem.priority) },
                          ]}
                        >
                          {selectedItem.priority || "low"} priority
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Pressable
                    style={styles.directionsButton}
                    onPress={() => openDirections(selectedItem)}
                  >
                    <Ionicons name="navigate" size={16} color="#fff" />
                    <Text style={styles.directionsText}>Get directions</Text>
                  </Pressable>
                </View>
              ) : null}

              <Text style={styles.sectionTitle}>Recent complaints</Text>
              <ScrollView showsVerticalScrollIndicator={false} style={styles.list}>
                {filteredComplaints.slice(0, 10).map((item) => (
                  <Pressable
                    key={item.id}
                    style={styles.listItem}
                    onPress={() => handleSelectItem(item)}
                  >
                    <View style={[styles.dot, { backgroundColor: priorityColor(item.priority) }]} />
                    <View style={styles.listBody}>
                      <Text style={styles.listTitle}>{item.title}</Text>
                      <Text style={styles.listSub}>
                        {item.category || "Complaint"} - {formatStatusLabel(item.status)}
                      </Text>
                    </View>
                  </Pressable>
                ))}
                {filteredComplaints.length === 0 ? (
                  <Text style={styles.emptyText}>No complaints found for current filters.</Text>
                ) : null}
              </ScrollView>
            </View>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#eef2ff",
  },
  map: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#dbeafe",
    overflow: "hidden",
  },
  osmTile: {
    position: "absolute",
    width: OSM_TILE_SIZE,
    height: OSM_TILE_SIZE,
  },
  mapDismissLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  markerDot: {
    position: "absolute",
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: "#fff",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
    zIndex: 3,
  },
  officeMarker: {
    position: "absolute",
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#1e3a8a",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
    zIndex: 3,
  },
  userMarker: {
    position: "absolute",
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#2563eb",
    borderWidth: 3,
    borderColor: "#fff",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
    zIndex: 2,
  },
  mapInfoCard: {
    position: "absolute",
    left: 12,
    right: 64,
    zIndex: 4,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.96)",
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.1)",
  },
  callout: {
    width: 220,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.98)",
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.1)",
  },
  mapAttribution: {
    position: "absolute",
    left: 12,
    zIndex: 4,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.86)",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  mapAttributionText: {
    fontSize: 10,
    color: "#475569",
    fontWeight: "600",
  },
  calloutTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
    lineHeight: 17,
  },
  calloutSub: {
    marginTop: 3,
    fontSize: 12,
    color: "#64748b",
  },
  calloutMetaRow: {
    marginTop: 8,
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
  },
  calloutTag: {
    borderWidth: 1,
    borderRadius: 999,
    fontSize: 10,
    fontWeight: "700",
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderColor: "rgba(15,23,42,0.06)",
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1e3a8a",
  },
  subtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  filters: {
    position: "absolute",
    top: 104,
    left: 12,
    right: 12,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.08)",
    borderRadius: 14,
    minHeight: 40,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0f172a",
    paddingVertical: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.08)",
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: "#1e3a8a",
  },
  filterText: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "600",
  },
  filterTextActive: {
    color: "#fff",
  },
  mapActions: {
    position: "absolute",
    right: 12,
    top: 212,
    gap: 10,
  },
  actionButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
  },
  legend: {
    position: "absolute",
    left: 12,
    top: 242,
    backgroundColor: "rgba(255,255,255,0.92)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.08)",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 11,
    color: "#475569",
    fontWeight: "600",
  },
  bottomSheet: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
  },
  sheetCard: {
    backgroundColor: "rgba(255,255,255,0.98)",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.08)",
    flex: 1,
    overflow: "hidden",
  },
  sheetHandleWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: -2,
    marginBottom: 8,
  },
  sheetHandle: {
    width: 46,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#cbd5e1",
    marginRight: 10,
  },
  sheetPeekTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
    color: "#0f172a",
  },
  sheetToggleButton: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetHintText: {
    marginTop: 4,
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
  },
  sheetExpandedBody: {
    flex: 1,
    minHeight: 120,
  },
  selectedCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.08)",
    backgroundColor: "#f8fafc",
    padding: 10,
    marginBottom: 8,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  sheetTitleWrap: {
    flex: 1,
    marginRight: 10,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
  },
  sheetSub: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  sheetRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 12,
  },
  statusPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  directionsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#2563eb",
    borderRadius: 12,
    paddingVertical: 10,
  },
  directionsText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 10,
    gap: 8,
  },
  summaryCard: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    alignItems: "center",
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1e3a8a",
  },
  summaryLabel: {
    marginTop: 2,
    fontSize: 11,
    color: "#64748b",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1e3a8a",
    marginBottom: 8,
  },
  list: {
    flex: 1,
    minHeight: 120,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  listBody: {
    flex: 1,
  },
  listTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f172a",
  },
  listSub: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
  },
  emptyText: {
    fontSize: 12,
    color: "#64748b",
  },
  centerState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 24,
  },
  centerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1e3a8a",
  },
  centerText: {
    fontSize: 14,
    color: "#475569",
    textAlign: "center",
  },
  ctaButton: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  ctaText: {
    color: "#fff",
    fontWeight: "700",
  },
});
