import AsyncStorage from "@react-native-async-storage/async-storage";
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
import TopNotificationBanner from "../../components/TopNotificationBanner";
import { BarangayItem, getBarangays1to40 } from "../../services/driver";

interface RouteCorridorMeta {
  id: 1 | 2 | 3 | 4;
  code: string;
  name: string;
  truck: string;
  rangeLabel: string;
  startBrgy: number;
  endBrgy: number;
  scheduleDays: string;
  scheduleWindow: string;
  color: string;
  coverage: string;
}

const ROUTE_CORRIDORS: RouteCorridorMeta[] = [
  {
    id: 1,
    code: "R1",
    name: "North Poblacion Corridor",
    truck: "KAL-101",
    rangeLabel: "Barangays 1 to 10",
    startBrgy: 1,
    endBrgy: 10,
    scheduleDays: "Mon • Wed • Fri",
    scheduleWindow: "06:00 AM – 09:00 AM",
    color: "#2E7D32",
    coverage:
      "City Health, Fernandez St., Burgos, Macabalan Port Access, Gaabucayan (Barangays 1–10).",
  },
  {
    id: 2,
    code: "R2",
    name: "Central Poblacion & Cogon Corridor",
    truck: "KAL-102",
    rangeLabel: "Barangays 11 to 20",
    startBrgy: 11,
    endBrgy: 20,
    scheduleDays: "Tue • Thu • Sat",
    scheduleWindow: "07:00 AM – 10:00 AM",
    color: "#1976D2",
    coverage:
      "Tirso Neri, JR Borja, Cogon Public Market Periphery, Commercial District (Barangays 11–20).",
  },
  {
    id: 3,
    code: "R3",
    name: "East Poblacion Corridor",
    truck: "KAL-103",
    rangeLabel: "Barangays 21 to 30",
    startBrgy: 21,
    endBrgy: 30,
    scheduleDays: "Tue • Thu • Sat",
    scheduleWindow: "08:00 AM – 11:00 AM",
    color: "#F57C00",
    coverage:
      "Agora Access, Provincial Capitol Perimeter, Velez Central, Daumar St. (Barangays 21–30).",
  },
  {
    id: 4,
    code: "R4",
    name: "South Poblacion & Market Link",
    truck: "KAL-104",
    rangeLabel: "Barangays 31 to 40",
    startBrgy: 31,
    endBrgy: 40,
    scheduleDays: "Mon • Wed • Fri",
    scheduleWindow: "08:00 AM – 11:00 AM",
    color: "#7B1FA2",
    coverage:
      "Cogon Public Market South Bay, City Hall & Gaston Park, Carmen Public Market Bridge Approach (Barangays 31–40).",
  },
];

const CLEARED_STOPS_STORAGE_KEY = "driver_cleared_stops_v1";

