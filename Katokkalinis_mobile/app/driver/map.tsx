import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import KatokLogo from "../../components/KatokLogo";
import LiveRouteMapView from "../../components/LiveRouteMapView";
import TopNotificationBanner from "../../components/TopNotificationBanner";
import { BarangayItem, getBarangays1to40 } from "../../services/driver";
import {
  addLocationListener,
  getLastRecordedLocation,
  isAutomaticRecordingActive,
  LiveLocationState,
  startAutomaticLocationRecording,
} from "../../services/locationService";

export default function DriverMap() {
  const router = useRouter();
  const [barangays, setBarangays] = useState<BarangayItem[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<number | "all">(4);
  const [liveGps, setLiveGps] = useState<LiveLocationState | null>(
    getLastRecordedLocation()
  );
  const [banner, setBanner] = useState({
    visible: true,
    title: "Collection Schedule • Sector 4 Active",
    message:
      "Interactive live map covering CDO Urban Pilot Barangays 1 to 40.",
    type: "truck" as "truck" | "info" | "success",
  });

  useEffect(() => {
    loadBarangays();

    if (isAutomaticRecordingActive()) {
      const loc = getLastRecordedLocation();
      const coordStr = loc
        ? `[${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}]`
        : "";
      setBanner({
        visible: true,
        title: "Live GPS Telemetry Active • Truck KAL-104",
        message: `Automatic route recording is streaming live ${coordStr} to the Superadmin Dashboard.`,
        type: "truck",
      });
    }

    const unsubscribe = addLocationListener((state) => {
      setLiveGps(state);
    });
    return () => unsubscribe();
  }, []);

  const loadBarangays = async () => {
    try {
      const data = await getBarangays1to40();
      setBarangays(data);
    } catch (e) {
      console.warn("Failed to load barangays", e);
    }
  };

  const handleEnsureGpsActive = () => {
    if (!isAutomaticRecordingActive()) {
      startAutomaticLocationRecording({ plateNumber: "KAL-104" }).catch(
        () => {}
      );
      setBanner({
        visible: true,
        title: "Live GPS Recording Started • KAL-104",
        message:
          "Broadcasting real-time truck coordinates to Superadmin & Monitor Truck maps.",
        type: "success",
      });
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Banner */}
      <TopNotificationBanner
        visible={banner.visible}
        title={banner.title}
        message={banner.message}
        type={banner.type}
        onDismiss={() => setBanner((prev) => ({ ...prev, visible: false }))}
      />

      {/* 1. TOP HEADER */}
      <View style={styles.topHeader}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color="#1E331B"
            />
          </TouchableOpacity>
          <KatokLogo variant="header" showTagline={false} />
        </View>

        <TouchableOpacity
          style={styles.truckActiveBadge}
          onPress={handleEnsureGpsActive}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons
            name="satellite-uplink"
            size={14}
            color="#2E7D32"
          />
          <Text style={styles.truckActiveText}>
            {liveGps?.isRecording ? "Live GPS On" : "Start Live GPS"}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 2. TITLE SECTION */}
        <View style={styles.titleSection}>
          <Text style={styles.pageTitle}>Live Route & GPS Map</Text>
          <Text style={styles.pageSubtitle}>
            Real-Time Truck Location & Designated Collection Corridors • Barangays 1 to 40
          </Text>
        </View>

        {/* 3. INTERACTIVE LIVE ROUTE & TRUCK GPS MAP MODULE */}
        <View style={styles.mapCard}>
          <View style={styles.mapCardHeader}>
            <View style={styles.mapCardTitleRow}>
              <MaterialCommunityIcons
                name="map-Search-outline"
                size={18}
                color="#15803D"
              />
              <Text style={styles.mapCardTitle}>
                Live Fleet GPS Telemetry (KAL-104)
              </Text>
            </View>
            <Text style={styles.mapPingsCount}>
              {liveGps?.pingsCount
                ? `${liveGps.pingsCount} pings synced`
                : "Synced with Web"}
            </Text>
          </View>

          {/* Route Filter Selector Pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterPillsRow}
          >
            {[
              { id: "all" as const, label: "All Routes (1–4)", color: "#15803D" },
              { id: 4 as const, label: "R4 South • KAL-104 (You)", color: "#7B1FA2" },
              { id: 1 as const, label: "R1 North • KAL-101", color: "#2E7D32" },
              { id: 2 as const, label: "R2 Central • KAL-102", color: "#1976D2" },
              { id: 3 as const, label: "R3 East • KAL-103", color: "#F57C00" },
            ].map((tab) => {
              const isSelected = selectedRouteId === tab.id;
              return (
                <TouchableOpacity
                  key={String(tab.id)}
                  style={[
                    styles.routeFilterPill,
                    isSelected && {
                      backgroundColor: tab.color,
                      borderColor: tab.color,
                    },
                  ]}
                  onPress={() => setSelectedRouteId(tab.id)}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.routeFilterPillText,
                      isSelected && { color: "#FFFFFF", fontWeight: "800" },
                    ]}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Embedded Interactive Map */}
          <LiveRouteMapView
            height={320}
            selectedRouteId={selectedRouteId}
            compact={false}
          />

          {/* Live Coordinates & Speed Strip */}
          <View style={styles.telemetryStrip}>
            <View style={styles.telemetryCol}>
              <Text style={styles.telemetryLabel}>CURRENT COORDINATES</Text>
              <Text style={styles.telemetryValue}>
                {liveGps
                  ? `${liveGps.latitude.toFixed(5)}, ${liveGps.longitude.toFixed(5)}`
                  : "8.47520, 124.65120"}
              </Text>
            </View>
            <View style={styles.telemetryCol}>
              <Text style={styles.telemetryLabel}>SPEED</Text>
              <Text style={styles.telemetryValue}>
                {liveGps?.speed ? `${liveGps.speed} km/h` : "18.5 km/h"}
              </Text>
            </View>
            <View style={styles.telemetryCol}>
              <Text style={styles.telemetryLabel}>ACTIVE SECTOR</Text>
              <Text style={[styles.telemetryValue, { color: "#15803D" }]}>
                {liveGps?.currentSectorName || "Brgy 31–40 South"}
              </Text>
            </View>
          </View>
        </View>

        {/* 4. ROUTE DIRECTORY (BARANGAY 1 TO 40) */}
        <Text style={styles.sectionTitle}>
          Garbage Truck Fleet Routes (Tap to Focus on Map)
        </Text>

        <View style={styles.routeCardList}>
          {/* Route 1 */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setSelectedRouteId(1)}
            style={[
              styles.routeCard,
              { borderLeftColor: "#2E7D32" },
              selectedRouteId === 1 && styles.routeCardSelected,
            ]}
          >
            <View style={styles.routeCardHeader}>
              <View
                style={[styles.routeNumBadge, { backgroundColor: "#2E7D32" }]}
              >
                <Text style={styles.routeNumText}>R1</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.routeCardTitle}>North Poblacion</Text>
                <Text style={styles.routeCardSub}>
                  Barangays 1 to 10 • Truck KAL-101
                </Text>
              </View>
              <View style={styles.activeTag}>
                <Text style={styles.activeTagText}>View on Map</Text>
              </View>
            </View>
            <Text style={styles.routeCoverage}>
              Coverage: City Health, Fernandez, Burgos, Port Access, Gaabucayan
              ({barangays.length > 0 ? "10 Stops Synced" : "Barangays 1–10"}).
            </Text>
          </TouchableOpacity>

          {/* Route 2 */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setSelectedRouteId(2)}
            style={[
              styles.routeCard,
              { borderLeftColor: "#1976D2" },
              selectedRouteId === 2 && styles.routeCardSelected,
            ]}
          >
            <View style={styles.routeCardHeader}>
              <View
                style={[styles.routeNumBadge, { backgroundColor: "#1976D2" }]}
              >
                <Text style={styles.routeNumText}>R2</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.routeCardTitle}>Central Poblacion</Text>
                <Text style={styles.routeCardSub}>
                  Barangays 11 to 20 • Truck KAL-102
                </Text>
              </View>
              <View style={styles.activeTag}>
                <Text style={styles.activeTagText}>View on Map</Text>
              </View>
            </View>
            <Text style={styles.routeCoverage}>
              Coverage: Tirso Neri Heritage, JR Borja, Cogon Market Periphery,
              Limketkai.
            </Text>
          </TouchableOpacity>

          {/* Route 3 */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setSelectedRouteId(3)}
            style={[
              styles.routeCard,
              { borderLeftColor: "#F57C00" },
              selectedRouteId === 3 && styles.routeCardSelected,
            ]}
          >
            <View style={styles.routeCardHeader}>
              <View
                style={[styles.routeNumBadge, { backgroundColor: "#F57C00" }]}
              >
                <Text style={styles.routeNumText}>R3</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.routeCardTitle}>East Poblacion</Text>
                <Text style={styles.routeCardSub}>
                  Barangays 21 to 30 • Truck KAL-103
                </Text>
              </View>
              <View style={styles.activeTag}>
                <Text style={styles.activeTagText}>View on Map</Text>
              </View>
            </View>
            <Text style={styles.routeCoverage}>
              Coverage: Agora Terminal, Provincial Capitol, Velez Central,
              Daumar St.
            </Text>
          </TouchableOpacity>

          {/* Route 4 */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setSelectedRouteId(4)}
            style={[
              styles.routeCard,
              { borderLeftColor: "#7B1FA2" },
              selectedRouteId === 4 && styles.routeCardSelected,
            ]}
          >
            <View style={styles.routeCardHeader}>
              <View
                style={[styles.routeNumBadge, { backgroundColor: "#7B1FA2" }]}
              >
                <Text style={styles.routeNumText}>R4</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={styles.routeCardTitle}>South Poblacion</Text>
                <Text style={styles.routeCardSub}>
                  Barangays 31 to 40 • Truck KAL-104 (Your Truck)
                </Text>
              </View>
              <View
                style={[styles.activeTag, { backgroundColor: "#E8F8EE" }]}
              >
                <Text style={[styles.activeTagText, { color: "#2E7D32" }]}>
                  Your Run
                </Text>
              </View>
            </View>
            <Text style={styles.routeCoverage}>
              Coverage: Cogon Market Central Bay, City Hall & Gaston Park,
              Carmen Bridge Approach, Riverbank.
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* 5. BOTTOM NAVIGATION */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          activeOpacity={0.8}
          onPress={() => {}}
        >
          <MaterialCommunityIcons
            name="map-marker-distance"
            size={24}
            color="#2E7D32"
          />
          <Text style={[styles.navItemText, styles.navItemTextActive]}>
            Route
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          activeOpacity={0.8}
          onPress={() => router.push("/driver/dashboard" as any)}
        >
          <MaterialCommunityIcons
            name="truck-fast"
            size={24}
            color="#7A8D78"
          />
          <Text style={styles.navItemText}>Collection</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          activeOpacity={0.8}
          onPress={() => router.push("/driver/profile" as any)}
        >
          <MaterialCommunityIcons
            name="account-outline"
            size={24}
            color="#7A8D78"
          />
          <Text style={styles.navItemText}>Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FBFDFB",
    paddingTop: 45,
  },
  topHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF5ED",
    backgroundColor: "#FFFFFF",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F2F7F1",
    alignItems: "center",
    justifyContent: "center",
  },
  truckActiveBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F8EE",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#C5EBD2",
    gap: 5,
  },
  truckActiveText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#2E7D32",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 95,
  },
  titleSection: {
    marginBottom: 10,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#1E331B",
  },
  pageSubtitle: {
    fontSize: 11,
    color: "#688264",
    marginTop: 2,
    fontWeight: "500",
  },
  mapCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#DCEBDD",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  mapCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  mapCardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  mapCardTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1E331B",
  },
  mapPingsCount: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#15803D",
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  filterPillsRow: {
    flexDirection: "row",
    gap: 6,
    paddingBottom: 10,
  },
  routeFilterPill: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D6E3D5",
    backgroundColor: "#F4F8F4",
  },
  routeFilterPillText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#435941",
  },
  telemetryStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#F4FBF6",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#D1FAE5",
  },
  telemetryCol: {
    flex: 1,
  },
  telemetryLabel: {
    fontSize: 8.5,
    fontWeight: "800",
    color: "#688264",
    letterSpacing: 0.4,
  },
  telemetryValue: {
    fontSize: 11,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 1,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1E331B",
    marginBottom: 8,
  },
  routeCardList: {
    gap: 10,
  },
  routeCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5ECE4",
    borderLeftWidth: 4,
  },
  routeCardSelected: {
    borderColor: "#2E7D32",
    backgroundColor: "#F7FCF8",
  },
  routeCardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  routeNumBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  routeNumText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  routeCardTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1E331B",
  },
  routeCardSub: {
    fontSize: 10,
    color: "#688264",
    fontWeight: "600",
  },
  activeTag: {
    backgroundColor: "#F0F4EF",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  activeTagText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#4A6148",
  },
  routeCoverage: {
    fontSize: 10,
    color: "#556655",
    marginTop: 6,
    lineHeight: 14,
  },
  bottomNav: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 65,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#EEF5ED",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingBottom: 4,
  },
  navItem: {
    alignItems: "center",
    paddingVertical: 4,
  },
  navItemText: {
    fontSize: 10,
    color: "#7A8D78",
    marginTop: 2,
    fontWeight: "600",
  },
  navItemTextActive: {
    color: "#2E7D32",
    fontWeight: "800",
  },
});
