import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import KatokLogo from "../components/KatokLogo";
import ResidentHotbar from "../components/ResidentHotbar";
import TopNotificationBanner from "../components/TopNotificationBanner";
import { fetchNextSchedule } from "../services/resident";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const isSmall = SCREEN_WIDTH < 360;

function safeString(val, fallback = "") {
  if (val === null || val === undefined) return fallback;
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (typeof val === "object") {
    if (typeof val.name === "string") return val.name;
    if (typeof val.label === "string") return val.label;
  }
  return fallback;
}

function computeCountdown(dateStr, timeStr) {
  if (!dateStr) return "Upcoming";
  const now = new Date();

  let hours = 8;
  let minutes = 0;
  if (timeStr) {
    const parts = String(timeStr).split(":");
    if (parts.length >= 2) {
      hours = parseInt(parts[0], 10) || 8;
      minutes = parseInt(parts[1], 10) || 0;
    }
  }

  const target = new Date(String(dateStr).slice(0, 10) + "T00:00:00");
  target.setHours(hours, minutes, 0, 0);

  const diffMs = target.getTime() - now.getTime();
  if (diffMs <= 0) {
    const isSameDay = target.toDateString() === now.toDateString();
    if (isSameDay) return "Collection today";
    return "Next run scheduled";
  }

  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays >= 2) {
    return `in ${diffDays} days`;
  } else if (diffDays === 1) {
    return "in 1 day";
  } else if (diffHours >= 1) {
    return `in ${diffHours} hour${diffHours > 1 ? "s" : ""}`;
  } else {
    const diffMinutes = Math.max(1, Math.floor(diffMs / (1000 * 60)));
    return `in ${diffMinutes} min${diffMinutes > 1 ? "s" : ""}`;
  }
}

const QUICK_ACTIONS = [
  {
    id: "schedule",
    label: "Schedule",
    icon: "calendar-clock-outline",
    color: "#1976D2",
    bg: "#E3F2FD",
    route: "/schedule",
    keywords: ["schedule", "pickup", "calendar", "time", "date", "trash", "route"],
  },
  {
    id: "compliance",
    label: "Compliance",
    icon: "leaf-circle-outline",
    color: "#2E7D32",
    bg: "#E8F8EE",
    route: "/compliance",
    keywords: ["compliance", "segregation", "guidelines", "biodegradable", "recyclable", "residual", "ordinance", "ra 9003"],
  },
  {
    id: "post",
    label: "Submit Report",
    icon: "camera-plus-outline",
    color: "#00796B",
    bg: "#E0F2F1",
    route: "/post",
    keywords: ["report", "complaint", "issue", "dumping", "missed", "uncollected", "camera", "photo"],
  },
  {
    id: "notifications",
    label: "Notifications",
    icon: "bell-ring-outline",
    color: "#F57F17",
    bg: "#FFF8E1",
    route: "/notifications",
    keywords: ["notification", "alert", "notice", "reminder", "advisory"],
  },
  {
    id: "feedback",
    label: "Feedback",
    icon: "message-text-outline",
    color: "#7B1FA2",
    bg: "#F3E5F5",
    route: "/feedback",
    keywords: ["feedback", "suggestion", "support", "community", "message", "timing", "quality"],
  },
];

