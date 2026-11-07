import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import BarangayPickerModal, {
  BARANGAYS_1_TO_40,
} from "../components/BarangayPickerModal";
import ResidentHotbar from "../components/ResidentHotbar";
import {
  calculateRouteScheduleClient,
  createCollectionRoute,
  deleteCollectionRoute,
  fetchCollectionRouteOptions,
  fetchCollectionRoutes,
  fetchSchedules,
  parseTimeInputTo24,
  updateCollectionRoute,
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

const ROUTE_STATUS_OPTIONS = [
  { key: "scheduled", label: "Scheduled", color: "#2E7D32", bg: "#E8F8EE", icon: "calendar-clock" },
  { key: "ongoing", label: "Ongoing", color: "#E65100", bg: "#FFF3E0", icon: "truck-fast" },
  { key: "completed", label: "Completed", color: "#1565C0", bg: "#E3F2FD", icon: "check-decagram" },
  { key: "delayed", label: "Delayed", color: "#C62828", bg: "#FFEBEE", icon: "clock-alert" },
];

const START_LOCATION_PRESETS = [
  "Barangay Hall",
  "CLENRO Motorpool Depot",
  "Poblacion Central Terminal",
  "Cogon Market North Gate",
];

const END_LOCATION_PRESETS = [
  "Sanitation Facility",
  "Pagalungan Sanitary Landfill",
  "Materials Recovery Facility (MRF)",
  "Eco-Sanitation Transfer Station",
];

const START_TIME_PRESETS = [
  { label: "6:00 AM", value: "06:00" },
  { label: "7:30 AM", value: "07:30" },
  { label: "9:00 AM", value: "09:00" },
  { label: "1:00 PM", value: "13:00" },
  { label: "10:30 PM", value: "22:30" },
];

function getManilaTodayString() {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const d = parts.find((p) => p.type === "day")?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch { }
  return new Date().toISOString().slice(0, 10);
}

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
    (item && typeof item.assigned_vehicle === "object" && item.assigned_vehicle) ||
    (item && typeof item.assigned_truck === "object" && item.assigned_truck) ||
    (item && typeof item.truck === "object" && item.truck) ||
    fallbackTruck;

  if (!truckObj) {
    if (item && typeof item.truck === "string") return item.truck;
    return "TRK-02 (KAL-102)";
  }

  const num = safeString(truckObj.truck_number, "");
  const plate = safeString(truckObj.plate_number, "");
  if (num && plate) return `${num} (${plate})`;
  if (plate) return plate;
  if (num) return num;
  return safeString(truckObj.name, "TRK-02 (KAL-102)");
}

function extractPersonnelName(item) {
  if (!item) return "John Driver";
  if (item.assigned_personnel && typeof item.assigned_personnel === "object" && item.assigned_personnel.name) {
    return safeString(item.assigned_personnel.name, "John Driver");
  }
  if (item.assigned_vehicle && typeof item.assigned_vehicle === "object" && item.assigned_vehicle.driver_name) {
    return safeString(item.assigned_vehicle.driver_name, "John Driver");
  }
  if (item.assigned_truck && typeof item.assigned_truck === "object" && item.assigned_truck.driver_name) {
    return safeString(item.assigned_truck.driver_name, "John Driver");
  }
  return "John Driver";
}

