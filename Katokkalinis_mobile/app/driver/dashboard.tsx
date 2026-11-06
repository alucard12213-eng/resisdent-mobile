import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import KatokLogo from "../../components/KatokLogo";
import LiveRouteMapView from "../../components/LiveRouteMapView";
import TopNotificationBanner from "../../components/TopNotificationBanner";
import { resolveMediaUrl } from "../../services/api";
import { fetchNotifications } from "../../services/resident";
import {
  BarangayItem,
  CollectionLogItem,
  correctTypoCollectionLog,
  finalizeCollectionLog,
  getBarangays1to40,
  getDriverCollectionLogs,
  getDriverFleetStatus,
  submitCollectionLog,
  updateDriverTruckStatus,
} from "../../services/driver";
import {
  addLocationListener,
  isAutomaticRecordingActive,
  LiveLocationState,
  startAutomaticLocationRecording,
  stopAutomaticLocationRecording,
} from "../../services/locationService";

export default function DriverDashboard() {
  const router = useRouter();
  const [userName, setUserName] = useState("John Driver");
  const truckPlate = "KAL-104";
  const [isCollecting, setIsCollecting] = useState(false);
  const [routeCompleted, setRouteCompleted] = useState(false);

  // Barangay data
  const [barangaysList, setBarangaysList] = useState<BarangayItem[]>([]);
  const [selectedBrgy, setSelectedBrgy] = useState("Barangay 2");
  const [selectedBrgyId, setSelectedBrgyId] = useState<number | undefined>(2);

  // Collection Logs
  const [collectionLogs, setCollectionLogs] = useState<CollectionLogItem[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Record Collection Modal (Insert-Only)
  const [recordModalVisible, setRecordModalVisible] = useState(false);
  const [amountCollected, setAmountCollected] = useState("");
  const [unit] = useState("tons");
  const [wasteType, setWasteType] = useState("Residual");
  const [notes, setNotes] = useState("");
  const [submittingLog, setSubmittingLog] = useState(false);

  // Typo Edit Modal (Before Finalization)
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingLog, setEditingLog] = useState<CollectionLogItem | null>(null);
  const [correctedAmount, setCorrectedAmount] = useState("");
  const [correctionReason, setCorrectionReason] = useState("Typographical correction from driver mobile app");
  const [savingCorrection, setSavingCorrection] = useState(false);

  // Audit Trail Modal
  const [auditModalVisible, setAuditModalVisible] = useState(false);
  const [viewingAuditsLog, setViewingAuditsLog] = useState<CollectionLogItem | null>(null);

  // Photo Upload States
  const [pickupPhotoUri, setPickupPhotoUri] = useState<string | null>(null);
  const [pickupPhotoBase64, setPickupPhotoBase64] = useState<string | null>(null);
  const [fullPhotoModalUri, setFullPhotoModalUri] = useState<string | null>(null);

  // Unread Notification Count
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  // Top Banner
  const [banner, setBanner] = useState({
    visible: false,
    title: "",
    message: "",
    type: "truck" as "truck" | "info" | "success" | "warning",
  });

  // Live GPS Telemetry Broadcast State
  const [liveGpsState, setLiveGpsState] = useState<LiveLocationState | null>(null);

  useEffect(() => {
    loadUserData();
    checkCollectionState();
    loadBarangays();
    loadCollectionLogs();
    loadNotifCount();
    const notifTimer = setInterval(loadNotifCount, 8000);

    // Subscribe to real-time location recorder pings
    const unsubscribeLocation = addLocationListener((state) => {
      setLiveGpsState(state);
    });

    return () => {
      clearInterval(notifTimer);
      unsubscribeLocation();
    };
  }, []);

  const loadNotifCount = async () => {
    try {
      const res = await fetchNotifications();
      if (res && res.success && Array.isArray(res.notifications)) {
        const unread = res.notifications.filter((n: any) => !n.is_read).length;
        setUnreadNotifCount(unread);
      }
    } catch {}
  };

  const loadUserData = async () => {
    try {
      const name = await AsyncStorage.getItem("userName");
      if (name) setUserName(name);
    } catch (e) {
      console.error(e);
    }
  };

  const checkCollectionState = async () => {
    try {
      const collecting = await AsyncStorage.getItem("driver_is_collecting");
      if (collecting === "true") {
        setIsCollecting(true);
        if (!isAutomaticRecordingActive()) {
          startAutomaticLocationRecording({ plateNumber: truckPlate }).catch(() => {});
        }
      }

      // Query backend for real-time driver & assigned truck state
      const fleetRes = await getDriverFleetStatus();
      if (fleetRes?.success && Array.isArray(fleetRes.drivers)) {
        const myTruck = fleetRes.drivers.find(
          (d: any) => d.plate_number === truckPlate || (userName && d.driver_name?.toLowerCase().includes(userName.toLowerCase()))
        );
        if (myTruck) {
          const isServerOnRoute = myTruck.driver_status === "on_route" || myTruck.operating_status === "on_route";
          setIsCollecting(isServerOnRoute);
          await AsyncStorage.setItem("driver_is_collecting", isServerOnRoute ? "true" : "false");

          if (isServerOnRoute && !isAutomaticRecordingActive()) {
            startAutomaticLocationRecording({ plateNumber: truckPlate }).catch(() => {});
          } else if (!isServerOnRoute && isAutomaticRecordingActive()) {
            stopAutomaticLocationRecording(truckPlate).catch(() => {});
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handlePickPhoto = () => {
    Alert.alert("Proof of Pickup / Waste Photo", "Choose photo source:", [
      {
        text: "Take Photo (Camera)",
        onPress: async () => {
          try {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== "granted") {
              Alert.alert("Permission Needed", "Camera access is needed to capture pickup proof.");
              return;
            }
            const result = await ImagePicker.launchCameraAsync({
              allowsEditing: true,
              quality: 0.7,
              base64: true,
            });
            if (!result.canceled && result.assets?.[0]) {
              const asset = result.assets[0];
              if (asset.fileSize && asset.fileSize > 12 * 1024 * 1024) {
                Alert.alert("File Too Large", "Please select a photo smaller than 12MB.");
                return;
              }
              setPickupPhotoUri(asset.uri);
              if (asset.base64) setPickupPhotoBase64(asset.base64);
            }
          } catch (err: any) {
            Alert.alert("Photo Error", err?.message || "Could not take photo.");
          }
        },
      },
      {
        text: "Select from Gallery",
        onPress: async () => {
          try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== "granted") {
              Alert.alert("Permission Needed", "Gallery access is needed to select photos.");
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ["images"],
              allowsEditing: true,
              quality: 0.7,
              base64: true,
            });
            if (!result.canceled && result.assets?.[0]) {
              const asset = result.assets[0];
              if (asset.fileSize && asset.fileSize > 12 * 1024 * 1024) {
                Alert.alert("File Too Large", "Please select an image smaller than 12MB.");
                return;
              }
              setPickupPhotoUri(asset.uri);
              if (asset.base64) setPickupPhotoBase64(asset.base64);
            }
          } catch (err: any) {
            Alert.alert("Photo Error", err?.message || "Could not select photo.");
          }
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const loadBarangays = async () => {
    try {
      const data = await getBarangays1to40();
      setBarangaysList(data);
    } catch (e) {
      console.warn("Could not load barangays 1-40:", e);
    }
  };

  const loadCollectionLogs = async () => {
    try {
      setLoadingLogs(true);
      const logs = await getDriverCollectionLogs({ myLogsOnly: true });
      setCollectionLogs(logs);
    } catch (e) {
      console.warn("Could not load collection logs:", e);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleStartCollection = async () => {
    setIsCollecting(true);
    setRouteCompleted(false);
    await AsyncStorage.setItem("driver_is_collecting", "true");

    // Automatically begin periodic live GPS telemetry recording to Superadmin Dashboard
    startAutomaticLocationRecording({
      plateNumber: truckPlate,
      intervalMs: 5000,
      onPing: (loc) => {
        setLiveGpsState(loc);
      },
    }).catch((err) => {
      console.warn("Failed to initiate automatic GPS recording:", err);
    });

    // Broadcast status update to backend & web live
    updateDriverTruckStatus("on_route", undefined, truckPlate).catch((err) => {
      console.warn("Could not sync truck on_route status to server:", err);
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    setBanner({
      visible: true,
      title: "Route & Live GPS Started",
      message: `Truck ${truckPlate} is now ON ROUTE. Telemetry is automatically streaming every 5s to the Superadmin Dashboard map.`,
      type: "truck",
    });
  };

  const handleEndCollection = async () => {
    Alert.alert(
      "End Collection",
      "Are you sure you want to end current collection run and return to depot?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "End Run",
          style: "destructive",
          onPress: async () => {
            setIsCollecting(false);
            await AsyncStorage.setItem("driver_is_collecting", "false");

            // Stop automatic location recorder and send final depot status
            await stopAutomaticLocationRecording(truckPlate).catch((err) => {
              console.warn("Error stopping location recorder:", err);
            });

            // Broadcast status update to backend & web live
            updateDriverTruckStatus("available", undefined, truckPlate).catch((err) => {
              console.warn("Could not sync truck available status to server:", err);
            });

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});

            setBanner({
              visible: true,
              title: "Collection Run Ended",
              message: "Truck status updated to AVAILABLE on web dashboard. GPS recording stopped. Remember to finalize collection logs.",
              type: "info",
            });
          },
        },
      ]
    );
  };


  // 1. Submit New Collection Log (Insert-Only)
  const handleSaveCollectionRecord = async () => {
    const amountVal = parseFloat(amountCollected);
    if (isNaN(amountVal) || amountVal <= 0) {
      Alert.alert("Validation Error", "Please enter a valid amount collected (e.g. 3.5 tons).");
      return;
    }

    try {
      setSubmittingLog(true);
      const photoPayload = pickupPhotoBase64
        ? `data:image/jpeg;base64,${pickupPhotoBase64}`
        : (pickupPhotoUri && pickupPhotoUri.startsWith("http") ? pickupPhotoUri : undefined);

      const res = await submitCollectionLog({
        amount_collected: amountVal,
        unit,
        barangay_name: selectedBrgy,
        barangay_id: selectedBrgyId,
        waste_type: wasteType,
        notes: notes.trim() || undefined,
        photo_url: photoPayload,
      });

      if (res?.success) {
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {
          // Haptics fallback
        }
        setRecordModalVisible(false);
        setAmountCollected("");
        setNotes("");
        setPickupPhotoUri(null);
        setPickupPhotoBase64(null);

        setBanner({
          visible: true,
          title: "Collection Logged (Insert-Only)",
          message: `Saved ${amountVal} ${unit} for ${selectedBrgy}. Server timestamp recorded.`,
          type: "success",
        });

        // Reload logs list
        loadCollectionLogs();
      } else {
        Alert.alert("Submission Failed", res?.message || "Could not save collection log.");
      }
    } catch (err: any) {
      console.error(err);
      Alert.alert("Network/Server Error", err?.message || "Could not record collection.");
    } finally {
      setSubmittingLog(false);
    }
  };

  // 2. Open Typo Correction Modal
  const openTypoEditModal = (log: CollectionLogItem) => {
    if (log.is_finalized) {
      Alert.alert("Record Locked", "This collection entry is finalized and cannot be modified.");
      return;
    }
    setEditingLog(log);
    setCorrectedAmount(String(log.amount_collected));
    setCorrectionReason("Driver corrected typographical error prior to finalization");
    setEditModalVisible(true);
  };

  // 3. Save Typo Correction
  const handleSaveCorrection = async () => {
    if (!editingLog) return;
    const newAmt = parseFloat(correctedAmount);
    if (isNaN(newAmt) || newAmt <= 0) {
      Alert.alert("Validation", "Please enter a valid corrected amount.");
      return;
    }

    try {
      setSavingCorrection(true);
      const res = await correctTypoCollectionLog(editingLog.id, {
        amount_collected: newAmt,
        reason: correctionReason,
      });

      if (res?.success) {
        setEditModalVisible(false);
        setEditingLog(null);
        setBanner({
          visible: true,
          title: "Correction Saved",
          message: `Updated amount to ${newAmt} tons. Audit trail logged.`,
          type: "info",
        });
        loadCollectionLogs();
      } else {
        Alert.alert("Correction Failed", res?.message || "Could not save correction.");
      }
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Could not save typographical correction.");
    } finally {
      setSavingCorrection(false);
    }
  };

  // 4. Finalize & Permanently Lock Log
  const handleFinalizeLog = (log: CollectionLogItem) => {
    if (log.is_finalized) {
      Alert.alert("Already Finalized", "This log is already locked permanently.");
      return;
    }

    Alert.alert(
      "Finalize & Permanently Lock",
      `Are you sure you want to finalize ${log.amount_collected} ${log.unit} for ${log.barangay_name}?\n\nOnce finalized, this entry is locked and can NEVER be edited or deleted.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, Finalize & Lock",
          style: "default",
          onPress: async () => {
            try {
              const res = await finalizeCollectionLog(log.id);
              if (res?.success) {
                try {
                  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                } catch {
                  // Haptics fallback
                }
                setBanner({
                  visible: true,
                  title: "Record Locked",
                  message: `Collection log #${log.id} is now permanently finalized.`,
                  type: "success",
                });
                loadCollectionLogs();
              } else {
                Alert.alert("Finalize Failed", res?.message || "Could not finalize record.");
              }
            } catch (err: any) {
              Alert.alert("Error", err?.message || "Could not finalize collection record.");
            }
          },
        },
      ]
    );
  };


  return (
    <View style={styles.container}>
      <TopNotificationBanner
        visible={banner.visible}
        title={banner.title}
        message={banner.message}
        type={banner.type}
        onDismiss={() => setBanner((prev) => ({ ...prev, visible: false }))}
      />

      {/* TOP HEADER */}
      <View style={styles.topHeader}>
        <KatokLogo variant="header" showTagline={false} />

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <TouchableOpacity
            style={styles.headerBellBtn}
            onPress={() => router.push("/notifications" as any)}
            activeOpacity={0.8}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialCommunityIcons name="bell-outline" size={22} color="#1E331B" />
            {unreadNotifCount > 0 ? (
              <View style={styles.headerBellBadge}>
                <Text style={styles.headerBellBadgeText}>
                  {unreadNotifCount > 9 ? "9+" : unreadNotifCount}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.greetingRight}
            activeOpacity={0.85}
            onPress={() => router.push("/driver/profile" as any)}
          >
            <View style={styles.greetingTextContainer}>
              <Text style={styles.greetingTitle}>Hello, {userName}!</Text>
              <View style={styles.statusBadgeRow}>
                <View style={[styles.statusDot, isCollecting ? styles.statusDotActive : styles.statusDotIdle]} />
                <Text style={styles.greetingSub}>
                  {routeCompleted ? "Route Done" : isCollecting ? "Collecting" : "On Standby"}
                </Text>
              </View>
            </View>
            <View style={styles.avatarCircle}>
              <MaterialCommunityIcons name="account" size={22} color="#2E7D32" />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* HERO CARD */}
        <View style={styles.heroCard}>
          <View style={styles.heroLeft}>
            <View style={styles.truckPlateBadge}>
              <MaterialCommunityIcons name="truck-check" size={14} color="#2E7D32" />
              <Text style={styles.truckPlateText}>Truck {truckPlate}</Text>
            </View>
            <Text style={styles.heroTitle}>Compactor Route #04</Text>
            <Text style={styles.heroSubtitle}>Barangays 31 - 40 • South Poblacion CDO</Text>
            <View style={styles.stopsIndicatorRow}>
              <MaterialCommunityIcons name="map-marker-path" size={14} color="#1E5E22" />
              <Text style={styles.stopsIndicatorText}>
                {routeCompleted ? "All Stops Cleared" : isCollecting ? "Active Collection Run" : "Standby for Run"}
              </Text>
            </View>
          </View>

          <View style={styles.heroRightStatus}>
            <View
              style={[
                styles.liveStatusPill,
                routeCompleted ? styles.liveStatusCompleted : isCollecting ? styles.liveStatusCollecting : styles.liveStatusStandby,
              ]}
            >
              <Text
                style={[
                  styles.liveStatusPillText,
                  routeCompleted ? styles.liveStatusTextCompleted : isCollecting ? styles.liveStatusTextCollecting : styles.liveStatusTextStandby,
                ]}
              >
                {routeCompleted ? "COMPLETED" : isCollecting ? "ACTIVE" : "READY"}
              </Text>
            </View>
          </View>
        </View>

        {/* LIVE GPS BROADCASTING CARD (Syncs directly to Superadmin Dashboard) */}
        {isCollecting && (
          <View style={styles.liveGpsBroadcastingCard}>
            <View style={styles.liveGpsHeader}>
              <View style={styles.gpsPulseContainer}>
                <View style={styles.gpsPulseDot} />
                <Text style={styles.gpsBroadcastingText}>LIVE GPS RECORDING ACTIVE</Text>
              </View>
              <View style={styles.gpsPingsBadge}>
                <Text style={styles.gpsPingsText}>
                  {liveGpsState?.pingsCount ? `${liveGpsState.pingsCount} pings sent` : "Broadcasting"}
                </Text>
              </View>
            </View>

            <View style={styles.gpsTelemetryRow}>
              <View style={styles.gpsTelemetryItem}>
                <Text style={styles.gpsTelemetryLabel}>CURRENT GPS</Text>
                <Text style={styles.gpsTelemetryValue}>
                  {liveGpsState?.latitude ? `${liveGpsState.latitude.toFixed(4)}, ${liveGpsState.longitude.toFixed(4)}` : "8.4735, 124.6545"}
                </Text>
              </View>
              <View style={styles.gpsTelemetryItem}>
                <Text style={styles.gpsTelemetryLabel}>SPEED</Text>
                <Text style={styles.gpsTelemetryValue}>
                  {liveGpsState?.speed ? `${liveGpsState.speed} km/h` : "18.5 km/h"}
                </Text>
              </View>
              <View style={styles.gpsTelemetryItem}>
                <Text style={styles.gpsTelemetryLabel}>SUPERADMIN</Text>
                <Text style={[styles.gpsTelemetryValue, { color: "#2E7D32" }]}>
                  Connected
                </Text>
              </View>
            </View>

            <View style={styles.gpsSectorRow}>
              <MaterialCommunityIcons name="map-marker-radius" size={14} color="#1E5E22" />
              <Text style={styles.gpsSectorSub}>
                {liveGpsState?.currentSectorName ? `Active Sector: ${liveGpsState.currentSectorName}` : "Active Sector: Route #04 South Poblacion"}
              </Text>
            </View>

            {/* Embedded Live Route Map inside the Live GPS Recording Module */}
            <View style={{ marginTop: 10 }}>
              <LiveRouteMapView
                height={210}
                selectedRouteId={4}
                compact={true}
                onExpandPress={() => router.push("/driver/map" as any)}
              />
            </View>
          </View>
        )}

        {/* QUICK ACTIONS */}
        <Text style={styles.sectionTitle}>Driver Quick Actions</Text>

        <View style={styles.quickActionsGrid}>
          {/* Action 1: Record Collection */}
          <TouchableOpacity
            style={[styles.actionGridCard, { borderColor: "#81C784" }]}
            activeOpacity={0.85}
            onPress={() => setRecordModalVisible(true)}
          >
            <View style={[styles.actionIconBox, { backgroundColor: "#E8F5E9" }]}>
              <MaterialCommunityIcons name="plus-box" size={26} color="#2E7D32" />
            </View>
            <Text style={[styles.actionLabel, { fontWeight: "800", color: "#1E331B" }]}>Record Log</Text>
          </TouchableOpacity>

          {/* Action 2: Start Collection */}
          <TouchableOpacity
            style={[styles.actionGridCard, isCollecting && styles.actionGridCardDisabled]}
            activeOpacity={0.85}
            onPress={handleStartCollection}
          >
            <View style={[styles.actionIconBox, { backgroundColor: "#E3F2FD" }]}>
              <MaterialCommunityIcons name="play-circle-outline" size={26} color="#1976D2" />
            </View>
            <Text style={styles.actionLabel}>Start Run</Text>
          </TouchableOpacity>

          {/* Action 3: Route Map */}
          <TouchableOpacity
            style={styles.actionGridCard}
            activeOpacity={0.85}
            onPress={() => router.push("/driver/map" as any)}
          >
            <View style={[styles.actionIconBox, { backgroundColor: "#FFF3E0" }]}>
              <MaterialCommunityIcons name="map-marker-radius" size={24} color="#E65100" />
            </View>
            <Text style={styles.actionLabel}>Route Map</Text>
          </TouchableOpacity>

          {/* Action 4: End Collection */}
          <TouchableOpacity
            style={[styles.actionGridCard, !isCollecting && styles.actionGridCardDisabled]}
            activeOpacity={0.85}
            onPress={handleEndCollection}
          >
            <View style={[styles.actionIconBox, { backgroundColor: "#FFEBEE" }]}>
              <MaterialCommunityIcons name="stop-circle-outline" size={26} color="#C62828" />
            </View>
            <Text style={styles.actionLabel}>End Run</Text>
          </TouchableOpacity>
        </View>


        {/* ACTUAL COLLECTION LOGS SECTION */}
        <View style={[styles.sectionHeaderRow, { marginTop: 18 }]}>
          <View>
            <Text style={styles.sectionTitle}>Actual Collection Logs</Text>
            <Text style={styles.sectionSub}>Submitted directly via mobile app • Insert-only</Text>
          </View>
          <TouchableOpacity
            style={styles.refreshBtn}
            onPress={loadCollectionLogs}
            disabled={loadingLogs}
          >
            {loadingLogs ? (
              <ActivityIndicator size="small" color="#2E7D32" />
            ) : (
              <MaterialCommunityIcons name="refresh" size={20} color="#2E7D32" />
            )}
          </TouchableOpacity>
        </View>

        {collectionLogs.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialCommunityIcons name="clipboard-text-outline" size={36} color="#A5B8A3" />
            <Text style={styles.emptyTitle}>No Collection Logs Yet</Text>
            <Text style={styles.emptySub}>
              All garbage collection data is recorded directly from driver mobile submissions. Tap &quot;Record Log&quot; to submit your first entry.
            </Text>
          </View>
        ) : (
          collectionLogs.map((log) => {
            const isFinalized = Boolean(log.is_finalized);
            const serverDate = new Date(log.server_timestamp || log.created_at);
            const timeStr = !isNaN(serverDate.getTime())
              ? serverDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) +
                " • " +
                serverDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })
              : "Just now";

            return (
              <View key={log.id} style={styles.logCard}>
                <View style={styles.logHeader}>
                  <View style={styles.logBrgyBox}>
                    <MaterialCommunityIcons name="map-marker" size={16} color="#2E7D32" />
                    <Text style={styles.logBrgyTitle}>{log.barangay_name}</Text>
                  </View>

                  <View
                    style={[
                      styles.logStatusBadge,
                      isFinalized ? styles.logStatusFinalized : styles.logStatusPending,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={isFinalized ? "lock" : "lock-open-outline"}
                      size={12}
                      color={isFinalized ? "#2E7D32" : "#E65100"}
                    />
                    <Text
                      style={[
                        styles.logStatusText,
                        { color: isFinalized ? "#2E7D32" : "#E65100" },
                      ]}
                    >
                      {isFinalized ? "FINALIZED & LOCKED" : "UNFINALIZED"}
                    </Text>
                  </View>
                </View>

                {/* Amount and Waste Type */}
                <View style={styles.logDataRow}>
                  <View style={styles.logStatItem}>
                    <Text style={styles.logStatLabel}>AMOUNT COLLECTED</Text>
                    <Text style={styles.logStatValue}>
                      {log.amount_collected} <Text style={styles.logStatUnit}>{log.unit}</Text>
                    </Text>
                  </View>

                  <View style={styles.logStatItem}>
                    <Text style={styles.logStatLabel}>WASTE TYPE</Text>
                    <Text style={styles.logStatValue}>{log.waste_type || "Residual"}</Text>
                  </View>

                  <View style={styles.logStatItem}>
                    <Text style={styles.logStatLabel}>SERVER TIMESTAMP</Text>
                    <Text style={styles.logTimestamp}>{timeStr}</Text>
                  </View>
                </View>

                {log.notes ? (
                  <Text style={styles.logNotes}>Note: {log.notes}</Text>
                ) : null}

                {log.photo_url ? (
                  <TouchableOpacity
                    style={styles.logPhotoRow}
                    activeOpacity={0.85}
                    onPress={() => setFullPhotoModalUri(resolveMediaUrl(log.photo_url))}
                  >
                    <Image
                      source={{ uri: resolveMediaUrl(log.photo_url) }}
                      style={styles.logPhotoThumbnail}
                    />
                    <View style={styles.logPhotoMeta}>
                      <Text style={styles.logPhotoTitle}>Proof of Pickup Photo</Text>
                      <Text style={styles.logPhotoTap}>Tap to preview full photo</Text>
                    </View>
                    <MaterialCommunityIcons name="image-search-outline" size={20} color="#2E7D32" />
                  </TouchableOpacity>
                ) : null}

                {/* ACTION BUTTONS (TYPO CORRECTION & FINALIZE) */}
                <View style={styles.logActionsRow}>
                  {/* Audit Trail Button */}
                  <TouchableOpacity
                    style={styles.auditBtn}
                    onPress={() => {
                      setViewingAuditsLog(log);
                      setAuditModalVisible(true);
                    }}
                  >
                    <MaterialCommunityIcons name="history" size={14} color="#556655" />
                    <Text style={styles.auditBtnText}>Audit Trail ({log.audits?.length || 1})</Text>
                  </TouchableOpacity>

                  {!isFinalized ? (
                    <View style={styles.actionButtonGroup}>
                      {/* Typo Edit Button */}
                      <TouchableOpacity
                        style={styles.typoBtn}
                        onPress={() => openTypoEditModal(log)}
                      >
                        <MaterialCommunityIcons name="pencil-outline" size={14} color="#1976D2" />
                        <Text style={styles.typoBtnText}>Fix Typo</Text>
                      </TouchableOpacity>

                      {/* Finalize Button */}
                      <TouchableOpacity
                        style={styles.finalizeBtn}
                        onPress={() => handleFinalizeLog(log)}
                      >
                        <MaterialCommunityIcons name="check-decagram" size={14} color="#FFFFFF" />
                        <Text style={styles.finalizeBtnText}>Finalize</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.lockedIndicator}>
                      <MaterialCommunityIcons name="shield-check" size={14} color="#2E7D32" />
                      <Text style={styles.lockedIndicatorText}>Locked at DB Level</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* MODAL 1: RECORD NEW COLLECTION (INSERT-ONLY) */}
      <Modal visible={recordModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Record Collection Log</Text>
                <Text style={styles.modalSubTitle}>Insert-Only • Server Timestamp Enforced</Text>
              </View>
              <TouchableOpacity
                onPress={() => setRecordModalVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialCommunityIcons name="close" size={22} color="#556655" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
              <Text style={styles.modalLabel}>Barangay (CDO 1 to 40)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                {barangaysList.slice(0, 40).map((b) => (
                  <TouchableOpacity
                    key={b.id}
                    style={[styles.modalChip, selectedBrgy === b.name && styles.modalChipActive]}
                    onPress={() => {
                      setSelectedBrgy(b.name);
                      setSelectedBrgyId(b.id);
                    }}
                  >
                    <Text style={[styles.modalChipText, selectedBrgy === b.name && styles.modalChipTextActive]}>
                      {b.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.modalLabel}>Amount Collected (Tons / Volume)</Text>
              <View style={styles.modalInputBox}>
                <MaterialCommunityIcons name="scale" size={18} color="#2E7D32" />
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. 4.50"
                  placeholderTextColor="#9AA998"
                  value={amountCollected}
                  onChangeText={setAmountCollected}
                  keyboardType="numeric"
                />
                <Text style={styles.unitBadge}>tons</Text>
              </View>

              <Text style={styles.modalLabel}>Waste Classification</Text>
              <View style={styles.modalSelectRow}>
                {["Residual", "Biodegradable", "Recyclable", "Commercial"].map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.modalChip, wasteType === t && styles.modalChipActive]}
                    onPress={() => setWasteType(t)}
                  >
                    <Text style={[styles.modalChipText, wasteType === t && styles.modalChipTextActive]}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.modalLabel}>Operational Notes (Optional)</Text>
              <View style={[styles.modalInputBox, { height: 65, alignItems: "flex-start", paddingTop: 8 }]}>
                <TextInput
                  style={[styles.modalInput, { height: "100%" }]}
                  placeholder="e.g. Cleared commercial junction at Main Ave."
                  placeholderTextColor="#9AA998"
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                />
              </View>

              <Text style={styles.modalLabel}>Proof of Pickup Photo (Optional)</Text>
              {pickupPhotoUri ? (
                <View style={styles.photoPreviewCard}>
                  <Image source={{ uri: pickupPhotoUri }} style={styles.photoPreviewImg} />
                  <View style={styles.photoPreviewMeta}>
                    <Text style={styles.photoAttachedTitle}>Photo Captured</Text>
                    <Text style={styles.photoAttachedSub}>Ready for upload to server</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.photoRemoveBtn}
                    onPress={() => {
                      setPickupPhotoUri(null);
                      setPickupPhotoBase64(null);
                    }}
                  >
                    <MaterialCommunityIcons name="trash-can-outline" size={18} color="#C62828" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.photoPickerBox}
                  onPress={handlePickPhoto}
                  activeOpacity={0.82}
                >
                  <MaterialCommunityIcons name="camera-plus-outline" size={24} color="#2E7D32" />
                  <View style={{ marginLeft: 10 }}>
                    <Text style={styles.photoPickerTitle}>Attach Photo Evidence</Text>
                    <Text style={styles.photoPickerSub}>Tap to capture or choose from gallery</Text>
                  </View>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.modalSubmitBtn, submittingLog && { opacity: 0.7 }]}
                onPress={handleSaveCollectionRecord}
                activeOpacity={0.88}
                disabled={submittingLog}
              >
                {submittingLog ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSubmitText}>Submit Actual Collection Log</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL 2: EDIT TYPOGRAPHICAL ERROR (BEFORE FINALIZATION ONLY) */}
      <Modal visible={editModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Fix Typographical Error</Text>
                <Text style={[styles.modalSubTitle, { color: "#C62828" }]}>
                  Only allowed prior to finalization • Audited
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setEditModalVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialCommunityIcons name="close" size={22} color="#556655" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
              <Text style={styles.modalInfoNotice}>
                Log #{editingLog?.id} • {editingLog?.barangay_name}. This update is only to fix typographical mistakes (e.g. 5 tons corrected to 4 tons). Both original and new values will be preserved in the audit trail.
              </Text>

              <Text style={styles.modalLabel}>Correct Amount (Tons)</Text>
              <View style={styles.modalInputBox}>
                <MaterialCommunityIcons name="scale" size={18} color="#1976D2" />
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. 4.00"
                  placeholderTextColor="#9AA998"
                  value={correctedAmount}
                  onChangeText={setCorrectedAmount}
                  keyboardType="numeric"
                />
                <Text style={styles.unitBadge}>tons</Text>
              </View>

              <Text style={styles.modalLabel}>Reason for Correction</Text>
              <View style={[styles.modalInputBox, { height: 60 }]}>
                <TextInput
                  style={styles.modalInput}
                  value={correctionReason}
                  onChangeText={setCorrectionReason}
                  placeholder="Explain why this entry is being modified"
                />
              </View>

              <TouchableOpacity
                style={[styles.modalSubmitBtn, { backgroundColor: "#1976D2" }, savingCorrection && { opacity: 0.7 }]}
                onPress={handleSaveCorrection}
                activeOpacity={0.88}
                disabled={savingCorrection}
              >
                {savingCorrection ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSubmitText}>Save Typo Correction & Audit</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL 3: AUDIT TRAIL VIEWER */}
      <Modal visible={auditModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Permanent Audit Trail</Text>
                <Text style={styles.modalSubTitle}>
                  Log #{viewingAuditsLog?.id} • {viewingAuditsLog?.barangay_name}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setAuditModalVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialCommunityIcons name="close" size={22} color="#556655" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
              <View style={styles.auditList}>
                {viewingAuditsLog?.audits && viewingAuditsLog.audits.length > 0 ? (
                  viewingAuditsLog.audits.map((a, idx) => (
                    <View key={a.id || idx} style={styles.auditItem}>
                      <View style={styles.auditItemHeader}>
                        <View style={styles.actionChip}>
                          <Text style={styles.actionChipText}>{a.action}</Text>
                        </View>
                        <Text style={styles.auditDate}>
                          {new Date(a.created_at).toLocaleString()}
                        </Text>
                      </View>
                      <Text style={styles.auditReason}>{a.reason || "Action logged"}</Text>
                      {a.old_values && (
                        <Text style={styles.auditDiff}>
                          Old Value: {JSON.stringify(a.old_values)}
                        </Text>
                      )}
                      {a.new_values && (
                        <Text style={styles.auditDiffNew}>
                          New Value: {JSON.stringify(a.new_values)}
                        </Text>
                      )}
                    </View>
                  ))
                ) : (
                  <Text style={styles.noAuditsText}>
                    Initial entry submitted at {new Date(viewingAuditsLog?.server_timestamp || Date.now()).toLocaleString()}.
                  </Text>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL 4: FULL PHOTO LIGHTBOX */}
      <Modal visible={Boolean(fullPhotoModalUri)} transparent animationType="fade">
        <View style={styles.lightboxBackdrop}>
          <TouchableOpacity
            style={styles.lightboxCloseBtn}
            onPress={() => setFullPhotoModalUri(null)}
          >
            <MaterialCommunityIcons name="close" size={26} color="#FFFFFF" />
          </TouchableOpacity>
          {fullPhotoModalUri && (
            <Image
              source={{ uri: fullPhotoModalUri }}
              style={styles.lightboxImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      {/* BOTTOM NAVIGATION */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          activeOpacity={0.8}
          onPress={() => router.push("/driver/map" as any)}
        >
          <MaterialCommunityIcons name="map-marker-distance" size={24} color="#7A8D78" />
          <Text style={styles.navItemText}>Route</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          activeOpacity={0.8}
          onPress={() => {}}
        >
          <MaterialCommunityIcons name="truck-fast" size={24} color="#2E7D32" />
          <Text style={[styles.navItemText, styles.navItemTextActive]}>Collection</Text>
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
  greetingRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  greetingTextContainer: {
    alignItems: "flex-end",
    marginRight: 10,
  },
  greetingTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1E331B",
  },
  statusBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  statusDotActive: {
    backgroundColor: "#2E7D32",
  },
  statusDotIdle: {
    backgroundColor: "#D97706",
  },
  greetingSub: {
    fontSize: 10,
    color: "#688264",
    fontWeight: "600",
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#E8F8EE",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#C5EBD2",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 95,
  },
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5ECE4",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 16,
  },
  heroLeft: {
    flex: 1,
  },
  truckPlateBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F8EE",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginBottom: 6,
    gap: 4,
  },
  truckPlateText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#2E7D32",
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#1E331B",
  },
  heroSubtitle: {
    fontSize: 11,
    color: "#688264",
    marginTop: 2,
  },
  stopsIndicatorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    gap: 4,
  },
  stopsIndicatorText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#1E5E22",
  },
  heroRightStatus: {
    marginLeft: 8,
  },
  liveStatusPill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  liveStatusCollecting: {
    backgroundColor: "#E8F8EE",
    borderWidth: 1,
    borderColor: "#A5D6A7",
  },
  liveStatusCompleted: {
    backgroundColor: "#EDE7F6",
    borderWidth: 1,
    borderColor: "#D1C4E9",
  },
  liveStatusStandby: {
    backgroundColor: "#FFF8E1",
    borderWidth: 1,
    borderColor: "#FFE082",
  },
  liveStatusPillText: {
    fontSize: 10,
    fontWeight: "800",
  },
  liveStatusTextCollecting: {
    color: "#2E7D32",
  },
  liveStatusTextCompleted: {
    color: "#512DA8",
  },
  liveStatusTextStandby: {
    color: "#F57F17",
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1E331B",
  },
  sectionSub: {
    fontSize: 10,
    color: "#688264",
    marginTop: 1,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  sectionBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2E7D32",
  },
  quickActionsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
    marginBottom: 16,
    gap: 8,
  },
  actionGridCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5ECE4",
    elevation: 1,
  },
  actionGridCardDisabled: {
    opacity: 0.45,
  },
  actionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  actionLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#3F563E",
    textAlign: "center",
  },
  refreshBtn: {
    padding: 6,
    backgroundColor: "#E8F8EE",
    borderRadius: 8,
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5ECE4",
    marginTop: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1E331B",
    marginTop: 8,
  },
  emptySub: {
    fontSize: 11,
    color: "#688264",
    textAlign: "center",
    marginTop: 4,
    lineHeight: 16,
  },
  logCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E0EAE0",
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  logHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F4EF",
    paddingBottom: 8,
  },
  logBrgyBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  logBrgyTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1E331B",
  },
  logStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 6,
    gap: 3,
  },
  logStatusFinalized: {
    backgroundColor: "#E8F8EE",
    borderWidth: 1,
    borderColor: "#C5EBD2",
  },
  logStatusPending: {
    backgroundColor: "#FFF3E0",
    borderWidth: 1,
    borderColor: "#FFE0B2",
  },
  logStatusText: {
    fontSize: 9,
    fontWeight: "800",
  },
  logDataRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  logStatItem: {
    flex: 1,
  },
  logStatLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#7A8D78",
  },
  logStatValue: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1E331B",
    marginTop: 2,
  },
  logStatUnit: {
    fontSize: 10,
    fontWeight: "600",
    color: "#688264",
  },
  logTimestamp: {
    fontSize: 10,
    color: "#556655",
    marginTop: 2,
    fontWeight: "600",
  },
  logNotes: {
    fontSize: 11,
    color: "#4A6148",
    marginTop: 8,
    fontStyle: "italic",
  },
  logActionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F4F7F3",
  },
  auditBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: "#F0F4EF",
  },
  auditBtnText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#4A6148",
  },
  actionButtonGroup: {
    flexDirection: "row",
    gap: 6,
  },
  typoBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E3F2FD",
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 6,
    gap: 3,
  },
  typoBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1976D2",
  },
  finalizeBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2E7D32",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
    gap: 3,
  },
  finalizeBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  lockedIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  lockedIndicatorText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#2E7D32",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxHeight: "85%",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#1E331B",
  },
  modalSubTitle: {
    fontSize: 10,
    fontWeight: "700",
    color: "#688264",
    marginTop: 2,
  },
  modalScroll: {
    paddingBottom: 10,
  },
  modalInfoNotice: {
    fontSize: 11,
    color: "#556655",
    backgroundColor: "#FFF9C4",
    padding: 8,
    borderRadius: 8,
    marginBottom: 12,
    lineHeight: 16,
  },
  modalLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#3F563E",
    marginTop: 10,
    marginBottom: 6,
  },
  chipScroll: {
    flexDirection: "row",
    marginBottom: 6,
  },
  modalSelectRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  modalChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#F0F4EF",
    borderWidth: 1,
    borderColor: "#D8E6D7",
  },
  modalChipActive: {
    backgroundColor: "#2E7D32",
    borderColor: "#2E7D32",
  },
  modalChipText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#4A6148",
  },
  modalChipTextActive: {
    color: "#FFFFFF",
  },
  modalInputBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F7FAF6",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D8E6D7",
    paddingHorizontal: 12,
    height: 44,
  },
  modalInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    color: "#1E331B",
    fontWeight: "600",
  },
  unitBadge: {
    fontSize: 11,
    fontWeight: "800",
    color: "#688264",
  },
  modalSubmitBtn: {
    backgroundColor: "#2E7D32",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 18,
  },
  modalSubmitText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  auditList: {
    gap: 8,
  },
  auditItem: {
    backgroundColor: "#F7FAF6",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#E5ECE4",
  },
  auditItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  actionChip: {
    backgroundColor: "#E8F8EE",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  actionChipText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#2E7D32",
  },
  auditDate: {
    fontSize: 10,
    color: "#7A8D78",
  },
  auditReason: {
    fontSize: 11,
    color: "#1E331B",
    fontWeight: "600",
  },
  auditDiff: {
    fontSize: 10,
    color: "#C62828",
    marginTop: 2,
  },
  auditDiffNew: {
    fontSize: 10,
    color: "#2E7D32",
    marginTop: 1,
  },
  noAuditsText: {
    fontSize: 11,
    color: "#688264",
    textAlign: "center",
    marginVertical: 12,
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
  photoPreviewCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F8F1",
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: "#C8E6C9",
    marginBottom: 14,
  },
  photoPreviewImg: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: "#E0E0E0",
  },
  photoPreviewMeta: {
    flex: 1,
    marginLeft: 10,
  },
  photoAttachedTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2E7D32",
  },
  photoAttachedSub: {
    fontSize: 11,
    color: "#688264",
    marginTop: 1,
  },
  photoRemoveBtn: {
    padding: 8,
  },
  photoPickerBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F7FAF6",
    borderWidth: 1.5,
    borderColor: "#81C784",
    borderStyle: "dashed",
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  photoPickerTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2E7D32",
  },
  photoPickerSub: {
    fontSize: 11,
    color: "#7A8D78",
  },
  logPhotoRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F7FAF6",
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#E5ECE4",
  },
  logPhotoThumbnail: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: "#E0E0E0",
  },
  logPhotoMeta: {
    flex: 1,
    marginLeft: 10,
  },
  logPhotoTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1E331B",
  },
  logPhotoTap: {
    fontSize: 11,
    color: "#2E7D32",
    marginTop: 1,
  },
  lightboxBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.92)",
    justifyContent: "center",
    alignItems: "center",
  },
  lightboxCloseBtn: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
    backgroundColor: "rgba(255,255,255,0.25)",
    padding: 8,
    borderRadius: 20,
  },
  lightboxImage: {
    width: "92%",
    height: "75%",
  },
  headerBellBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F2F5F2",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  headerBellBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "#C62828",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBellBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "800",
  },
  liveGpsBroadcastingCard: {
    backgroundColor: "#F0FDF4",
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: "#86EFAC",
    shadowColor: "#15803D",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 2,
  },
  liveGpsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  gpsPulseContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  gpsPulseDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#16A34A",
  },
  gpsBroadcastingText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#166534",
    letterSpacing: 0.5,
  },
  gpsPingsBadge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  gpsPingsText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#15803D",
  },
  gpsTelemetryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#DCFCE7",
  },
  gpsTelemetryItem: {
    alignItems: "center",
    flex: 1,
  },
  gpsTelemetryLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#4B5563",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  gpsTelemetryValue: {
    fontSize: 12,
    fontWeight: "800",
    color: "#111827",
  },
  gpsSectorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  gpsSectorSub: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#1E5E22",
  },
});