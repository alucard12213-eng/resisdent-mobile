import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import BarangayPickerModal, {
  BARANGAYS_1_TO_40,
} from "../components/BarangayPickerModal";
import ResidentHotbar from "../components/ResidentHotbar";
import {
  fetchCollectionRoutes,
  fetchSchedules,
} from "../services/resident";

const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const DAY_ORDER = {
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
  Sunday: 7,
};

function safeString(val, fallback = "") {
  if (val === null || val === undefined) return fallback;
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (typeof val === "object") {
    if (typeof val.name === "string") return val.name;
    if (typeof val.label === "string") return val.label;
    if (typeof val.title === "string") return val.title;
  }
  return fallback;
}

function extractBarangayName(item, fallback = "Barangay 12") {
  if (!item) return safeString(fallback, "Barangay 12");
  if (typeof item === "string") return item;
  if (typeof item.barangay_name === "string" && item.barangay_name.trim()) {
    return item.barangay_name.trim();
  }
  if (typeof item.barangay === "string" && item.barangay.trim()) {
    return item.barangay.trim();
  }
  if (item.barangay && typeof item.barangay === "object" && typeof item.barangay.name === "string") {
    return item.barangay.name.trim();
  }
  if (typeof item.name === "string" && item.name.trim()) {
    return item.name.trim();
  }
  return safeString(fallback, "Barangay 12");
}

function extractRouteName(item, fallbackRouteNumber = 1) {
  if (!item) return `Route ${fallbackRouteNumber}`;
  if (typeof item.route_name === "string" && item.route_name.trim()) {
    return item.route_name.trim();
  }
  if (typeof item.route === "string" && item.route.trim()) {
    return item.route.trim();
  }
  if (item.route && typeof item.route === "object" && typeof item.route.name === "string") {
    return item.route.name.trim();
  }
  return `Route ${fallbackRouteNumber}`;
}

function extractTruckLabel(item, fallbackTruck = null) {
  const truckObj =
    (item && typeof item.assigned_truck === "object" && item.assigned_truck) ||
    (item && typeof item.truck === "object" && item.truck) ||
    fallbackTruck;

  if (!truckObj) {
    if (item && typeof item.truck === "string") return item.truck;
    return "Assigned Compactor Unit";
  }

  const num = safeString(truckObj.truck_number, "");
  const plate = safeString(truckObj.plate_number, "");
  if (num && plate) return `${num} (${plate})`;
  if (plate) return plate;
  if (num) return num;
  return safeString(truckObj.name, "Assigned Compactor Unit");
}