export default function DriverMap() {
  const router = useRouter();
  const [barangays, setBarangays] = useState<BarangayItem[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<1 | 2 | 3 | 4 | "all">(4);
  const [clearedStops, setClearedStops] = useState<Record<string, boolean>>({});
  const [banner, setBanner] = useState({
    visible: true,
    title: "Assigned Collection Corridors • Barangays 1–40",
    message:
      "Review scheduled pickup windows and mark barangay collection stops along your assigned CDO route.",
    type: "truck" as "truck" | "info" | "success",
  });

  useEffect(() => {
    loadBarangays();
    loadClearedStops();
  }, []);

  const loadBarangays = async () => {
    try {
      const data = await getBarangays1to40();
      setBarangays(data);
    } catch (e) {
      console.warn("Failed to load barangays", e);
    }
  };

  const loadClearedStops = async () => {
    try {
      const raw = await AsyncStorage.getItem(CLEARED_STOPS_STORAGE_KEY);
      if (raw) {
        setClearedStops(JSON.parse(raw));
      }
    } catch {}
  };

  const toggleStopCleared = async (brgyName: string) => {
    const updated = {
      ...clearedStops,
      [brgyName]: !clearedStops[brgyName],
    };
    setClearedStops(updated);
    try {
      await AsyncStorage.setItem(CLEARED_STOPS_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  };

  const activeRouteMeta =
    selectedRouteId === "all"
      ? ROUTE_CORRIDORS[3]
      : ROUTE_CORRIDORS.find((r) => r.id === selectedRouteId) || ROUTE_CORRIDORS[3];

  const routeStops = barangays.filter((b) => {
    const num = Number(b.number || b.id);
    if (selectedRouteId === "all") return num >= 1 && num <= 40;
    return num >= activeRouteMeta.startBrgy && num <= activeRouteMeta.endBrgy;
  });

  const clearedInViewCount = routeStops.filter(
    (b) => clearedStops[b.name] || (b.today_logs_count && b.today_logs_count > 0)
  ).length;

  return (
    <View style={styles.container}>
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
            <MaterialCommunityIcons name="arrow-left" size={24} color="#1E331B" />
          </TouchableOpacity>
          <KatokLogo variant="header" showTagline={false} />
        </View>

        <View style={styles.truckActiveBadge}>
          <MaterialCommunityIcons name="truck-check" size={14} color="#2E7D32" />
          <Text style={styles.truckActiveText}>KAL-104 • Route #04</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 2. TITLE SECTION */}
        <View style={styles.titleSection}>
          <Text style={styles.pageTitle}>Assigned Routes & Stops</Text>
          <Text style={styles.pageSubtitle}>
            Scheduled Collection Corridors • CDO Urban Barangays 1 to 40 & Public Markets
          </Text>
        </View>

        {/* 3. ASSIGNED CORRIDOR & BARANGAY STOPS MODULE */}
        <View style={styles.corridorCard}>
          <View style={styles.corridorCardHeader}>
            <View style={styles.corridorCardTitleRow}>
              <MaterialCommunityIcons name="map-marker-path" size={18} color="#15803D" />
              <Text style={styles.corridorCardTitle}>
                {selectedRouteId === "all"
                  ? "All Pilot Corridors (Barangays 1–40)"
                  : `${activeRouteMeta.name} (${activeRouteMeta.truck})`}
              </Text>
            </View>
            <Text style={styles.stopsProgressPill}>
              {clearedInViewCount}/{routeStops.length || (selectedRouteId === "all" ? 40 : 10)} Cleared
            </Text>
          </View>

          {/* Route Filter Selector Pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterPillsRow}
          >
            {[
              { id: 4 as const, label: "R4 South • KAL-104 (Assigned)", color: "#7B1FA2" },
              { id: 1 as const, label: "R1 North • KAL-101", color: "#2E7D32" },
              { id: 2 as const, label: "R2 Central • KAL-102", color: "#1976D2" },
              { id: 3 as const, label: "R3 East • KAL-103", color: "#F57C00" },
              { id: "all" as const, label: "All Pilot Stops (1–40)", color: "#15803D" },
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

          {/* Schedule Summary Strip */}
          <View style={styles.scheduleSummaryBox}>
            <View style={styles.scheduleCol}>
              <Text style={styles.scheduleLabel}>COLLECTION DAYS</Text>
              <Text style={styles.scheduleValue}>
                {selectedRouteId === "all" ? "Mon – Sat Roster" : activeRouteMeta.scheduleDays}
              </Text>
            </View>
            <View style={styles.scheduleCol}>
              <Text style={styles.scheduleLabel}>TIME WINDOW</Text>
              <Text style={styles.scheduleValue}>
                {selectedRouteId === "all" ? "06:00 AM – 11:00 AM" : activeRouteMeta.scheduleWindow}
              </Text>
            </View>
            <View style={styles.scheduleCol}>
              <Text style={styles.scheduleLabel}>COVERAGE</Text>
              <Text style={[styles.scheduleValue, { color: "#15803D" }]}>
                {selectedRouteId === "all" ? "Brgy 1–40" : activeRouteMeta.rangeLabel}
              </Text>
            </View>
          </View>

          {/* Barangay Stops Checklist */}
          <Text style={styles.stopsSubheading}>
            Designated Barangay Pickup Stops (Tap stop to mark cleared)
          </Text>
          <View style={styles.stopsGrid}>
            {routeStops.slice(0, selectedRouteId === "all" ? 20 : 10).map((b) => {
              const isDone =
                Boolean(clearedStops[b.name]) ||
                Boolean(b.today_logs_count && b.today_logs_count > 0);
              return (
                <TouchableOpacity
                  key={b.id}
                  style={[styles.stopChip, isDone && styles.stopChipDone]}
                  onPress={() => toggleStopCleared(b.name)}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons
                    name={isDone ? "check-circle" : "checkbox-blank-circle-outline"}
                    size={15}
                    color={isDone ? "#2E7D32" : "#7A8D78"}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.stopChipTitle, isDone && styles.stopChipTitleDone]}
                      numberOfLines={1}
                    >
                      {b.name}
                    </Text>
                    <Text style={styles.stopChipMeta}>
                      {b.today_collected_tons && b.today_collected_tons > 0
                        ? `${b.today_collected_tons} tons logged`
                        : isDone
                        ? "Stop Cleared"
                        : "Scheduled Stop"}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
          {selectedRouteId === "all" && routeStops.length > 20 && (
            <Text style={styles.moreStopsNote}>
              Showing first 20 of 40 urban barangays. Select R1–R4 above to inspect each 10-barangay sector.
            </Text>
          )}
        </View>

        {/* 4. ROUTE DIRECTORY (BARANGAY 1 TO 40) */}
        <Text style={styles.sectionTitle}>
          CLENRO Pilot Fleet Corridors (Barangays 1 to 40)
        </Text>

        <View style={styles.routeCardList}>
          {ROUTE_CORRIDORS.map((route) => {
            const isSelected = selectedRouteId === route.id;
            const isAssigned = route.id === 4;
            return (
              <TouchableOpacity
                key={route.id}
                activeOpacity={0.85}
                onPress={() => setSelectedRouteId(route.id)}
                style={[
                  styles.routeCard,
                  { borderLeftColor: route.color },
                  isSelected && styles.routeCardSelected,
                ]}
              >
                <View style={styles.routeCardHeader}>
                  <View style={[styles.routeNumBadge, { backgroundColor: route.color }]}>
                    <Text style={styles.routeNumText}>{route.code}</Text>
                  </View>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.routeCardTitle}>{route.name}</Text>
                    <Text style={styles.routeCardSub}>
                      {route.rangeLabel} • Truck {route.truck} • {route.scheduleDays}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.activeTag,
                      isAssigned && { backgroundColor: "#E8F8EE" },
                    ]}
                  >
                    <Text
                      style={[
                        styles.activeTagText,
                        isAssigned && { color: "#2E7D32" },
                      ]}
                    >
                      {isAssigned ? "Your Run" : "View Stops"}
                    </Text>
                  </View>
                </View>
                <Text style={styles.routeCoverage}>Coverage: {route.coverage}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* 5. BOTTOM NAVIGATION */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} activeOpacity={0.8} onPress={() => {}}>
          <MaterialCommunityIcons name="map-marker-distance" size={24} color="#2E7D32" />
          <Text style={[styles.navItemText, styles.navItemTextActive]}>Route</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          activeOpacity={0.8}
          onPress={() => router.push("/driver/dashboard" as any)}
        >
          <MaterialCommunityIcons name="truck-fast" size={24} color="#7A8D78" />
          <Text style={styles.navItemText}>Collection</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          activeOpacity={0.8}
          onPress={() => router.push("/driver/profile" as any)}
        >
          <MaterialCommunityIcons name="account-outline" size={24} color="#7A8D78" />
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
  corridorCard: {
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
  corridorCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  corridorCardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  corridorCardTitle: {
    fontSize: 12.5,
    fontWeight: "800",
    color: "#1E331B",
    flexShrink: 1,
  },
  stopsProgressPill: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#15803D",
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 3,
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
  scheduleSummaryBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#F4FBF6",
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#D1FAE5",
  },
  scheduleCol: {
    flex: 1,
  },
  scheduleLabel: {
    fontSize: 8.5,
    fontWeight: "800",
    color: "#688264",
    letterSpacing: 0.4,
  },
  scheduleValue: {
    fontSize: 10.5,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 2,
  },
  stopsSubheading: {
    fontSize: 11,
    fontWeight: "800",
    color: "#3F563E",
    marginTop: 12,
    marginBottom: 8,
  },
  stopsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
  },
  stopChip: {
    width: "48.5%",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "#F8FAF8",
    borderWidth: 1,
    borderColor: "#E2ECE1",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 9,
  },
  stopChipDone: {
    backgroundColor: "#ECFDF3",
    borderColor: "#A7F3D0",
  },
  stopChipTitle: {
    fontSize: 11.5,
    fontWeight: "800",
    color: "#1E331B",
  },
  stopChipTitleDone: {
    color: "#166534",
  },
  stopChipMeta: {
    fontSize: 9.5,
    color: "#688264",
    fontWeight: "600",
  },
  moreStopsNote: {
    fontSize: 10,
    color: "#688264",
    marginTop: 8,
    textAlign: "center",
    fontStyle: "italic",
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