function formatTime12(timeStr) {
  if (!timeStr) return "9:00 AM";
  const clean = safeString(timeStr, "09:00").trim();
  if (/AM|PM/i.test(clean)) return clean;
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
  if (dayRaw) return dayRaw;
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

function normalizeStatusKey(statusRaw) {
  const s = safeString(statusRaw, "scheduled").toLowerCase().trim();
  if (s === "ongoing" || s === "in_progress" || s === "on_route") return "ongoing";
  if (s === "completed" || s === "done") return "completed";
  if (s === "delayed" || s === "late") return "delayed";
  return "scheduled";
}

function formatStatusLabel(statusRaw) {
  const key = normalizeStatusKey(statusRaw);
  if (key === "ongoing") return "Ongoing";
  if (key === "completed") return "Completed";
  if (key === "delayed") return "Delayed";
  return "Scheduled";
}

function getStatusMeta(statusRaw) {
  const key = normalizeStatusKey(statusRaw);
  return ROUTE_STATUS_OPTIONS.find((o) => o.key === key) || ROUTE_STATUS_OPTIONS[0];
}

function normalizeScheduleOrRouteItem(raw, fallbackBarangayName) {
  if (!raw || typeof raw !== "object") return null;
  const barangayName = extractBarangayName(raw, fallbackBarangayName);
  const routeNumber = Number(raw.route_number) || 1;
  const routeName = extractRouteName(raw, routeNumber);
  const statusStr = normalizeStatusKey(raw.collection_status || raw.status || "scheduled");
  const collectionDate = safeString(raw.collection_date || raw.date, getManilaTodayString()).slice(0, 10);
  const startTime = safeString(raw.start_time || raw.pickup_time, "09:00").slice(0, 5);
  const startLocation = safeString(raw.start_location, "Barangay Hall");
  const endLocation = safeString(raw.end_location, "Sanitation Facility");
  const distanceKm = Number(raw.distance_km) || 15;
  const stopDurationMins = Number(raw.stop_duration_minutes) || 40;

  let rawStops = [];
  if (Array.isArray(raw.collection_stops) && raw.collection_stops.length > 0) {
    rawStops = raw.collection_stops;
  } else if (Array.isArray(raw.route_stops) && raw.route_stops.length > 0) {
    rawStops = raw.route_stops;
  } else {
    rawStops = [
      { stop_order: 1, name: "First Collection Point", duration_minutes: stopDurationMins },
      { stop_order: 2, name: "Second Collection Point", duration_minutes: stopDurationMins },
      { stop_order: 3, name: "Final Collection Point", duration_minutes: stopDurationMins },
    ];
  }

  const calc = calculateRouteScheduleClient({
    startLocation,
    endLocation,
    startTime,
    stops: rawStops,
    distanceKm,
    defaultStopDurationMinutes: stopDurationMins,
    explicitTotalMinutes: raw.estimated_duration_minutes ? Number(raw.estimated_duration_minutes) : null,
  });

  return {
    ...raw,
    id: raw.id ?? `${barangayName}-${collectionDate}-${startTime}`,
    barangay_name: barangayName,
    route_number: routeNumber,
    route_name: routeName,
    start_location: startLocation,
    end_location: endLocation,
    distance_km: distanceKm,
    stop_duration_minutes: stopDurationMins,
    collection_date: collectionDate,
    date: collectionDate,
    start_time: calc.start_time_24,
    start_time_formatted: calc.start_time_formatted,
    pickup_time: calc.start_time_24,
    end_time: calc.estimated_arrival_24,
    estimated_arrival_time: calc.estimated_arrival_24,
    estimated_arrival_formatted: calc.estimated_arrival_formatted,
    estimated_duration_minutes: calc.estimated_duration_minutes,
    estimated_duration: raw.estimated_duration || calc.estimated_duration,
    collection_stops: calc.stops,
    route_stops: calc.stops.map((s) => s.name),
    timeline: Array.isArray(raw.timeline) && raw.timeline.length > 0 ? raw.timeline : calc.timeline,
    collection_status: statusStr,
    status: statusStr,
    notes: safeString(raw.notes, ""),
  };
}

export default function Schedule() {
  const router = useRouter();

  const [selectedBarangay, setSelectedBarangay] = useState(BARANGAYS_1_TO_40[11]); // Barangay 12
  const [viewMode, setViewMode] = useState("routes"); // "routes" | "days" | "date"
  const [statusFilter, setStatusFilter] = useState("all");
  const [schedules, setSchedules] = useState([]);
  const [collectionRoutes, setCollectionRoutes] = useState([]);
  const [vehiclesList, setVehiclesList] = useState([]);
  const [personnelList, setPersonnelList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [reminderActive, setReminderActive] = useState(false);

  // Route Management Modal State (Create / Edit Route)
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRouteId, setEditingRouteId] = useState(null);
  const [formRouteName, setFormRouteName] = useState("");
  const [formCollectionDate, setFormCollectionDate] = useState(getManilaTodayString());
  const [formStartTime, setFormStartTime] = useState("09:00");
  const [formStartLocation, setFormStartLocation] = useState("Barangay Hall");
  const [formEndLocation, setFormEndLocation] = useState("Sanitation Facility");
  const [formDistanceKm, setFormDistanceKm] = useState("15");
  const [formStopDurationMins, setFormStopDurationMins] = useState("40");
  const [formStops, setFormStops] = useState([
    { name: "First Collection Point", duration_minutes: 40 },
    { name: "Second Collection Point", duration_minutes: 40 },
    { name: "Final Collection Point", duration_minutes: 40 },
  ]);
  const [newStopName, setNewStopName] = useState("");
  const [newStopDuration, setNewStopDuration] = useState("40");
  const [formTruckId, setFormTruckId] = useState(4);
  const [formPersonnelId, setFormPersonnelId] = useState(10);
  const [formStatus, setFormStatus] = useState("scheduled");
  const [formNotes, setFormNotes] = useState("");
  const [formError, setFormError] = useState("");
  const [savingRoute, setSavingRoute] = useState(false);

  const selectedBarangayName = extractBarangayName(selectedBarangay, "Barangay 12");
  const selectedBarangayId = Number(selectedBarangay?.id) || 12;

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

  useEffect(() => {
    AsyncStorage.getItem(`@schedule_reminder_${selectedBarangayId}`)
      .then((val) => setReminderActive(val === "true"))
      .catch(() => { });
  }, [selectedBarangayId]);

  const loadRouteOptions = useCallback(async () => {
    try {
      const res = await fetchCollectionRouteOptions();
      if (res && res.success) {
        if (Array.isArray(res.vehicles) && res.vehicles.length > 0) {
          setVehiclesList(res.vehicles);
        }
        if (Array.isArray(res.personnel) && res.personnel.length > 0) {
          setPersonnelList(res.personnel);
        }
      }
    } catch { }
  }, []);

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
            .map((item) => normalizeScheduleOrRouteItem(item, selectedBarangayName))
            .filter(Boolean);
          setSchedules(normalized);
        } else {
          setSchedules([]);
        }

        if (routesRes && routesRes.success && Array.isArray(routesRes.routes)) {
          const normalizedRoutes = routesRes.routes
            .map((item) => normalizeScheduleOrRouteItem(item, selectedBarangayName))
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
    loadRouteOptions();
    loadSchedulesAndRoutes();
  }, [loadRouteOptions, loadSchedulesAndRoutes]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSchedulesAndRoutes(true);
    setRefreshing(false);
  };

  const toggleReminder = async () => {
    const nextState = !reminderActive;
    setReminderActive(nextState);
    try {
      await AsyncStorage.setItem(`@schedule_reminder_${selectedBarangayId}`, String(nextState));
    } catch { }
    Alert.alert(
      nextState ? "Push Reminder Enabled" : "Reminder Disabled",
      nextState
        ? `You will receive a push notification alert before scheduled collections in ${selectedBarangayName}.`
        : `Collection reminders turned off for ${selectedBarangayName}.`
    );
  };

  // Real-Time Automatic Schedule & Timeline Calculator inside the Create/Edit Modal
  const liveFormCalculation = useMemo(() => {
    return calculateRouteScheduleClient({
      startLocation: formStartLocation || "Barangay Hall",
      endLocation: formEndLocation || "Sanitation Facility",
      startTime: formStartTime || "09:00",
      stops: formStops,
      distanceKm: parseFloat(formDistanceKm) || 15,
      defaultStopDurationMinutes: parseInt(formStopDurationMins, 10) || 40,
    });
  }, [
    formStartLocation,
    formEndLocation,
    formStartTime,
    formStops,
    formDistanceKm,
    formStopDurationMins,
  ]);

  const openCreateRouteModal = () => {
    setEditingRouteId(null);
    setFormRouteName(`${selectedBarangayName} Collection Route`);
    setFormCollectionDate(getManilaTodayString());
    setFormStartTime("09:00");
    setFormStartLocation("Barangay Hall");
    setFormEndLocation("Sanitation Facility");
    setFormDistanceKm("15");
    setFormStopDurationMins("40");
    setFormStops([
      { name: "First Collection Point", duration_minutes: 40 },
      { name: "Second Collection Point", duration_minutes: 40 },
      { name: "Final Collection Point", duration_minutes: 40 },
    ]);
    setNewStopName("");
    setNewStopDuration("40");
    setFormTruckId(vehiclesList[0]?.id || 4);
    setFormPersonnelId(personnelList[0]?.id || 10);
    setFormStatus("scheduled");
    setFormNotes("");
    setFormError("");
    setModalVisible(true);
  };

  const openEditRouteModal = (routeItem) => {
    setEditingRouteId(routeItem.id);
    setFormRouteName(safeString(routeItem.route_name, `${selectedBarangayName} Collection Route`));
    setFormCollectionDate(safeString(routeItem.collection_date, getManilaTodayString()).slice(0, 10));
    setFormStartTime(safeString(routeItem.start_time, "09:00").slice(0, 5));
    setFormStartLocation(safeString(routeItem.start_location, "Barangay Hall"));
    setFormEndLocation(safeString(routeItem.end_location, "Sanitation Facility"));
    setFormDistanceKm(String(routeItem.distance_km || 15));
    setFormStopDurationMins(String(routeItem.stop_duration_minutes || 40));

    const existingStops =
      Array.isArray(routeItem.collection_stops) && routeItem.collection_stops.length > 0
        ? routeItem.collection_stops.map((s) => ({
          name: safeString(s.name || s.location_name || s),
          duration_minutes: Number(s.duration_minutes) || 40,
        }))
        : [
          { name: "First Collection Point", duration_minutes: 40 },
          { name: "Second Collection Point", duration_minutes: 40 },
          { name: "Final Collection Point", duration_minutes: 40 },
        ];
    setFormStops(existingStops);
    setNewStopName("");
    setNewStopDuration(String(routeItem.stop_duration_minutes || 40));
    setFormTruckId(Number(routeItem.truck_id || routeItem.assigned_vehicle?.id || vehiclesList[0]?.id || 4));
    setFormPersonnelId(
      Number(routeItem.assigned_personnel_id || routeItem.assigned_personnel?.id || personnelList[0]?.id || 10)
    );
    setFormStatus(normalizeStatusKey(routeItem.status || "scheduled"));
    setFormNotes(safeString(routeItem.notes, ""));
    setFormError("");
    setModalVisible(true);
  };

  const handleAddStopToForm = () => {
    const trimmed = newStopName.trim();
    if (!trimmed) {
      setFormError("Please enter a collection stop name before adding.");
      return;
    }
    const dur = Math.max(5, parseInt(newStopDuration, 10) || parseInt(formStopDurationMins, 10) || 40);
    setFormStops((prev) => [...prev, { name: trimmed, duration_minutes: dur }]);
    setNewStopName("");
    setFormError("");
  };

  const handleRemoveStopFromForm = (index) => {
    if (formStops.length <= 1) {
      setFormError("A collection route must have at least 1 collection stop.");
      return;
    }
    setFormStops((prev) => prev.filter((_, idx) => idx !== index));
    setFormError("");
  };

  const handleMoveStop = (index, direction) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= formStops.length) return;
    setFormStops((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIdx];
      copy[targetIdx] = temp;
      return copy;
    });
  };

  const handleUpdateStopDuration = (index, delta) => {
    setFormStops((prev) =>
      prev.map((item, idx) =>
        idx === index
          ? { ...item, duration_minutes: Math.max(5, (Number(item.duration_minutes) || 40) + delta) }
          : item
      )
    );
  };

  const handleApplyStopDurationToAll = (valStr) => {
    setFormStopDurationMins(valStr);
    const parsed = parseInt(valStr, 10);
    if (!isNaN(parsed) && parsed >= 5) {
      setFormStops((prev) => prev.map((s) => ({ ...s, duration_minutes: parsed })));
    }
  };

  const handleSaveRoute = async () => {
    setFormError("");

    const trimmedStart = formStartLocation.trim();
    const trimmedEnd = formEndLocation.trim();
    if (!trimmedStart) {
      setFormError("Start Route location is required.");
      return;
    }
    if (!trimmedEnd) {
      setFormError("End Route destination is required.");
      return;
    }
    const validStops = formStops.filter((s) => s.name && s.name.trim().length > 0);
    if (validStops.length === 0) {
      setFormError("Please include at least one collection stop.");
      return;
    }

    const parsed24Time = parseTimeInputTo24(formStartTime);
    if (!parsed24Time) {
      setFormError("Invalid starting time. Use HH:MM (e.g. 09:00) or 9:00 AM.");
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(formCollectionDate.trim())) {
      setFormError("Invalid collection date. Use YYYY-MM-DD format.");
      return;
    }

    const payload = {
      route_name: formRouteName.trim() || `${selectedBarangayName} Collection Route`,
      truck_id: Number(formTruckId) || 4,
      assigned_personnel_id: Number(formPersonnelId) || null,
      barangay_id: selectedBarangayId,
      start_location: trimmedStart,
      end_location: trimmedEnd,
      collection_stops: validStops.map((s, idx) => ({
        stop_order: idx + 1,
        name: s.name.trim(),
        duration_minutes: Number(s.duration_minutes) || 40,
      })),
      distance_km: Math.max(0.5, parseFloat(formDistanceKm) || 15),
      stop_duration_minutes: Math.max(5, parseInt(formStopDurationMins, 10) || 40),
      estimated_duration_minutes: liveFormCalculation.estimated_duration_minutes,
      collection_date: formCollectionDate.trim(),
      start_time: parsed24Time,
      status: formStatus,
      notes: formNotes.trim() || null,
    };

    try {
      setSavingRoute(true);
      let res;
      if (editingRouteId) {
        res = await updateCollectionRoute(editingRouteId, payload);
      } else {
        res = await createCollectionRoute(payload);
      }

      if (res && res.success) {
        setModalVisible(false);
        await loadSchedulesAndRoutes(true);
      } else {
        setFormError(res?.message || "Failed to save collection route.");
      }
    } catch (err) {
      setFormError(err?.message || "Failed to save collection route. Check your connection.");
    } finally {
      setSavingRoute(false);
    }
  };

  const handleQuickStatusUpdate = async (routeItem, newStatus) => {
    try {
      const res = await updateCollectionRoute(routeItem.id, { status: newStatus });
      if (res && res.success) {
        await loadSchedulesAndRoutes(true);
      }
    } catch (err) {
      Alert.alert("Update Error", err?.message || "Unable to update route status.");
    }
  };

  const handleDeleteRoute = async (routeItem) => {
    const confirmDelete = async () => {
      try {
        const res = await deleteCollectionRoute(routeItem.id);
        if (res && res.success) {
          await loadSchedulesAndRoutes(true);
        }
      } catch (err) {
        Alert.alert("Delete Error", err?.message || "Could not delete route.");
      }
    };

    if (Platform.OS === "web") {
      await confirmDelete();
      return;
    }

    Alert.alert(
      "Delete Collection Route",
      `Delete route "${extractRouteName(routeItem)}" (${routeItem.start_location} → ${routeItem.end_location})?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: confirmDelete },
      ]
    );
  };

  const filteredRoutes = useMemo(() => {
    if (statusFilter === "all") return collectionRoutes;
    return collectionRoutes.filter((r) => normalizeStatusKey(r.status) === statusFilter);
  }, [collectionRoutes, statusFilter]);

  const featuredRoute = useMemo(() => {
    if (filteredRoutes.length > 0) return filteredRoutes[0];
    if (collectionRoutes.length > 0) return collectionRoutes[0];
    if (schedules.length > 0) return schedules[0];
    const fallbackCalc = calculateRouteScheduleClient({
      startLocation: "Barangay Hall",
      endLocation: "Sanitation Facility",
      startTime: "09:00",
      stops: [
        { name: "First Collection Point", duration_minutes: 40 },
        { name: "Second Collection Point", duration_minutes: 40 },
        { name: "Final Collection Point", duration_minutes: 40 },
      ],
      distanceKm: 15,
      defaultStopDurationMinutes: 40,
    });
    return {
      id: "featured-default",
      route_name: `${selectedBarangayName} Collection Route`,
      barangay_name: selectedBarangayName,
      start_location: "Barangay Hall",
      end_location: "Sanitation Facility",
      collection_date: getManilaTodayString(),
      start_time: "09:00",
      start_time_formatted: fallbackCalc.start_time_formatted,
      estimated_duration: fallbackCalc.estimated_duration,
      estimated_duration_minutes: fallbackCalc.estimated_duration_minutes,
      estimated_arrival_formatted: fallbackCalc.estimated_arrival_formatted,
      collection_stops: fallbackCalc.stops,
      timeline: fallbackCalc.timeline,
      status: "scheduled",
    };
  }, [filteredRoutes, collectionRoutes, schedules, selectedBarangayName]);

  const renderTimelineBlock = (timelineItems = []) => {
    if (!Array.isArray(timelineItems) || timelineItems.length === 0) return null;

    return (
      <View style={styles.timelineCardBox}>
        <View style={styles.timelineHeaderRow}>
          <MaterialCommunityIcons name="timeline-clock-outline" size={16} color="#1E5822" />
          <Text style={styles.timelineHeaderTitle}>Collection Route Timeline (PH Time)</Text>
        </View>

        <View style={styles.timelineList}>
          {timelineItems.map((stepItem, idx) => {
            const isStart = stepItem.type === "start";
            const isEnd = stepItem.type === "end";
            const isLast = idx === timelineItems.length - 1;
            const dotColor = isStart ? "#2E7D32" : isEnd ? "#1565C0" : "#F57C00";

            return (
              <View key={`tl-${idx}-${stepItem.time}`} style={styles.timelineRow}>
                <View style={styles.timelineRailCol}>
                  <View style={[styles.timelineDot, { backgroundColor: dotColor }]}>
                    <MaterialCommunityIcons
                      name={isStart ? "play" : isEnd ? "flag-checkered" : "map-marker"}
                      size={10}
                      color="#FFFFFF"
                    />
                  </View>
                  {!isLast && <View style={styles.timelineLine} />}
                </View>

                <View style={styles.timelineContentCol}>
                  <Text style={styles.timelinePrimaryLine}>
                    <Text style={styles.timelineTimeBold}>{stepItem.time}</Text>
                    {" — "}
                    <Text style={styles.timelineEventLabel}>
                      {isStart
                        ? "Collection Starts"
                        : isEnd
                          ? "Estimated Arrival at Destination"
                          : stepItem.label}
                    </Text>
                  </Text>
                  <Text style={styles.timelineSubLocation}>
                    {isStart
                      ? `Start Location: ${stepItem.location}`
                      : isEnd
                        ? `Destination: ${stepItem.location}`
                        : `Stop #${stepItem.stop_order || idx} • Est. ${stepItem.duration_minutes || 40} mins collection`}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  const renderCompleteRouteCard = (routeItem, idx, allowManagement = true) => {
    const statusMeta = getStatusMeta(routeItem.status || routeItem.collection_status);
    const startTime12 = routeItem.start_time_formatted || formatTime12(routeItem.start_time);
    const arrivalTime12 =
      routeItem.estimated_arrival_formatted || formatTime12(routeItem.estimated_arrival_time || routeItem.end_time);
    const travelDurationLabel = routeItem.estimated_duration || "3 hours";
    const startLoc = safeString(routeItem.start_location, "Barangay Hall");
    const endLoc = safeString(routeItem.end_location, "Sanitation Facility");
    const collectionDate = formatDateDisplay(routeItem.collection_date || routeItem.date) || "Scheduled";
    const personnelName = extractPersonnelName(routeItem);
    const vehicleLabel = extractTruckLabel(routeItem);
    const stopsList = Array.isArray(routeItem.collection_stops) ? routeItem.collection_stops : [];
    const timelineList = Array.isArray(routeItem.timeline) ? routeItem.timeline : [];

    return (
      <View key={`route-card-${routeItem.id}-${idx}`} style={styles.routeMasterCard}>
        {/* TOP HEADER: Route Name, Date & Status Badge */}
        <View style={styles.routeMasterTopRow}>
          <View style={styles.routeMasterTitleWrap}>
            <View style={styles.routeIconAvatar}>
              <MaterialCommunityIcons name="routes" size={20} color="#2E7D32" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.routeMasterTitle} numberOfLines={1}>
                {extractRouteName(routeItem)}
              </Text>
              <Text style={styles.routeMasterSub}>
                {collectionDate} • {extractBarangayName(routeItem, selectedBarangayName)}
              </Text>
            </View>
          </View>

          <View style={[styles.routeStatusPill, { backgroundColor: statusMeta.bg }]}>
            <MaterialCommunityIcons name={statusMeta.icon} size={12} color={statusMeta.color} />
            <Text style={[styles.routeStatusPillText, { color: statusMeta.color }]}>
              {statusMeta.label}
            </Text>
          </View>
        </View>

        {/* START ROUTE -> END ROUTE PROMINENT BANNER */}
        <View style={styles.startEndEndpointsBox}>
          <View style={styles.endpointItemRow}>
            <View style={[styles.endpointBadgeCircle, { backgroundColor: "#E8F8EE" }]}>
              <MaterialCommunityIcons name="map-marker-radius" size={16} color="#2E7D32" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.endpointRoleLabel}>START LOCATION (START ROUTE)</Text>
              <Text style={styles.endpointLocationValue}>{startLoc}</Text>
            </View>
          </View>

          <View style={styles.endpointConnectorBar}>
            <MaterialCommunityIcons name="dots-vertical" size={16} color="#81C784" />
            <Text style={styles.endpointConnectorStopsText}>
              {stopsList.length} Collection {stopsList.length === 1 ? "Stop" : "Stops"} in Order ({routeItem.distance_km || 15} km)
            </Text>
          </View>

          <View style={styles.endpointItemRow}>
            <View style={[styles.endpointBadgeCircle, { backgroundColor: "#E3F2FD" }]}>
              <MaterialCommunityIcons name="flag-checkered" size={16} color="#1565C0" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.endpointRoleLabel}>END LOCATION (DESTINATION)</Text>
              <Text style={styles.endpointLocationValue}>{endLoc}</Text>
            </View>
          </View>
        </View>

        {/* COLLECTION SCHEDULE SUMMARY METRICS */}
        <View style={styles.scheduleMetricsStrip}>
          <View style={styles.scheduleMetricBox}>
            <Text style={styles.scheduleMetricLabel}>Start Time</Text>
            <Text style={styles.scheduleMetricValue}>{startTime12}</Text>
          </View>

          <View style={styles.scheduleMetricDivider} />

          <View style={styles.scheduleMetricBox}>
            <Text style={styles.scheduleMetricLabel}>Estimated Travel Time</Text>
            <Text style={[styles.scheduleMetricValue, { color: "#2E7D32" }]}>
              {travelDurationLabel}
            </Text>
          </View>

          <View style={styles.scheduleMetricDivider} />

          <View style={styles.scheduleMetricBox}>
            <Text style={styles.scheduleMetricLabel}>Estimated Arrival</Text>
            <Text style={[styles.scheduleMetricValue, { color: "#1565C0" }]}>
              {arrivalTime12}
            </Text>
          </View>
        </View>

        {/* ASSIGNED PERSONNEL & VEHICLE */}
        <View style={styles.assignmentInfoRow}>
          <View style={styles.assignmentChip}>
            <MaterialCommunityIcons name="account-hard-hat" size={15} color="#2E7D32" />
            <Text style={styles.assignmentChipText} numberOfLines={1}>
              Personnel: {personnelName}
            </Text>
          </View>

          <View style={styles.assignmentChip}>
            <MaterialCommunityIcons name="truck-check-outline" size={15} color="#1565C0" />
            <Text style={styles.assignmentChipText} numberOfLines={1}>
              Vehicle: {vehicleLabel}
            </Text>
          </View>
        </View>

        {/* ORDERED COLLECTION STOPS CHIPS */}
        {stopsList.length > 0 && (
          <View style={styles.orderedStopsBox}>
            <Text style={styles.orderedStopsTitle}>
              Ordered Collection Points ({stopsList.length}):
            </Text>
            <View style={styles.stopsChipsWrap}>
              {stopsList.map((stopObj, sIdx) => {
                const sName = safeString(stopObj.name || stopObj);
                const sTime = safeString(stopObj.arrival_time, "");
                return (
                  <View key={`stop-chip-${sIdx}-${sName}`} style={styles.stopChip}>
                    <Text style={styles.stopChipText}>
                      {sIdx + 1}. {sName} {sTime ? `(${sTime})` : ""}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* TIMELINE SCHEDULE LAYOUT */}
        {renderTimelineBlock(timelineList)}

        {/* STATUS QUICK SWITCHER & EDIT / DELETE MANAGEMENT */}
        {allowManagement && typeof routeItem.id === "number" && (
          <View style={styles.managementFooter}>
            <View style={styles.quickStatusRow}>
              <Text style={styles.quickStatusLabel}>Status:</Text>
              {ROUTE_STATUS_OPTIONS.map((opt) => {
                const isCurrent = normalizeStatusKey(routeItem.status) === opt.key;
                return (
                  <TouchableOpacity
                    key={`status-btn-${opt.key}`}
                    style={[
                      styles.quickStatusChip,
                      isCurrent && { backgroundColor: opt.color, borderColor: opt.color },
                    ]}
                    onPress={() => handleQuickStatusUpdate(routeItem, opt.key)}
                  >
                    <Text
                      style={[
                        styles.quickStatusChipText,
                        isCurrent && { color: "#FFFFFF", fontWeight: "800" },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.crudButtonsRow}>
              <TouchableOpacity
                style={styles.editRouteBtn}
                onPress={() => openEditRouteModal(routeItem)}
              >
                <MaterialCommunityIcons name="pencil-outline" size={15} color="#1565C0" />
                <Text style={styles.editRouteBtnText}>Edit Route & Time</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.deleteRouteBtn}
                onPress={() => handleDeleteRoute(routeItem)}
              >
                <MaterialCommunityIcons name="trash-can-outline" size={15} color="#C62828" />
                <Text style={styles.deleteRouteBtnText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
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

        <View style={styles.topRightActions}>
          <TouchableOpacity
            style={styles.addRouteTopBtn}
            onPress={openCreateRouteModal}
            accessibilityLabel="Add Collection Route"
          >
            <MaterialCommunityIcons name="plus" size={18} color="#FFFFFF" />
            <Text style={styles.addRouteTopBtnText}>Add Route</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.calendarActionButton}
            onPress={toggleReminder}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialCommunityIcons
              name={reminderActive ? "bell-ring" : "bell-outline"}
              size={20}
              color={reminderActive ? "#2E7D32" : "#455E42"}
            />
          </TouchableOpacity>
        </View>
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
        {/* VIEW MODE TOGGLE */}
        <View style={styles.toggleContainer}>
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
            <Text style={[styles.toggleBtnText, viewMode === "routes" && styles.toggleBtnTextActive]}>
              Routes & Stops
            </Text>
          </TouchableOpacity>

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
            <Text style={[styles.toggleBtnText, viewMode === "days" && styles.toggleBtnTextActive]}>
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
            <Text style={[styles.toggleBtnText, viewMode === "date" && styles.toggleBtnTextActive]}>
              By Date
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

        {/* COLLECTION SCHEDULE OVERVIEW CARD (Matches Prompt Section 3 Display) */}
        <View style={styles.featuredScheduleBanner}>
          <View style={styles.featuredHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.featuredOverline}>COLLECTION SCHEDULE SUMMARY</Text>
              <Text style={styles.featuredMainTitle}>
                {selectedBarangayName} • {extractRouteName(featuredRoute)}
              </Text>
            </View>
            <TouchableOpacity style={styles.newRouteBannerBtn} onPress={openCreateRouteModal}>
              <MaterialCommunityIcons name="plus-circle-outline" size={15} color="#FFFFFF" />
              <Text style={styles.newRouteBannerBtnText}>New Route</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.featuredBulletsBox}>
            <Text style={styles.featuredBulletItem}>
              • <Text style={styles.featuredBulletKey}>Start Location:</Text>{" "}
              {safeString(featuredRoute.start_location, "Barangay Hall")}
            </Text>
            <Text style={styles.featuredBulletItem}>
              • <Text style={styles.featuredBulletKey}>End Location:</Text>{" "}
              {safeString(featuredRoute.end_location, "Sanitation Facility")}
            </Text>
            <Text style={styles.featuredBulletItem}>
              • <Text style={styles.featuredBulletKey}>Start Time:</Text>{" "}
              {featuredRoute.start_time_formatted || formatTime12(featuredRoute.start_time)}
            </Text>
            <Text style={styles.featuredBulletItem}>
              • <Text style={styles.featuredBulletKey}>Estimated Travel Time:</Text>{" "}
              {safeString(featuredRoute.estimated_duration, "3 hours")}
            </Text>
            <Text style={styles.featuredBulletItem}>
              • <Text style={styles.featuredBulletKey}>Estimated Arrival Time:</Text>{" "}
              {featuredRoute.estimated_arrival_formatted ||
                formatTime12(featuredRoute.estimated_arrival_time || featuredRoute.end_time)}
            </Text>
          </View>
        </View>

        {/* ROUTE STATUS FILTER PILLS */}
        {viewMode === "routes" && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.statusFilterBar}
          >
            {[
              { key: "all", label: "All Statuses" },
              ...ROUTE_STATUS_OPTIONS,
            ].map((st) => {
              const active = statusFilter === st.key;
              return (
                <TouchableOpacity
                  key={`filter-${st.key}`}
                  style={[styles.statusFilterPill, active && styles.statusFilterPillActive]}
                  onPress={() => setStatusFilter(st.key)}
                >
                  <Text
                    style={[
                      styles.statusFilterPillText,
                      active && styles.statusFilterPillTextActive,
                    ]}
                  >
                    {st.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* SCHEDULE / ROUTE LIST HEADER */}
        <View style={styles.scheduleHeaderRow}>
          <Text style={styles.sectionTitle}>
            {viewMode === "routes"
              ? "Active Collection Routes & Timeline"
              : viewMode === "days"
                ? "Weekly Days (Monday – Sunday)"
                : "Chronological Calendar Dates"}
          </Text>
          <Text style={styles.scheduleCount}>
            {viewMode === "routes"
              ? `${filteredRoutes.length} ${filteredRoutes.length === 1 ? "Route" : "Routes"}`
              : `${schedules.length} ${schedules.length === 1 ? "Schedule" : "Schedules"}`}
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#2E7D32" />
            <Text style={styles.loadingText}>
              Syncing collection routes, stops, and arrival timelines...
            </Text>
          </View>
        ) : errorMessage ? (
          <View style={styles.emptyCard}>
            <View style={[styles.emptyIconCircle, { backgroundColor: "#FFEBEE" }]}>
              <MaterialCommunityIcons name="alert-circle-outline" size={36} color="#C62828" />
            </View>
            <Text style={styles.emptyTitle}>Unable to Load Schedule</Text>
            <Text style={styles.emptySub}>{errorMessage}</Text>
            <TouchableOpacity
              style={styles.emptyRefreshBtn}
              onPress={() => loadSchedulesAndRoutes(false)}
            >
              <MaterialCommunityIcons name="refresh" size={16} color="#FFFFFF" />
              <Text style={styles.emptyRefreshText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : viewMode === "routes" ? (
          filteredRoutes.length === 0 ? (
            <View style={styles.scheduleCardsList}>
              {renderCompleteRouteCard(featuredRoute, 0, false)}
            </View>
          ) : (
            <View style={styles.scheduleCardsList}>
              {filteredRoutes.map((routeItem, rIdx) =>
                renderCompleteRouteCard(routeItem, rIdx, true)
              )}
            </View>
          )
        ) : viewMode === "days" ? (
          <View style={styles.scheduleCardsList}>
            {DAYS_OF_WEEK.map((dayName) => {
              const daySchedules = schedules.filter(
                (item) => getDayFromItem(item).toLowerCase() === dayName.toLowerCase()
              );
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
                    <View style={styles.dayPill}>
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

                  {hasSchedules && (
                    <View style={styles.dayRunsContainer}>
                      {daySchedules.map((run, rIdx) =>
                        renderCompleteRouteCard(run, rIdx, false)
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        ) : schedules.length === 0 ? (
          <View style={styles.scheduleCardsList}>
            {renderCompleteRouteCard(featuredRoute, 0, false)}
          </View>
        ) : (
          <View style={styles.scheduleCardsList}>
            {schedules.map((item, idx) => renderCompleteRouteCard(item, idx, false))}
          </View>
        )}

        {/* BOTTOM NOTICE CARD */}
        <View style={styles.noticeCard}>
          <View style={styles.noticeIconBox}>
            <MaterialCommunityIcons name="clock-alert-outline" size={24} color="#2E7D32" />
          </View>
          <View style={styles.noticeTextContainer}>
            <Text style={styles.noticeTitle}>Collection Guidelines</Text>
            <Text style={styles.noticeBody}>
              All collection schedules operate on Philippine Time (Asia/Manila). Please segregate waste properly and place bins at your designated collection point 30 minutes before the scheduled start time.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* ====================================================================
          CREATE / EDIT COLLECTION ROUTE MODAL
         ==================================================================== */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {editingRouteId ? `Edit Route #${editingRouteId}` : "Create Collection Route"}
                </Text>
                <Text style={styles.modalSubTitle}>
                  Configure start/end locations, stops, personnel, and auto-calculated ETA
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setModalVisible(false)}
              >
                <MaterialCommunityIcons name="close" size={20} color="#1E331B" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalScrollBody}
            >
              {formError ? (
                <View style={styles.formErrorBanner}>
                  <MaterialCommunityIcons name="alert-circle" size={16} color="#C62828" />
                  <Text style={styles.formErrorText}>{formError}</Text>
                </View>
              ) : null}

              {/* 1. START LOCATION & END LOCATION */}
              <Text style={styles.inputLabel}>Start Route (Starting Location) *</Text>
              <TextInput
                style={styles.textInput}
                value={formStartLocation}
                onChangeText={setFormStartLocation}
                placeholder="e.g. Barangay Hall"
                placeholderTextColor="#90A4AE"
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.presetChipsRow}
              >
                {START_LOCATION_PRESETS.map((loc) => (
                  <TouchableOpacity
                    key={`start-preset-${loc}`}
                    style={[
                      styles.presetChip,
                      formStartLocation === loc && styles.presetChipActive,
                    ]}
                    onPress={() => setFormStartLocation(loc)}
                  >
                    <Text
                      style={[
                        styles.presetChipText,
                        formStartLocation === loc && styles.presetChipTextActive,
                      ]}
                    >
                      {loc}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.inputLabel}>End Route (Final Destination) *</Text>
              <TextInput
                style={styles.textInput}
                value={formEndLocation}
                onChangeText={setFormEndLocation}
                placeholder="e.g. Sanitation Facility"
                placeholderTextColor="#90A4AE"
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.presetChipsRow}
              >
                {END_LOCATION_PRESETS.map((loc) => (
                  <TouchableOpacity
                    key={`end-preset-${loc}`}
                    style={[
                      styles.presetChip,
                      formEndLocation === loc && styles.presetChipActive,
                    ]}
                    onPress={() => setFormEndLocation(loc)}
                  >
                    <Text
                      style={[
                        styles.presetChipText,
                        formEndLocation === loc && styles.presetChipTextActive,
                      ]}
                    >
                      {loc}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* 2. COLLECTION DATE & STARTING TIME */}
              <View style={styles.twoColRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Collection Date (YYYY-MM-DD) *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={formCollectionDate}
                    onChangeText={setFormCollectionDate}
                    placeholder="2026-11-07"
                    placeholderTextColor="#90A4AE"
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Start Time (HH:MM or AM/PM) *</Text>
                  <TextInput
                    style={styles.textInput}
                    value={formStartTime}
                    onChangeText={setFormStartTime}
                    placeholder="09:00 or 9:00 AM"
                    placeholderTextColor="#90A4AE"
                  />
                </View>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.presetChipsRow}
              >
                {START_TIME_PRESETS.map((tp) => (
                  <TouchableOpacity
                    key={`time-preset-${tp.value}`}
                    style={[
                      styles.presetChip,
                      formStartTime === tp.value && styles.presetChipActive,
                    ]}
                    onPress={() => setFormStartTime(tp.value)}
                  >
                    <Text
                      style={[
                        styles.presetChipText,
                        formStartTime === tp.value && styles.presetChipTextActive,
                      ]}
                    >
                      {tp.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* 3. ROUTE DISTANCE & STOP DURATION PARAMETERS */}
              <View style={styles.twoColRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Route Distance (km)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={formDistanceKm}
                    onChangeText={setFormDistanceKm}
                    keyboardType="numeric"
                    placeholder="15"
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Mins Spent per Stop</Text>
                  <TextInput
                    style={styles.textInput}
                    value={formStopDurationMins}
                    onChangeText={handleApplyStopDurationToAll}
                    keyboardType="numeric"
                    placeholder="40"
                  />
                </View>
              </View>

              {/* 4. COLLECTION STOPS MANAGEMENT (ADD, REMOVE, REORDER) */}
              <Text style={styles.inputLabel}>
                Collection Stops ({formStops.length} in Order) *
              </Text>
              <View style={styles.stopsManagerCard}>
                {formStops.map((stop, sIdx) => (
                  <View key={`form-stop-${sIdx}`} style={styles.stopEditorRow}>
                    <View style={styles.stopOrderCircle}>
                      <Text style={styles.stopOrderText}>{sIdx + 1}</Text>
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.stopEditorName}>{stop.name}</Text>
                      <Text style={styles.stopEditorMeta}>
                        Est. {stop.duration_minutes} mins • Arrives{" "}
                        {liveFormCalculation.stops[sIdx]?.arrival_time || "--"}
                      </Text>
                    </View>

                    <View style={styles.stopActionButtons}>
                      <TouchableOpacity
                        style={styles.stopSmallBtn}
                        onPress={() => handleUpdateStopDuration(sIdx, -5)}
                      >
                        <Text style={styles.stopSmallBtnText}>-5m</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.stopSmallBtn}
                        onPress={() => handleUpdateStopDuration(sIdx, 5)}
                      >
                        <Text style={styles.stopSmallBtnText}>+5m</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.stopIconBtn}
                        onPress={() => handleMoveStop(sIdx, -1)}
                        disabled={sIdx === 0}
                      >
                        <MaterialCommunityIcons
                          name="arrow-up"
                          size={15}
                          color={sIdx === 0 ? "#CFD8DC" : "#1E5822"}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.stopIconBtn}
                        onPress={() => handleMoveStop(sIdx, 1)}
                        disabled={sIdx === formStops.length - 1}
                      >
                        <MaterialCommunityIcons
                          name="arrow-down"
                          size={15}
                          color={sIdx === formStops.length - 1 ? "#CFD8DC" : "#1E5822"}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.stopIconBtn}
                        onPress={() => handleRemoveStopFromForm(sIdx)}
                      >
                        <MaterialCommunityIcons name="close-circle" size={16} color="#C62828" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}

                {/* ADD NEW STOP INPUT ROW */}
                <View style={styles.addStopRow}>
                  <TextInput
                    style={[styles.textInput, { flex: 1, marginBottom: 0 }]}
                    value={newStopName}
                    onChangeText={setNewStopName}
                    placeholder="Add collection stop (e.g. Purok 3 Junction)"
                    placeholderTextColor="#90A4AE"
                  />
                  <TouchableOpacity style={styles.addStopBtn} onPress={handleAddStopToForm}>
                    <MaterialCommunityIcons name="plus" size={16} color="#FFFFFF" />
                    <Text style={styles.addStopBtnText}>Add Stop</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* 5. ASSIGNED VEHICLE & PERSONNEL */}
              <Text style={styles.inputLabel}>Assign Garbage Collection Vehicle</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.presetChipsRow}
              >
                {(vehiclesList.length > 0
                  ? vehiclesList
                  : [
                    { id: 3, label: "TRK-01 (KAL-101)" },
                    { id: 4, label: "TRK-02 (KAL-102)" },
                    { id: 5, label: "TRK-03 (KAL-103)" },
                    { id: 6, label: "TRK-04 (KAL-104)" },
                  ]
                ).map((veh) => {
                  const active = Number(formTruckId) === Number(veh.id);
                  return (
                    <TouchableOpacity
                      key={`veh-${veh.id}`}
                      style={[styles.presetChip, active && styles.presetChipActive]}
                      onPress={() => setFormTruckId(veh.id)}
                    >
                      <Text
                        style={[styles.presetChipText, active && styles.presetChipTextActive]}
                      >
                        {veh.label || `${veh.truck_number} (${veh.plate_number})`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={styles.inputLabel}>Assign Collection Personnel / Driver</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.presetChipsRow}
              >
                {(personnelList.length > 0
                  ? personnelList
                  : [
                    { id: 7, name: "John Driver" },
                    { id: 9, name: "Juan Driver" },
                    { id: 10, name: "Ramon Bautista" },
                    { id: 11, name: "Carlos Mendoza" },
                  ]
                ).map((p) => {
                  const active = Number(formPersonnelId) === Number(p.id);
                  return (
                    <TouchableOpacity
                      key={`pers-${p.id}`}
                      style={[styles.presetChip, active && styles.presetChipActive]}
                      onPress={() => setFormPersonnelId(p.id)}
                    >
                      <Text
                        style={[styles.presetChipText, active && styles.presetChipTextActive]}
                      >
                        {p.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* 6. ROUTE STATUS SELECTOR */}
              <Text style={styles.inputLabel}>Route Status</Text>
              <View style={styles.statusSelectorRow}>
                {ROUTE_STATUS_OPTIONS.map((opt) => {
                  const active = formStatus === opt.key;
                  return (
                    <TouchableOpacity
                      key={`modal-st-${opt.key}`}
                      style={[
                        styles.statusOptionBtn,
                        active && { backgroundColor: opt.color, borderColor: opt.color },
                      ]}
                      onPress={() => setFormStatus(opt.key)}
                    >
                      <Text
                        style={[
                          styles.statusOptionBtnText,
                          active && { color: "#FFFFFF", fontWeight: "800" },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* 7. LIVE AUTO-CALCULATED SCHEDULE & TIMELINE PREVIEW */}
              <View style={styles.livePreviewBox}>
                <Text style={styles.livePreviewTitle}>
                  Auto-Calculated Schedule Preview (Updates Live)
                </Text>
                <Text style={styles.livePreviewLine}>
                  • Start Location: {formStartLocation || "Barangay Hall"}
                </Text>
                <Text style={styles.livePreviewLine}>
                  • End Location: {formEndLocation || "Sanitation Facility"}
                </Text>
                <Text style={styles.livePreviewLine}>
                  • Start Time: {liveFormCalculation.start_time_formatted}
                </Text>
                <Text style={styles.livePreviewLine}>
                  • Estimated Travel Time: {liveFormCalculation.estimated_duration}
                </Text>
                <Text style={styles.livePreviewLine}>
                  • Estimated Arrival Time: {liveFormCalculation.estimated_arrival_formatted}
                </Text>

                <View style={styles.livePreviewTimelineDivider} />
                {liveFormCalculation.timeline.map((tStep, tIdx) => (
                  <Text key={`prev-tl-${tIdx}`} style={styles.livePreviewTimelineItem}>
                    {tStep.time} —{" "}
                    {tStep.type === "start"
                      ? "Collection Starts"
                      : tStep.type === "end"
                        ? "Estimated Arrival at Destination"
                        : tStep.label}
                  </Text>
                ))}
              </View>

              {/* SAVE / CANCEL ACTIONS */}
              <View style={styles.modalActionsRow}>
                <TouchableOpacity
                  style={styles.cancelModalBtn}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.cancelModalBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.saveModalBtn}
                  onPress={handleSaveRoute}
                  disabled={savingRoute}
                >
                  {savingRoute ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <MaterialCommunityIcons name="content-save-check" size={18} color="#FFFFFF" />
                      <Text style={styles.saveModalBtnText}>
                        {editingRouteId ? "Update Route" : "Save Collection Route"}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 4-TAB RESIDENT BOTTOM HOTBAR */}
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
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF5ED",
    backgroundColor: "#FFFFFF",
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F2F7F1",
    justifyContent: "center",
    alignItems: "center",
  },
  screenTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#1E331B",
    flex: 1,
    marginLeft: 10,
  },
  topRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  addRouteTopBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2E7D32",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    gap: 4,
  },
  addRouteTopBtnText: {
    color: "#FFFFFF",
    fontSize: 11.5,
    fontWeight: "800",
  },
  calendarActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F2F7F1",
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    paddingHorizontal: 16,
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

  /* FEATURED COLLECTION SCHEDULE BANNER */
  featuredScheduleBanner: {
    backgroundColor: "#EAF6E9",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#CCE8CB",
    marginBottom: 14,
  },
  featuredHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  featuredOverline: {
    fontSize: 10,
    fontWeight: "800",
    color: "#2E7D32",
    letterSpacing: 0.6,
  },
  featuredMainTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#1E331B",
    marginTop: 2,
  },
  newRouteBannerBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E5822",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 4,
  },
  newRouteBannerBtnText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  featuredBulletsBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#D5ECD4",
    gap: 3,
  },
  featuredBulletItem: {
    fontSize: 12,
    color: "#1E331B",
    fontWeight: "600",
  },
  featuredBulletKey: {
    fontWeight: "800",
    color: "#2E7D32",
  },

  /* STATUS FILTER PILLS */
  statusFilterBar: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  statusFilterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DCEBDD",
  },
  statusFilterPillActive: {
    backgroundColor: "#2E7D32",
    borderColor: "#2E7D32",
  },
  statusFilterPillText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#4A6647",
  },
  statusFilterPillTextActive: {
    color: "#FFFFFF",
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
    gap: 14,
    marginBottom: 18,
  },

  /* ROUTE MASTER CARD */
  routeMasterCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1.2,
    borderColor: "#DCEBDD",
    shadowColor: "#1E331B",
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  routeMasterTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  routeMasterTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 10,
  },
  routeIconAvatar: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: "#E8F8EE",
    justifyContent: "center",
    alignItems: "center",
  },
  routeMasterTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#1E331B",
  },
  routeMasterSub: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#5C7858",
    marginTop: 1,
  },
  routeStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    gap: 4,
  },
  routeStatusPillText: {
    fontSize: 10.5,
    fontWeight: "800",
    textTransform: "uppercase",
  },

  /* START & END ENDPOINTS */
  startEndEndpointsBox: {
    backgroundColor: "#F6FBF5",
    borderRadius: 14,
    padding: 11,
    borderWidth: 1,
    borderColor: "#DCEBDD",
    marginBottom: 10,
  },
  endpointItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  endpointBadgeCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  endpointRoleLabel: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#5C7858",
    letterSpacing: 0.5,
  },
  endpointLocationValue: {
    fontSize: 13.5,
    fontWeight: "900",
    color: "#1E331B",
  },
  endpointConnectorBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 8,
    paddingVertical: 4,
    gap: 6,
  },
  endpointConnectorStopsText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2E7D32",
  },

  /* SCHEDULE METRICS STRIP */
  scheduleMetricsStrip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E4EFE3",
    paddingVertical: 9,
    paddingHorizontal: 8,
    marginBottom: 10,
  },
  scheduleMetricBox: {
    flex: 1,
    alignItems: "center",
  },
  scheduleMetricDivider: {
    width: 1,
    height: 26,
    backgroundColor: "#E4EFE3",
  },
  scheduleMetricLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#688264",
    marginBottom: 2,
  },
  scheduleMetricValue: {
    fontSize: 12.5,
    fontWeight: "900",
    color: "#1E331B",
    textAlign: "center",
  },

  /* PERSONNEL & VEHICLE ROW */
  assignmentInfoRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  assignmentChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F8F2",
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 9,
    gap: 5,
  },
  assignmentChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1E331B",
    flex: 1,
  },

  /* ORDERED STOPS CHIPS */
  orderedStopsBox: {
    marginBottom: 10,
  },
  orderedStopsTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#1E5822",
    marginBottom: 6,
  },
  stopsChipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  stopChip: {
    backgroundColor: "#F6FBF5",
    borderWidth: 1,
    borderColor: "#CFE3CE",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  stopChipText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#2E542C",
  },

  /* TIMELINE COMPONENT */
  timelineCardBox: {
    backgroundColor: "#FAFCF9",
    borderRadius: 13,
    padding: 11,
    borderWidth: 1,
    borderColor: "#E1EDE0",
    marginBottom: 8,
  },
  timelineHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  timelineHeaderTitle: {
    fontSize: 11.5,
    fontWeight: "900",
    color: "#1E5822",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  timelineList: {
    paddingLeft: 2,
  },
  timelineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  timelineRailCol: {
    alignItems: "center",
    width: 22,
    marginRight: 8,
  },
  timelineDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  timelineLine: {
    width: 2,
    height: 24,
    backgroundColor: "#C8E6C9",
    marginVertical: 2,
  },
  timelineContentCol: {
    flex: 1,
    paddingBottom: 10,
  },
  timelinePrimaryLine: {
    fontSize: 12,
    color: "#1E331B",
  },
  timelineTimeBold: {
    fontWeight: "900",
    color: "#1E5822",
  },
  timelineEventLabel: {
    fontWeight: "800",
    color: "#1E331B",
  },
  timelineSubLocation: {
    fontSize: 10.5,
    color: "#607D8B",
    fontWeight: "600",
    marginTop: 1,
  },

  /* ROUTE MANAGEMENT FOOTER */
  managementFooter: {
    borderTopWidth: 1,
    borderTopColor: "#EAF2E9",
    paddingTop: 10,
    marginTop: 4,
    gap: 8,
  },
  quickStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  quickStatusLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#4A6647",
    marginRight: 2,
  },
  quickStatusChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: "#D5E5D4",
    backgroundColor: "#FFFFFF",
  },
  quickStatusChipText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#4A6647",
  },
  crudButtonsRow: {
    flexDirection: "row",
    gap: 8,
  },
  editRouteBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E3F2FD",
    paddingVertical: 8,
    borderRadius: 9,
    gap: 5,
  },
  editRouteBtnText: {
    fontSize: 11.5,
    fontWeight: "800",
    color: "#1565C0",
  },
  deleteRouteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFEBEE",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9,
    gap: 4,
  },
  deleteRouteBtnText: {
    fontSize: 11.5,
    fontWeight: "800",
    color: "#C62828",
  },

  /* DAY WEEK CARDS */
  dayWeekCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  dayWeekCardActive: {
    backgroundColor: "#FFFFFF",
    borderColor: "#CCE3C9",
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
  dayPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
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
    padding: 10,
    gap: 10,
  },

  /* MODAL STYLES */
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(18, 35, 16, 0.55)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "92%",
    paddingTop: 16,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EAF2E9",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#1E331B",
  },
  modalSubTitle: {
    fontSize: 11.5,
    color: "#5C7858",
    fontWeight: "600",
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F2F7F1",
    justifyContent: "center",
    alignItems: "center",
  },
  modalScrollBody: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 34,
  },
  formErrorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFEBEE",
    borderWidth: 1,
    borderColor: "#FFCDD2",
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
    gap: 6,
  },
  formErrorText: {
    color: "#C62828",
    fontSize: 12,
    fontWeight: "700",
    flex: 1,
  },
  inputLabel: {
    fontSize: 11.5,
    fontWeight: "800",
    color: "#2E542C",
    marginBottom: 5,
    marginTop: 6,
  },
  textInput: {
    backgroundColor: "#F8FBF8",
    borderWidth: 1,
    borderColor: "#CFE3CE",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: "#1E331B",
    fontWeight: "600",
    marginBottom: 6,
  },
  presetChipsRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 8,
  },
  presetChip: {
    backgroundColor: "#F2F7F1",
    borderWidth: 1,
    borderColor: "#D5E5D4",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  presetChipActive: {
    backgroundColor: "#2E7D32",
    borderColor: "#2E7D32",
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#335431",
  },
  presetChipTextActive: {
    color: "#FFFFFF",
  },
  twoColRow: {
    flexDirection: "row",
    gap: 10,
  },
  stopsManagerCard: {
    backgroundColor: "#F6FBF5",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#DCEBDD",
    marginBottom: 10,
    gap: 8,
  },
  stopEditorRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 8,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#E4EFE3",
    gap: 8,
  },
  stopOrderCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#2E7D32",
    justifyContent: "center",
    alignItems: "center",
  },
  stopOrderText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
  },
  stopEditorName: {
    fontSize: 12.5,
    fontWeight: "800",
    color: "#1E331B",
  },
  stopEditorMeta: {
    fontSize: 10.5,
    fontWeight: "600",
    color: "#5C7858",
  },
  stopActionButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  stopSmallBtn: {
    backgroundColor: "#E8F8EE",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  stopSmallBtnText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#2E7D32",
  },
  stopIconBtn: {
    padding: 3,
  },
  addStopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  addStopBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2E7D32",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 4,
  },
  addStopBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  statusSelectorRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  statusOptionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#CFE3CE",
    backgroundColor: "#F8FBF8",
  },
  statusOptionBtnText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#2E542C",
  },
  livePreviewBox: {
    backgroundColor: "#EAF6E9",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#B7DFB9",
    marginTop: 4,
    marginBottom: 14,
  },
  livePreviewTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: "#1E5822",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  livePreviewLine: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1E331B",
    marginBottom: 2,
  },
  livePreviewTimelineDivider: {
    height: 1,
    backgroundColor: "#CCE8CB",
    marginVertical: 8,
  },
  livePreviewTimelineItem: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#2E542C",
    marginBottom: 3,
  },
  modalActionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  cancelModalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#CFE3CE",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelModalBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#4A6647",
  },
  saveModalBtn: {
    flex: 2,
    flexDirection: "row",
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#2E7D32",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  saveModalBtnText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#FFFFFF",
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
    borderColor: "#E8F0E7",
    marginBottom: 18,
  },
  emptyIconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#EAF6E9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1E331B",
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    color: "#6E856A",
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 16,
  },
  emptyRefreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2E7D32",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  emptyRefreshText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  noticeCard: {
    backgroundColor: "#F2F9F1",
    borderRadius: 16,
    padding: 15,
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: "#DCEBDD",
  },
  noticeIconBox: {
    marginRight: 12,
    marginTop: 2,
  },
  noticeTextContainer: {
    flex: 1,
  },
  noticeTitle: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#1E5822",
    marginBottom: 3,
  },
  noticeBody: {
    fontSize: 12,
    color: "#4F6B4C",
    lineHeight: 17.5,
  },
});