export default function Dashboard() {
  const router = useRouter();
  const [userName, setUserName] = useState("Jane Doe");
  const [userLocation, setUserLocation] = useState("Barangay 12, Cagayan de Oro");
  const [barangayId, setBarangayId] = useState(12);
  const [searchQuery, setSearchQuery] = useState("");

  const [nextSchedule, setNextSchedule] = useState(null);
  const [countdownText, setCountdownText] = useState("Upcoming");
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [topBanner, setTopBanner] = useState({
    visible: false,
    title: "",
    message: "",
    type: "truck",
  });

  const loadUserData = async () => {
    try {
      const name = await AsyncStorage.getItem("userName");
      const loc = await AsyncStorage.getItem("userBarangay");
      if (name) setUserName(safeString(name, "Jane Doe"));
      if (loc) {
        let locStr = loc;
        try {
          const parsed = JSON.parse(loc);
          if (parsed && typeof parsed === "object") {
            locStr = safeString(parsed.name || parsed.id, loc);
          }
        } catch {}
        const cleanLoc = safeString(locStr, "Barangay 12");
        setUserLocation(
          cleanLoc.includes("Cagayan") ? cleanLoc : `${cleanLoc}, Cagayan de Oro`
        );
        const match = cleanLoc.match(/(\d+)/);
        if (match) {
          setBarangayId(parseInt(match[1], 10) || 12);
        }
      }
    } catch (e) {
      console.error("Failed to load user info:", e);
    }
  };

  const loadScheduleData = useCallback(
    async (isSilent = false) => {
      try {
        if (!isSilent) setLoadingSchedule(true);
        const res = await fetchNextSchedule(barangayId, userLocation);
        if (res && res.success && res.schedule) {
          setNextSchedule(res.schedule);
          const dateVal = res.schedule.collection_date || res.schedule.date;
          const timeVal = res.schedule.start_time || res.schedule.pickup_time;
          setCountdownText(computeCountdown(dateVal, timeVal));
        } else {
          setNextSchedule(null);
          setCountdownText("No schedule set");
        }
      } catch (e) {
        console.warn("Could not fetch remote schedule:", e);
        setNextSchedule(null);
        setCountdownText("No schedule set");
      } finally {
        if (!isSilent) setLoadingSchedule(false);
        setRefreshing(false);
      }
    },
    [barangayId, userLocation]
  );

  useEffect(() => {
    loadUserData();
  }, []);

  useEffect(() => {
    loadScheduleData();
  }, [loadScheduleData]);

  useEffect(() => {
    const timer = setInterval(() => {
      loadScheduleData(true);
    }, 10000);
    return () => clearInterval(timer);
  }, [loadScheduleData]);

  useEffect(() => {
    const dateVal = nextSchedule?.collection_date || nextSchedule?.date;
    const timeVal = nextSchedule?.start_time || nextSchedule?.pickup_time;
    if (!dateVal) return;
    setCountdownText(computeCountdown(dateVal, timeVal));
    const interval = setInterval(() => {
      setCountdownText(computeCountdown(dateVal, timeVal));
    }, 60000);

    return () => clearInterval(interval);
  }, [nextSchedule?.collection_date, nextSchedule?.date, nextSchedule?.start_time, nextSchedule?.pickup_time]);

  const onRefresh = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setRefreshing(true);
    loadScheduleData();
  };

  const handlePressQuickAction = (actionItem) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    if (actionItem.route) {
      router.push(actionItem.route);
    }
  };

  const displayedActions = searchQuery.trim()
    ? QUICK_ACTIONS.filter(
        (a) =>
          a.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          a.keywords.some((k) => k.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : QUICK_ACTIONS;

  const handleSearchSubmit = () => {
    if (displayedActions.length > 0) {
      handlePressQuickAction(displayedActions[0]);
    }
  };

  const scheduleDateRaw = safeString(
    nextSchedule?.collection_date || nextSchedule?.date,
    ""
  ).slice(0, 10);

  const formattedCollectionDate = scheduleDateRaw
    ? new Date(scheduleDateRaw + "T00:00:00").toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "No Upcoming Schedule";

  const pickupTimeDisplay = nextSchedule?.start_time
    ? safeString(nextSchedule.start_time).slice(0, 5)
    : nextSchedule?.pickup_time
    ? safeString(nextSchedule.pickup_time).slice(0, 5)
    : "Not Set";

  const endTimeDisplay = nextSchedule?.end_time
    ? safeString(nextSchedule.end_time).slice(0, 5)
    : "";

  const routeNameDisplay = safeString(
    nextSchedule?.route_name || nextSchedule?.route?.name || nextSchedule?.route,
    ""
  );

  const assignedTruckDisplay = nextSchedule?.assigned_truck
    ? `${safeString(nextSchedule.assigned_truck.truck_number)} (${safeString(
        nextSchedule.assigned_truck.plate_number
      )})`
    : "";

  const scheduleStatusRaw = safeString(
    nextSchedule?.collection_status || nextSchedule?.status,
    "scheduled"
  ).toLowerCase();

  const scheduleStatusLabel =
    scheduleStatusRaw === "in_progress"
      ? "IN PROGRESS"
      : scheduleStatusRaw === "completed"
      ? "COMPLETED"
      : "SCHEDULED";

  useEffect(() => {
    if (!scheduleDateRaw) {
      setTopBanner((prev) => ({ ...prev, visible: false }));
      return;
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const todayStr = `${year}-${month}-${day}`;

    if (scheduleDateRaw === todayStr) {
      const timer = setTimeout(() => {
        setTopBanner({
          visible: true,
          title: "Garbage Collection Today",
          message: `Scheduled pickup today at ${pickupTimeDisplay} for ${userLocation}. Please have your segregated bins ready.`,
          type: "truck",
        });

        import("../services/pushNotification")
          .then(({ triggerLocalNotification }) => {
            triggerLocalNotification(
              "Garbage Collection Today",
              `Scheduled pickup today at ${pickupTimeDisplay} for ${userLocation}. Please have your segregated bins ready.`
            );
          })
          .catch(() => {});
      }, 1200);

      return () => clearTimeout(timer);
    } else {
      setTopBanner((prev) => ({ ...prev, visible: false }));
    }
  }, [scheduleDateRaw, pickupTimeDisplay, userLocation]);

  return (
    <View style={styles.container}>
      <TopNotificationBanner
        visible={topBanner.visible}
        title={topBanner.title}
        message={topBanner.message}
        type={topBanner.type}
        onPress={() => router.push("/schedule")}
        onDismiss={() => setTopBanner((prev) => ({ ...prev, visible: false }))}
      />

      {/* 1. TOP BRAND & GREETING HEADER */}
      <View style={styles.topHeader}>
        <KatokLogo variant="header" showTagline={false} />

        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={styles.bellButton}
            activeOpacity={0.8}
            onPress={() => router.push("/notifications")}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialCommunityIcons name="bell-outline" size={22} color="#1E331B" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.avatarCircle}
            activeOpacity={0.8}
            onPress={() => router.push("/profile")}
          >
            <MaterialCommunityIcons name="account" size={22} color="#2E7D32" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* 2. USER GREETING & RESIDENTIAL LOCATION */}
        <View style={styles.greetingBar}>
          <View>
            <Text style={styles.greetingTitle}>Hello, {userName}!</Text>
            <View style={styles.locationRow}>
              <MaterialCommunityIcons name="map-marker" size={15} color="#2E7D32" />
              <Text style={styles.locationText}>{userLocation}</Text>
            </View>
          </View>
        </View>

        {/* 3. SEARCH BAR */}
        <View style={styles.searchBar}>
          <MaterialCommunityIcons name="magnify" size={20} color="#7A8D78" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search schedules, reports, notifications, or feedback..."
            placeholderTextColor="#9AA998"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearchSubmit}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialCommunityIcons name="close-circle" size={18} color="#A5B8A3" />
            </TouchableOpacity>
          )}
        </View>

        {/* 4. MAIN HERO CARD: NEXT COLLECTION WITH SCHEDULED WINDOW */}
        <TouchableOpacity
          style={styles.heroCard}
          activeOpacity={0.9}
          onPress={() => router.push("/schedule")}
        >
          <View style={styles.heroCardLeft}>
            <View style={styles.heroCardHeaderRow}>
              <Text style={styles.heroTitle}>Next Collection</Text>
              {loadingSchedule && <ActivityIndicator size="small" color="#2E7D32" />}
              {nextSchedule && (
                <View style={styles.statusPill}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusPillText}>{scheduleStatusLabel}</Text>
                </View>
              )}
            </View>

            <Text style={styles.heroMainDate}>{formattedCollectionDate}</Text>

            <View style={styles.countdownBadge}>
              <MaterialCommunityIcons name="clock-outline" size={13} color="#1E5E22" />
              <Text style={styles.countdownText}>{countdownText}</Text>
            </View>

            <Text style={styles.heroSubDetail}>
              {nextSchedule?.start_time_formatted || nextSchedule?.pickup_time || nextSchedule?.start_time
                ? `Start: ${safeString(nextSchedule?.start_time_formatted || pickupTimeDisplay)} • Est. Arrival: ${safeString(
                    nextSchedule?.estimated_arrival_formatted || endTimeDisplay || "12:00 PM"
                  )}`
                : "Tap to view barangay collection calendar"}
            </Text>

            {(routeNameDisplay || assignedTruckDisplay) ? (
              <View style={styles.heroRouteMeta}>
                {nextSchedule?.start_location && nextSchedule?.end_location ? (
                  <View style={styles.heroRouteRow}>
                    <MaterialCommunityIcons name="routes" size={13} color="#2E7D32" />
                    <Text style={styles.heroRouteText} numberOfLines={1}>
                      {`${safeString(nextSchedule.start_location)} → ${safeString(nextSchedule.end_location)}`}
                    </Text>
                  </View>
                ) : null}
                {nextSchedule?.estimated_duration ? (
                  <View style={styles.heroRouteRow}>
                    <MaterialCommunityIcons name="timer-outline" size={13} color="#E65100" />
                    <Text style={styles.heroRouteText} numberOfLines={1}>
                      Est. Travel Time: {safeString(nextSchedule.estimated_duration)}
                    </Text>
                  </View>
                ) : null}
                {routeNameDisplay ? (
                  <View style={styles.heroRouteRow}>
                    <MaterialCommunityIcons name="map-marker-path" size={13} color="#2E7D32" />
                    <Text style={styles.heroRouteText} numberOfLines={1}>
                      {routeNameDisplay}
                    </Text>
                  </View>
                ) : null}
                {assignedTruckDisplay ? (
                  <View style={styles.heroRouteRow}>
                    <MaterialCommunityIcons name="truck-check-outline" size={13} color="#1976D2" />
                    <Text style={styles.heroTruckText} numberOfLines={1}>
                      Assigned Unit: {assignedTruckDisplay}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>

          <View style={styles.heroCardRight}>
            <Image
              source={require("../assets/images/compactor_truck.png")}
              style={styles.heroTruckImage}
              resizeMode="contain"
            />
          </View>
        </TouchableOpacity>

        {/* 5. QUICK ACTIONS GRID (Schedule, Submit Report, Notifications, Feedback) */}
        <View style={styles.quickActionsHeaderRow}>
          <Text style={styles.sectionTitle}>
            {searchQuery.trim() ? `Search Results (${displayedActions.length})` : "Quick Actions"}
          </Text>
          {searchQuery.trim().length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Text style={styles.clearSearchLink}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.quickActionsGrid}>
          {displayedActions.map((action) => (
            <TouchableOpacity
              key={action.id}
              style={styles.actionGridCard}
              activeOpacity={0.85}
              onPress={() => handlePressQuickAction(action)}
            >
              <View style={[styles.actionIconBox, { backgroundColor: action.bg }]}>
                <MaterialCommunityIcons name={action.icon} size={25} color={action.color} />
              </View>
              <Text style={styles.actionLabel} numberOfLines={2}>
                {action.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* 6. 4-TAB RESIDENT BOTTOM HOTBAR (Home, Schedule, Reports, Profile) */}
      <ResidentHotbar activeTab="home" />
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
  headerRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  bellButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F2F7F1",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#E8F8EE",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#C5E6CE",
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 95,
  },
  greetingBar: {
    marginBottom: 14,
  },
  greetingTitle: {
    fontSize: isSmall ? 20 : 22,
    fontWeight: "900",
    color: "#1E331B",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
  },
  locationText: {
    fontSize: 13,
    color: "#4A6E46",
    fontWeight: "600",
    marginLeft: 3,
  },
  searchBar: {
    height: 46,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    borderWidth: 1.2,
    borderColor: "#DDEADA",
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13.5,
    color: "#1E331B",
  },

  // HERO CARD: NEXT COLLECTION
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1.5,
    borderColor: "#D3EBD0",
    shadowColor: "#2E7D32",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 20,
  },
  heroCardLeft: {
    flex: 1,
    marginRight: 10,
  },
  heroCardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#5C7858",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  heroMainDate: {
    fontSize: isSmall ? 17 : 19,
    fontWeight: "900",
    color: "#1E331B",
    marginBottom: 8,
  },
  countdownBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#E4F7E3",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 6,
  },
  countdownText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#1E5E22",
    marginLeft: 4,
  },
  heroSubDetail: {
    fontSize: 12,
    color: "#728F6E",
    fontWeight: "600",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F8EE",
    borderColor: "#B7DFB9",
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#2E7D32",
  },
  statusPillText: {
    fontSize: 9,
    fontWeight: "900",
    color: "#1E5E22",
    letterSpacing: 0.4,
  },
  heroRouteMeta: {
    marginTop: 6,
    gap: 3,
  },
  heroRouteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  heroRouteText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#1E5E22",
    flex: 1,
  },
  heroTruckText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#1565C0",
    flex: 1,
  },
  heroCardRight: {
    justifyContent: "center",
    alignItems: "center",
  },
  heroTruckImage: {
    width: 88,
    height: 58,
  },

  // QUICK ACTIONS GRID (5 ITEMS)
  quickActionsHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1E331B",
  },
  clearSearchLink: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2E7D32",
  },
  quickActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 14,
    marginBottom: 20,
  },
  actionGridCard: {
    width: (SCREEN_WIDTH - 52) / 5,
    minWidth: 58,
    alignItems: "center",
  },
  actionIconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#F0F5EE",
  },
  actionLabel: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#2C3E2A",
    textAlign: "center",
    lineHeight: 13.5,
  },
});