function formatTime12(timeStr) {
  if (!timeStr) return "08:00 AM";
  const clean = safeString(timeStr, "08:00").trim();
  const parts = clean.split(":");
  if (parts.length < 2) return clean;
  let hour = parseInt(parts[0], 10);
  if (isNaN(hour)) return clean;
  const minute = parts[1].slice(0, 2);
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${hour}:${minute} ${ampm}`;
}

function formatDateDisplay(dateStr) {
  const raw = safeString(dateStr, "");
  if (!raw) return "";
  try {
    const cleanStr = raw.slice(0, 10);
    const d = new Date(cleanStr + "T00:00:00");
    if (isNaN(d.getTime())) return cleanStr;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return raw.slice(0, 10);
  }
}

function getDayFromItem(item) {
  const dayRaw = safeString(item?.day, "").trim();
  if (dayRaw) {
    return dayRaw;
  }
  const dateSource = safeString(item?.collection_date || item?.date, "");
  if (dateSource) {
    try {
      const cleanStr = dateSource.slice(0, 10);
      const d = new Date(cleanStr + "T00:00:00");
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString("en-US", { weekday: "long" });
      }
    } catch { }
  }
  return "Monday";
}

function formatStatusLabel(statusRaw) {
  const s = safeString(statusRaw, "scheduled").toLowerCase();
  if (s === "completed") return "Completed";
  if (s === "in_progress") return "In Progress";
  if (s === "delayed") return "Delayed";
  if (s === "cancelled") return "Cancelled";
  return "Scheduled";
}

function normalizeScheduleItem(raw, fallbackBarangayName) {
  if (!raw || typeof raw !== "object") return null;
  const barangayName = extractBarangayName(raw, fallbackBarangayName);
  const routeNumber = Number(raw.route_number) || 1;
  const routeName = extractRouteName(raw, routeNumber);
  const statusStr = safeString(raw.collection_status || raw.status, "scheduled").toLowerCase();
  const collectionDate = safeString(raw.collection_date || raw.date, "").slice(0, 10);
  const startTime = safeString(raw.start_time || raw.pickup_time, "08:00").slice(0, 5);
  const endTime = safeString(raw.end_time, "10:00").slice(0, 5);
  const stops = Array.isArray(raw.route_stops)
    ? raw.route_stops.map((s) => safeString(s)).filter(Boolean)
    : [];

  return {
    ...raw,
    id: raw.id ?? `${barangayName}-${collectionDate}-${startTime}`,
    barangay_name: barangayName,
    route_number: routeNumber,
    route_name: routeName,
    collection_date: collectionDate,
    date: collectionDate,
    start_time: startTime,
    pickup_time: startTime,
    end_time: endTime,
    collection_status: statusStr,
    status: statusStr,
    notes: safeString(raw.notes, ""),
    schedule_type: safeString(raw.schedule_type, "Municipal Waste Collection"),
    estimated_arrival: safeString(raw.estimated_arrival, "") || null,
    route_stops: stops,
  };
}

function sortSchedulesChronologically(list) {
  if (!Array.isArray(list)) return [];
  return [...list].sort((a, b) => {
    const dateA = safeString(a.collection_date || a.date, "").slice(0, 10);
    const dateB = safeString(b.collection_date || b.date, "").slice(0, 10);
    if (dateA && dateB && dateA !== dateB) {
      return dateA.localeCompare(dateB);
    }
    const dayA = DAY_ORDER[getDayFromItem(a)] || 99;
    const dayB = DAY_ORDER[getDayFromItem(b)] || 99;
    if (dayA !== dayB) return dayA - dayB;
    return safeString(a.start_time || a.pickup_time, "").localeCompare(
      safeString(b.start_time || b.pickup_time, "")
    );
  });
}

export default function Schedule() {
  const router = useRouter();

  const [selectedBarangay, setSelectedBarangay] = useState(BARANGAYS_1_TO_40[11]); // Default to Barangay 12
  const [viewMode, setViewMode] = useState("days"); // "days" | "date" | "routes"
  const [schedules, setSchedules] = useState([]);
  const [collectionRoutes, setCollectionRoutes] = useState([]);
  const [showCorridorStops, setShowCorridorStops] = useState(true);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [reminderActive, setReminderActive] = useState(false);

  const selectedBarangayName = extractBarangayName(selectedBarangay, "Barangay 12");
  const selectedBarangayId = Number(selectedBarangay?.id) || 12;

  // Load user's registered barangay from storage
  useEffect(() => {
    const initBarangay = async () => {
      try {
        const stored = await AsyncStorage.getItem("userBarangay");
        if (stored) {
          let parsedStr = stored;
          try {
            const maybeObj = JSON.parse(stored);
            if (maybeObj && typeof maybeObj === "object") {
              parsedStr = safeString(maybeObj.name || maybeObj.id, stored);
            }
          } catch { }

          const match = String(parsedStr).match(/(\d+)/);
          if (match) {
            const id = parseInt(match[1], 10);
            if (id >= 1 && id <= 40) {
              setSelectedBarangay(BARANGAYS_1_TO_40[id - 1]);
            }
          }
        }
      } catch (e) {
        console.error("Failed to load user barangay:", e);
      }
    };
    initBarangay();
  }, []);

  // Sync reminder state for selected barangay
  useEffect(() => {
    AsyncStorage.getItem(`@schedule_reminder_${selectedBarangayId}`)
      .then((val) => {
        setReminderActive(val === "true");
      })
      .catch(() => { });
  }, [selectedBarangayId]);

  const loadSchedulesAndRoutes = useCallback(
    async (isSilent = false) => {
      try {
        if (!isSilent) {
          setLoading(true);
          setErrorMessage(null);
        }

        const [schedRes, routesRes] = await Promise.all([
          fetchSchedules(selectedBarangayId, selectedBarangayName),
          fetchCollectionRoutes({
            barangayId: selectedBarangayId,
            barangayName: selectedBarangayName,
          }),
        ]);

        if (schedRes && schedRes.success && Array.isArray(schedRes.schedules)) {
          const normalized = schedRes.schedules
            .map((item) => normalizeScheduleItem(item, selectedBarangayName))
            .filter(Boolean);
          setSchedules(sortSchedulesChronologically(normalized));
        } else if (schedRes && schedRes.success === false) {
          setSchedules([]);
          if (!isSilent) {
            setErrorMessage(schedRes.message || "Unable to load collection schedules.");
          }
        } else {
          setSchedules([]);
        }

        if (routesRes && routesRes.success && Array.isArray(routesRes.routes)) {
          const normalizedRoutes = routesRes.routes
            .map((item) => normalizeScheduleItem(item, selectedBarangayName))
            .filter(Boolean);
          setCollectionRoutes(normalizedRoutes);
        } else {
          setCollectionRoutes([]);
        }
      } catch (error) {
        console.warn("Schedule & route load error:", error);
        if (!isSilent) {
          setErrorMessage("Could not connect to the schedule server. Please check your connection and try again.");
        }
      } finally {
        if (!isSilent) setLoading(false);
      }
    },
    [selectedBarangayId, selectedBarangayName]
  );

  useEffect(() => {
    loadSchedulesAndRoutes();
  }, [loadSchedulesAndRoutes]);

  // Live Auto-Refresh (Polls backend every 8s)
  useEffect(() => {
    const timer = setInterval(() => {
      loadSchedulesAndRoutes(true);
    }, 8000);
    return () => clearInterval(timer);
  }, [loadSchedulesAndRoutes]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSchedulesAndRoutes(true);
    setRefreshing(false);
  };

  const toggleReminder = async () => {
    const nextState = !reminderActive;
    setReminderActive(nextState);
    try {
      await AsyncStorage.setItem(
        `@schedule_reminder_${selectedBarangayId}`,
        String(nextState)
      );
    } catch { }

    if (nextState) {
      try {
        const { triggerLocalNotification } = await import(
          "../services/pushNotification"
        );
        await triggerLocalNotification(
          "Collection Reminder Activated",
          `Push notifications enabled for ${selectedBarangayName}. You will be alerted before compactor runs.`
        );
      } catch (err) {
        console.warn("Could not fire local push notification:", err);
      }

      Alert.alert(
        "Push Reminder Enabled",
        `You will receive a push notification alert before scheduled collections in ${selectedBarangayName}.`
      );
    } else {
      Alert.alert(
        "Reminder Disabled",
        `Collection reminders turned off for ${selectedBarangayName}.`
      );
    }
  };

  // Determine canonical Route Number (1..4) for selected barangay (1-10 => 1, 11-20 => 2, 21-30 => 3, 31-40 => 4)
  const activeRouteNumber = Math.min(4, Math.max(1, Math.ceil(selectedBarangayId / 10)));
  const primarySchedule = schedules[0] || null;
  const primaryRoute = collectionRoutes[0] || null;
  const activeAssignedTruck =
    primarySchedule?.assigned_truck ||
    primaryRoute?.assigned_truck ||
    {
      truck_number: `KAL-10${activeRouteNumber}`,
      plate_number: `CDO-10${activeRouteNumber}`,
    };

  const corridorStartBrgy = (activeRouteNumber - 1) * 10 + 1;
  const corridorEndBrgy = activeRouteNumber * 10;
  const defaultCorridorStops = Array.from(
    { length: 10 },
    (_, i) => `Barangay ${corridorStartBrgy + i}`
  );
  const activeCorridorStops =
    Array.isArray(primaryRoute?.route_stops) && primaryRoute.route_stops.length > 0
      ? primaryRoute.route_stops
      : defaultCorridorStops;

  const renderRouteAndTruckDetails = (item, includeStops = false) => {
    const collectionDate = formatDateDisplay(item.collection_date || item.date) || "Scheduled";
    const startTime = formatTime12(item.start_time || item.pickup_time);
    const endTime = item.end_time ? formatTime12(item.end_time) : "10:00 AM";
    const barangayLabel = extractBarangayName(item, selectedBarangayName);
    const routeName = extractRouteName(item, activeRouteNumber);
    const truckLabel = extractTruckLabel(item, activeAssignedTruck);
    const collectionStatus = formatStatusLabel(item.collection_status || item.status);
    const stopsList =
      Array.isArray(item.route_stops) && item.route_stops.length > 0
        ? item.route_stops
        : defaultCorridorStops;

    return (
      <View style={styles.detailGridBox}>
        <View style={styles.detailRowItem}>
          <MaterialCommunityIcons name="calendar-check-outline" size={14} color="#2E7D32" />
          <Text style={styles.detailKeyText}>Collection Date:</Text>
          <Text style={styles.detailValText}>{collectionDate}</Text>
        </View>

        <View style={styles.detailRowItem}>
          <MaterialCommunityIcons name="clock-start" size={14} color="#1565C0" />
          <Text style={styles.detailKeyText}>Scheduled Time:</Text>
          <Text style={styles.detailValText}>
            {startTime} – {endTime} (Planned Window)
          </Text>
        </View>

        <View style={styles.detailRowItem}>
          <MaterialCommunityIcons name="home-city-outline" size={14} color="#2E7D32" />
          <Text style={styles.detailKeyText}>Barangay:</Text>
          <Text style={styles.detailValText}>{barangayLabel}</Text>
        </View>

        <View style={styles.detailRowItem}>
          <MaterialCommunityIcons name="map-marker-path" size={14} color="#6A1B9A" />
          <Text style={styles.detailKeyText}>Collection Route:</Text>
          <Text style={styles.detailValText} numberOfLines={1}>
            {routeName}
          </Text>
        </View>

        <View style={styles.detailRowItem}>
          <MaterialCommunityIcons name="truck-check-outline" size={14} color="#D84315" />
          <Text style={styles.detailKeyText}>Assigned Truck:</Text>
          <Text style={styles.detailValText}>{truckLabel}</Text>
        </View>

        <View style={styles.detailRowItem}>
          <MaterialCommunityIcons name="progress-check" size={14} color="#2E7D32" />
          <Text style={styles.detailKeyText}>Collection Status:</Text>
          <Text style={styles.detailValText}>{collectionStatus}</Text>
        </View>

        {includeStops && stopsList.length > 0 && (
          <View style={styles.stopsContainer}>
            <View style={styles.stopsHeaderRow}>
              <MaterialCommunityIcons name="sign-direction" size={13} color="#1E5822" />
              <Text style={styles.stopsHeaderText}>
                Collection Stops ({stopsList.length} Barangays):
              </Text>
            </View>
            <View style={styles.stopsChipsWrap}>
              {stopsList.map((stopName, sIdx) => {
                const isSelectedStop =
                  stopName.toLowerCase() === selectedBarangayName.toLowerCase();
                return (
                  <View
                    key={`${stopName}-${sIdx}`}
                    style={[
                      styles.stopChip,
                      isSelectedStop && styles.stopChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.stopChipText,
                        isSelectedStop && styles.stopChipTextActive,
                      ]}
                    >
                      {sIdx + 1}. {stopName}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        <View style={styles.gpsStandbyRow}>
          <MaterialCommunityIcons name="leaf-circle-outline" size={13} color="#2E7D32" />
          <Text style={styles.gpsStandbyText}>
            Place segregated bins at designated pickup point 30 mins before scheduled window
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* HEADER NAV */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#1E331B" />
        </TouchableOpacity>

        <Text style={styles.screenTitle}>Collection Route & Schedule</Text>

        <TouchableOpacity
          style={styles.calendarActionButton}
          onPress={toggleReminder}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <MaterialCommunityIcons
            name={reminderActive ? "bell-ring" : "bell-outline"}
            size={22}
            color={reminderActive ? "#2E7D32" : "#455E42"}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={["#2E7D32"]}
            tintColor="#2E7D32"
          />
        }
      >
        {/* VIEW MODE TOGGLE (Weekly Days | By Date | Route & GPS) */}
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === "days" && styles.toggleBtnActive]}
            onPress={() => setViewMode("days")}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name="calendar-week"
              size={15}
              color={viewMode === "days" ? "#1E5822" : "#688264"}
              style={{ marginRight: 5 }}
            />
            <Text
              style={[
                styles.toggleBtnText,
                viewMode === "days" && styles.toggleBtnTextActive,
              ]}
            >
              Mon – Sun
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === "date" && styles.toggleBtnActive]}
            onPress={() => setViewMode("date")}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name="calendar-month"
              size={15}
              color={viewMode === "date" ? "#1E5822" : "#688264"}
              style={{ marginRight: 5 }}
            />
            <Text
              style={[
                styles.toggleBtnText,
                viewMode === "date" && styles.toggleBtnTextActive,
              ]}
            >
              By Date
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toggleBtn, viewMode === "routes" && styles.toggleBtnActive]}
            onPress={() => setViewMode("routes")}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name="map-marker-path"
              size={15}
              color={viewMode === "routes" ? "#1E5822" : "#688264"}
              style={{ marginRight: 5 }}
            />
            <Text
              style={[
                styles.toggleBtnText,
                viewMode === "routes" && styles.toggleBtnTextActive,
              ]}
            >
              Routes & Stops
            </Text>
          </TouchableOpacity>
        </View>

        {/* BARANGAY SELECTOR MODAL (1–40) */}
        <View style={styles.selectorSection}>
          <Text style={styles.selectorLabel}>Select Barangay Location (1–40)</Text>
          <BarangayPickerModal
            selectedBarangay={selectedBarangayName}
            onSelect={(item) => setSelectedBarangay(item)}
          />
        </View>

        {/* ACTIVE BARANGAY & ASSIGNED ROUTE SUMMARY BANNER */}
        <View style={styles.activeBanner}>
          <View style={styles.bannerTopRow}>
            <View style={styles.bannerIconBox}>
              <MaterialCommunityIcons name="truck-check-outline" size={24} color="#2E7D32" />
            </View>
            <View style={styles.bannerText}>
              <Text style={styles.bannerTitle}>Active Collection Area & Corridor</Text>
              <Text style={styles.bannerBarangay}>{selectedBarangayName}</Text>
              <Text style={styles.bannerRouteSub}>
                {extractRouteName(primarySchedule || primaryRoute, activeRouteNumber)}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.refreshIconBtn}
              onPress={handleRefresh}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialCommunityIcons name="sync" size={18} color="#2E7D32" />
            </TouchableOpacity>
          </View>

          {/* ASSIGNED COMPACTOR UNIT & CORRIDOR STOPS TOGGLE */}
          <View style={styles.bannerTelemetryBar}>
            <View style={styles.bannerTelemetryInfo}>
              <MaterialCommunityIcons
                name="truck-check-outline"
                size={16}
                color="#1E5822"
              />
              <Text style={styles.bannerTelemetryText} numberOfLines={2}>
                {`Assigned Unit: ${extractTruckLabel(primarySchedule || primaryRoute, activeAssignedTruck)}`}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.mapTogglePill}
              onPress={() => setShowCorridorStops((prev) => !prev)}
            >
              <MaterialCommunityIcons
                name={showCorridorStops ? "chevron-up" : "sign-direction"}
                size={14}
                color="#FFFFFF"
              />
              <Text style={styles.mapTogglePillText}>
                {showCorridorStops ? "Hide Stops" : "View Stops"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ASSIGNED CORRIDOR & BARANGAY STOPS OVERVIEW */}
        {showCorridorStops && (
          <View style={styles.mapSectionCard}>
            <View style={styles.mapSectionHeader}>
              <View style={styles.mapSectionTitleRow}>
                <MaterialCommunityIcons name="map-marker-path" size={18} color="#15803D" />
                <Text style={styles.mapSectionTitle}>
                  Assigned Route Corridor (Barangays {corridorStartBrgy}–{corridorEndBrgy})
                </Text>
              </View>
              <Text style={styles.mapSectionTag}>Route #{activeRouteNumber}</Text>
            </View>
            <View style={styles.stopsChipsWrap}>
              {activeCorridorStops.map((stopName, sIdx) => {
                const isSelectedStop =
                  stopName.toLowerCase() === selectedBarangayName.toLowerCase();
                return (
                  <View
                    key={`corridor-${stopName}-${sIdx}`}
                    style={[
                      styles.stopChip,
                      isSelectedStop && styles.stopChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.stopChipText,
                        isSelectedStop && styles.stopChipTextActive,
                      ]}
                    >
                      {sIdx + 1}. {stopName}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* SCHEDULE / ROUTE LIST HEADER */}
        <View style={styles.scheduleHeaderRow}>
          <Text style={styles.sectionTitle}>
            {viewMode === "days"
              ? "Weekly Days (Monday – Sunday)"
              : viewMode === "date"
                ? "Chronological Calendar Dates"
                : "Active Collection Routes & Stops"}
          </Text>
          <Text style={styles.scheduleCount}>
            {viewMode === "routes"
              ? `${collectionRoutes.length} ${collectionRoutes.length === 1 ? "Route" : "Routes"}`
              : `${schedules.length} ${schedules.length === 1 ? "Schedule" : "Schedules"}`}
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#2E7D32" />
            <Text style={styles.loadingText}>
              Syncing barangay collection schedules and assigned routes...
            </Text>
          </View>
        ) : errorMessage ? (
          <View style={styles.emptyCard}>
            <View style={[styles.emptyIconCircle, { backgroundColor: "#FFEBEE" }]}>
              <MaterialCommunityIcons
                name="alert-circle-outline"
                size={36}
                color="#C62828"
              />
            </View>
            <Text style={styles.emptyTitle}>Unable to Load Schedule</Text>
            <Text style={styles.emptySub}>{errorMessage}</Text>
            <TouchableOpacity style={styles.emptyRefreshBtn} onPress={() => loadSchedulesAndRoutes(false)}>
              <MaterialCommunityIcons name="refresh" size={16} color="#FFFFFF" />
              <Text style={styles.emptyRefreshText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : viewMode === "days" ? (
          /* ========================================================
             MODE 1: MONDAY TO SUNDAY VIEW
             ======================================================== */
          <View style={styles.scheduleCardsList}>
            {DAYS_OF_WEEK.map((dayName) => {
              const daySchedules = schedules.filter((item) => {
                const itemDay = getDayFromItem(item);
                return itemDay.toLowerCase() === dayName.toLowerCase();
              });

              const hasSchedules = daySchedules.length > 0;

              return (
                <View
                  key={dayName}
                  style={[
                    styles.dayWeekCard,
                    hasSchedules ? styles.dayWeekCardActive : styles.dayWeekCardMuted,
                  ]}
                >
                  <View style={styles.dayWeekHeader}>
                    <View style={styles.dayTitleRow}>
                      <View
                        style={[
                          styles.dayPill,
                          hasSchedules ? styles.dayPillActive : styles.dayPillMuted,
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={hasSchedules ? "calendar-check" : "calendar-blank"}
                          size={18}
                          color={hasSchedules ? "#2E7D32" : "#9E9E9E"}
                        />
                        <Text
                          style={[
                            styles.dayPillText,
                            hasSchedules ? styles.dayPillTextActive : styles.dayPillTextMuted,
                          ]}
                        >
                          {dayName}
                        </Text>
                      </View>
                    </View>

                    <Text
                      style={[
                        styles.dayRunCount,
                        hasSchedules ? styles.dayRunCountActive : styles.dayRunCountMuted,
                      ]}
                    >
                      {hasSchedules
                        ? `${daySchedules.length} collection run${daySchedules.length > 1 ? "s" : ""}`
                        : "No collection"}
                    </Text>
                  </View>

                  {hasSchedules ? (
                    <View style={styles.dayRunsContainer}>
                      {daySchedules.map((run, rIdx) => {
                        const rawStatus = safeString(run.collection_status || run.status, "scheduled");
                        const isCompleted = rawStatus === "completed";
                        const isInProgress = rawStatus === "in_progress";
                        const startTime = formatTime12(run.start_time || run.pickup_time);
                        const endTime = run.end_time ? formatTime12(run.end_time) : "10:00 AM";

                        return (
                          <View
                            key={`${String(run.id)}-${dayName}-${rIdx}`}
                            style={[
                              styles.runItemBlock,
                              rIdx > 0 && styles.runItemBorder,
                            ]}
                          >
                            <View style={styles.runItemTopRow}>
                              <View style={styles.timeTag}>
                                <MaterialCommunityIcons
                                  name="clock-outline"
                                  size={14}
                                  color="#2E7D32"
                                />
                                <Text style={styles.timeTagText}>
                                  {startTime} – {endTime}
                                </Text>
                              </View>

                              <View
                                style={[
                                  styles.statusBadge,
                                  isCompleted
                                    ? styles.statusBadgeCompleted
                                    : isInProgress
                                      ? styles.statusBadgeInProgress
                                      : styles.statusBadgeScheduled,
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.statusBadgeText,
                                    isCompleted
                                      ? styles.statusTextCompleted
                                      : isInProgress
                                        ? styles.statusTextInProgress
                                        : styles.statusTextScheduled,
                                  ]}
                                >
                                  {formatStatusLabel(rawStatus)}
                                </Text>
                              </View>
                            </View>

                            {renderRouteAndTruckDetails(run, false)}

                            {run.notes ? (
                              <Text style={styles.runNotesText} numberOfLines={2}>
                                Note: {safeString(run.notes)}
                              </Text>
                            ) : null}
                          </View>
                        );
                      })}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : viewMode === "date" ? (
          /* ========================================================
             MODE 2: BY DATE VIEW
             ======================================================== */
          schedules.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconCircle}>
                <MaterialCommunityIcons
                  name="calendar-blank-outline"
                  size={36}
                  color="#4A7C59"
                />
              </View>
              <Text style={styles.emptyTitle}>No Scheduled Dates</Text>
              <Text style={styles.emptySub}>
                There is currently no garbage collection schedule listed for{" "}
                {selectedBarangayName} on the official web calendar.
              </Text>
              <TouchableOpacity style={styles.emptyRefreshBtn} onPress={handleRefresh}>
                <MaterialCommunityIcons name="refresh" size={16} color="#FFFFFF" />
                <Text style={styles.emptyRefreshText}>Check for Updates</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.scheduleCardsList}>
              {schedules.map((item, idx) => {
                const rawStatus = safeString(item.collection_status || item.status, "scheduled");
                const isCompleted = rawStatus === "completed";
                const isInProgress = rawStatus === "in_progress";
                const displayDate =
                  item.collection_date || item.date
                    ? formatDateDisplay(item.collection_date || item.date)
                    : "Open Schedule";
                const startTime = formatTime12(item.start_time || item.pickup_time);
                const endTime = item.end_time ? formatTime12(item.end_time) : "10:00 AM";
                const dayLabel = getDayFromItem(item);

                return (
                  <View
                    key={`${String(item.id)}-date-${idx}`}
                    style={[
                      styles.scheduleItemCard,
                      isCompleted && styles.completedCard,
                      isInProgress && styles.inProgressCard,
                    ]}
                  >
                    <View style={styles.scheduleItemTopRow}>
                      <View style={styles.cardLeft}>
                        <View
                          style={[
                            styles.dateCalendarBadge,
                            isCompleted && styles.dateBadgeCompleted,
                            isInProgress && styles.dateBadgeInProgress,
                          ]}
                        >
                          <MaterialCommunityIcons
                            name="calendar"
                            size={18}
                            color={
                              isCompleted
                                ? "#689F38"
                                : isInProgress
                                  ? "#E65100"
                                  : "#2E7D32"
                            }
                          />
                          <Text
                            style={[
                              styles.dateBadgeText,
                              isCompleted && styles.dateBadgeTextCompleted,
                              isInProgress && styles.dateBadgeTextInProgress,
                            ]}
                          >
                            {dayLabel.slice(0, 3).toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.metaLeft}>
                          <Text style={styles.dateMainTitle}>{displayDate}</Text>
                          <Text style={styles.daySubLabel}>
                            {dayLabel} • {extractBarangayName(item, selectedBarangayName)}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.cardRight}>
                        <View style={styles.timeTag}>
                          <MaterialCommunityIcons
                            name="clock-outline"
                            size={13}
                            color="#2E7D32"
                          />
                          <Text style={styles.timeTagText}>
                            {startTime} – {endTime}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.statusBadge,
                            isCompleted
                              ? styles.statusBadgeCompleted
                              : isInProgress
                                ? styles.statusBadgeInProgress
                                : styles.statusBadgeScheduled,
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusBadgeText,
                              isCompleted
                                ? styles.statusTextCompleted
                                : isInProgress
                                  ? styles.statusTextInProgress
                                  : styles.statusTextScheduled,
                            ]}
                          >
                            {formatStatusLabel(rawStatus)}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {renderRouteAndTruckDetails(item, false)}

                    {item.notes ? (
                      <Text style={styles.scheduleNotes} numberOfLines={2}>
                        Note: {safeString(item.notes)}
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          )
        ) : (
          /* ========================================================
             MODE 3: COLLECTION ROUTES & LIVE TRUCK DISPATCH VIEW
             ======================================================== */
          collectionRoutes.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIconCircle}>
                <MaterialCommunityIcons
                  name="map-marker-path"
                  size={36}
                  color="#4A7C59"
                />
              </View>
              <Text style={styles.emptyTitle}>No Route Runs Found</Text>
              <Text style={styles.emptySub}>
                No active collection route records were returned for {selectedBarangayName}.
              </Text>
              <TouchableOpacity style={styles.emptyRefreshBtn} onPress={handleRefresh}>
                <MaterialCommunityIcons name="refresh" size={16} color="#FFFFFF" />
                <Text style={styles.emptyRefreshText}>Reload Routes</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.scheduleCardsList}>
              {collectionRoutes.map((routeItem, rIdx) => {
                const rawStatus = safeString(
                  routeItem.collection_status || routeItem.status,
                  "scheduled"
                );
                const isCompleted = rawStatus === "completed";
                const isInProgress = rawStatus === "in_progress";
                const routeTitle = extractRouteName(routeItem, activeRouteNumber);
                const routeBarangayLabel = extractBarangayName(
                  routeItem,
                  selectedBarangayName
                );

                return (
                  <View
                    key={`${String(routeItem.id)}-route-${rIdx}`}
                    style={[
                      styles.scheduleItemCard,
                      isCompleted && styles.completedCard,
                      isInProgress && styles.inProgressCard,
                    ]}
                  >
                    <View style={styles.scheduleItemTopRow}>
                      <View style={styles.cardLeft}>
                        <View
                          style={[
                            styles.dateCalendarBadge,
                            isCompleted && styles.dateBadgeCompleted,
                            isInProgress && styles.dateBadgeInProgress,
                          ]}
                        >
                          <MaterialCommunityIcons
                            name="truck-fast"
                            size={20}
                            color={
                              isCompleted
                                ? "#689F38"
                                : isInProgress
                                  ? "#E65100"
                                  : "#2E7D32"
                            }
                          />
                        </View>
                        <View style={styles.metaLeft}>
                          <Text style={styles.dateMainTitle}>{routeTitle}</Text>
                          <Text style={styles.daySubLabel}>{routeBarangayLabel}</Text>
                        </View>
                      </View>

                      <View
                        style={[
                          styles.statusBadge,
                          isCompleted
                            ? styles.statusBadgeCompleted
                            : isInProgress
                              ? styles.statusBadgeInProgress
                              : styles.statusBadgeScheduled,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            isCompleted
                              ? styles.statusTextCompleted
                              : isInProgress
                                ? styles.statusTextInProgress
                                : styles.statusTextScheduled,
                          ]}
                        >
                          {formatStatusLabel(rawStatus)}
                        </Text>
                      </View>
                    </View>

                    {renderRouteAndTruckDetails(routeItem, true)}

                    {routeItem.notes ? (
                      <Text style={styles.scheduleNotes} numberOfLines={2}>
                        {safeString(routeItem.notes)}
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          )
        )}

        {/* BOTTOM NOTICE CARD */}
        <View style={styles.noticeCard}>
          <View style={styles.noticeIconBox}>
            <MaterialCommunityIcons name="clock-alert-outline" size={24} color="#2E7D32" />
          </View>
          <View style={styles.noticeTextContainer}>
            <Text style={styles.noticeTitle}>Collection Guidelines</Text>
            <Text style={styles.noticeBody}>
              Scheduled collection time indicates the planned barangay collection window. Please segregate waste properly and place tied bins at your designated pickup point 30 minutes before pickup.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* 5-TAB RESIDENT BOTTOM HOTBAR */}
      <ResidentHotbar activeTab="schedule" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FBFDFB",
    paddingTop: 45,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF5ED",
    backgroundColor: "#FFFFFF",
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F2F7F1",
    justifyContent: "center",
    alignItems: "center",
  },
  screenTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#1E331B",
  },
  calendarActionButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F2F7F1",
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 95,
  },
  toggleContainer: {
    flexDirection: "row",
    backgroundColor: "#E8F5E9",
    borderRadius: 14,
    padding: 4,
    marginBottom: 14,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
  },
  toggleBtnActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  toggleBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4A6B46",
  },
  toggleBtnTextActive: {
    color: "#1E5822",
    fontWeight: "800",
  },
  selectorSection: {
    marginBottom: 14,
  },
  selectorLabel: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#5C6B59",
    textTransform: "uppercase",
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  activeBanner: {
    backgroundColor: "#EAF6E9",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#CCE8CB",
    marginBottom: 14,
  },
  bannerTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  bannerIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  bannerText: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 10.5,
    color: "#476A44",
    fontWeight: "700",
    textTransform: "uppercase",
  },
  bannerBarangay: {
    fontSize: 16,
    fontWeight: "900",
    color: "#1E5822",
  },
  bannerRouteSub: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2E7D32",
    marginTop: 1,
  },
  refreshIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  bannerTelemetryBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#D5ECD4",
    gap: 8,
  },
  bannerTelemetryInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 6,
  },
  bannerTelemetryText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#1E4620",
    flex: 1,
  },
  mapTogglePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#2E7D32",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  mapTogglePillText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  mapSectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#D0E7CE",
    marginBottom: 16,
  },
  mapSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    gap: 8,
  },
  mapSectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  mapSectionTitle: {
    fontSize: 12.5,
    fontWeight: "800",
    color: "#1E331B",
    flexShrink: 1,
  },
  mapSectionTag: {
    fontSize: 11,
    fontWeight: "800",
    color: "#15803D",
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  scheduleHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#1E331B",
  },
  scheduleCount: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#2E7D32",
    backgroundColor: "#E8F8EE",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  scheduleCardsList: {
    gap: 10,
    marginBottom: 18,
  },

  /* MONDAY TO SUNDAY VIEW STYLES */
  dayWeekCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  dayWeekCardActive: {
    backgroundColor: "#FFFFFF",
    borderColor: "#CCE3C9",
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  dayWeekCardMuted: {
    backgroundColor: "#F7FAF6",
    borderColor: "#E6ECE5",
    opacity: 0.85,
  },
  dayWeekHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dayTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  dayPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dayPillActive: {},
  dayPillMuted: {},
  dayPillText: {
    fontSize: 15,
    fontWeight: "800",
  },
  dayPillTextActive: {
    color: "#1E331B",
  },
  dayPillTextMuted: {
    color: "#757575",
  },
  dayRunCount: {
    fontSize: 12,
    fontWeight: "600",
  },
  dayRunCountActive: {
    color: "#2E7D32",
    fontWeight: "700",
  },
  dayRunCountMuted: {
    color: "#9E9E9E",
  },
  dayRunsContainer: {
    borderTopWidth: 1,
    borderTopColor: "#EEF5ED",
    backgroundColor: "#FAFCF9",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  runItemBlock: {
    paddingVertical: 8,
  },
  runItemTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  runItemBorder: {
    borderTopWidth: 1,
    borderTopColor: "#EAEFE9",
    marginTop: 6,
    paddingTop: 10,
  },
  runNotesText: {
    fontSize: 11,
    color: "#6B8268",
    marginTop: 6,
    fontStyle: "italic",
  },

  /* ENRICHED ROUTE & TRUCK DETAILS GRID */
  detailGridBox: {
    backgroundColor: "#F3F8F2",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#E0EDE0",
    gap: 5,
  },
  detailRowItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  detailKeyText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#4A6647",
    width: 114,
  },
  detailValText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#1E331B",
    flex: 1,
  },
  stopsContainer: {
    marginTop: 4,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#DCEBDD",
  },
  stopsHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 6,
  },
  stopsHeaderText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#1E5822",
  },
  stopsChipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
  },
  stopChip: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CFE3CE",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 7,
  },
  stopChipActive: {
    backgroundColor: "#2E7D32",
    borderColor: "#2E7D32",
  },
  stopChipText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#335431",
  },
  stopChipTextActive: {
    color: "#FFFFFF",
  },
  gpsTelemetryBox: {
    marginTop: 4,
    backgroundColor: "#DCFCE7",
    borderRadius: 9,
    paddingVertical: 6,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderColor: "#86EFAC",
  },
  gpsTelemetryLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  gpsPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#16A34A",
  },
  gpsTelemetryTitle: {
    fontSize: 10.5,
    fontWeight: "900",
    color: "#14532D",
  },
  gpsTelemetryCoords: {
    fontSize: 11,
    fontWeight: "700",
    color: "#166534",
    marginTop: 1,
  },
  gpsEtaText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#15803D",
    marginTop: 2,
  },
  gpsStandbyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 3,
  },
  gpsStandbyText: {
    fontSize: 10.5,
    fontWeight: "600",
    color: "#607D8B",
    flex: 1,
  },

  /* BY DATE & ROUTES VIEW STYLES */
  scheduleItemCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5ECE4",
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  scheduleItemTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  completedCard: {
    backgroundColor: "#F9FAF9",
    borderColor: "#EBEFEB",
  },
  inProgressCard: {
    borderColor: "#FFCC80",
    backgroundColor: "#FFFDF7",
  },
  cardLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
  },
  dateCalendarBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#E8F5E9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  dateBadgeCompleted: {
    backgroundColor: "#F1F8E9",
  },
  dateBadgeInProgress: {
    backgroundColor: "#FFE0B2",
  },
  dateBadgeText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#2E7D32",
    marginTop: 2,
  },
  dateBadgeTextCompleted: {
    color: "#689F38",
  },
  dateBadgeTextInProgress: {
    color: "#E65100",
  },
  metaLeft: {
    flex: 1,
  },
  dateMainTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1E331B",
  },
  daySubLabel: {
    fontSize: 12,
    color: "#688264",
    fontWeight: "600",
    marginTop: 2,
  },
  scheduleNotes: {
    fontSize: 11,
    color: "#7A8D78",
    marginTop: 6,
    fontStyle: "italic",
  },
  cardRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  timeTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  timeTagText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#1E331B",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeScheduled: {
    backgroundColor: "#E8F8EE",
  },
  statusBadgeCompleted: {
    backgroundColor: "#EEEEEE",
  },
  statusBadgeInProgress: {
    backgroundColor: "#FFE0B2",
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  statusTextScheduled: {
    color: "#2E7D32",
  },
  statusTextCompleted: {
    color: "#757575",
  },
  statusTextInProgress: {
    color: "#E65100",
  },
  loadingBox: {
    paddingVertical: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: "#688264",
    fontWeight: "500",
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 26,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5ECE4",
    marginBottom: 20,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#F1F7F0",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1E331B",
  },
  emptySub: {
    fontSize: 12,
    color: "#7A9177",
    marginTop: 4,
    textAlign: "center",
    lineHeight: 17,
    maxWidth: 280,
  },
  emptyRefreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#2E7D32",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    marginTop: 14,
  },
  emptyRefreshText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  noticeCard: {
    flexDirection: "row",
    backgroundColor: "#EAF6E9",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#CCE8CB",
    alignItems: "center",
  },
  noticeIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  noticeTextContainer: {
    flex: 1,
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1E5822",
    marginBottom: 2,
  },
  noticeBody: {
    fontSize: 12,
    color: "#476A44",
    lineHeight: 16,
    fontWeight: "500",
  },
});
