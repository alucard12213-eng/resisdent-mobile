import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import KatokLogo from "../../components/KatokLogo";
import { logoutUser } from "../../services/auth";
import { getDriverCollectionLogs } from "../../services/driver";

interface CollectionRecord {
  id: string;
  barangay: string;
  weightKg: string;
  binsCount: string;
  wasteType: string;
  timestamp: string;
}

export default function DriverProfile() {
  const router = useRouter();

  const [name, setName] = useState("John Driver");
  const [email, setEmail] = useState("driver@katokkalinis.com");
  const [driverId, setDriverId] = useState("DRV-2026");
  const assignedTruck = "Compactor Truck #04 (KAL-104)";
  const [completedStops, setCompletedStops] = useState("0");
  const [totalWeightCollected, setTotalWeightCollected] = useState("0.0 tons");

  // Collection records directly populated from real driver logs
  const [collectionHistory, setCollectionHistory] = useState<CollectionRecord[]>([]);

  useEffect(() => {
    loadProfileData();
    loadCollectionHistory();
  }, []);

  const loadProfileData = async () => {
    try {
      const storedName = await AsyncStorage.getItem("userName");
      const storedEmail = await AsyncStorage.getItem("userEmail");
      const storedId = await AsyncStorage.getItem("userId");

      if (storedName) setName(storedName);
      if (storedEmail) setEmail(storedEmail);
      if (storedId) setDriverId(`DRV-${storedId}`);
    } catch (e) {
      console.error(e);
    }
  };

  const loadCollectionHistory = async () => {
    try {
      // 1. Fetch real collection records from the database
      const logs = await getDriverCollectionLogs({ myLogsOnly: true });
      if (Array.isArray(logs) && logs.length > 0) {
        setCompletedStops(logs.length.toString());
        const totalTons = logs.reduce((sum, item) => sum + (Number(item.amount_collected) || 0), 0);
        setTotalWeightCollected(`${totalTons.toFixed(1)} tons`);

        const formatted: CollectionRecord[] = logs.map((log) => {
          let timeStr = "Recent";
          if (log.created_at) {
            const d = new Date(log.created_at);
            timeStr =
              d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
              " • " +
              d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
          }
          return {
            id: String(log.id),
            barangay: log.barangay_name,
            weightKg: `${log.amount_collected} ${log.unit || "tons"}`,
            binsCount: log.is_finalized ? "Finalized" : "Field Log",
            wasteType: log.waste_type || "Residual Waste",
            timestamp: timeStr,
          };
        });
        setCollectionHistory(formatted);
        return;
      }

      // 2. Offline fallback
      const raw = await AsyncStorage.getItem("driver_collection_records");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCollectionHistory(parsed);
          setCompletedStops(parsed.length.toString());
          return;
        }
      }

      setCompletedStops("0");
      setTotalWeightCollected("0.0 tons");
      setCollectionHistory([]);
    } catch (e) {
      console.error("Failed to load collection logs in profile:", e);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      "Confirm Logout",
      "Are you sure you want to log out of your driver account?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            await logoutUser(router);
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
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

        <TouchableOpacity
          style={styles.logoutTopBtn}
          onPress={handleLogout}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialCommunityIcons name="logout" size={20} color="#C62828" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 2. DRIVER PROFILE HERO CARD (Dashboard Aesthetic) */}
        <View style={styles.profileHeroCard}>
          <View style={styles.avatarWrapper}>
            <View style={styles.avatarCircle}>
              <MaterialCommunityIcons name="account" size={48} color="#2E7D32" />
            </View>
            <View style={styles.onlineBadge} />
          </View>

          <Text style={styles.driverName}>{name}</Text>
          <Text style={styles.driverEmail}>{email}</Text>

          <View style={styles.tagRow}>
            <View style={styles.roleTag}>
              <MaterialCommunityIcons name="truck-fast" size={14} color="#2E7D32" />
              <Text style={styles.roleTagText}>Official Collection Driver</Text>
            </View>
            <View style={styles.idTag}>
              <Text style={styles.idTagText}>{driverId}</Text>
            </View>
          </View>

          {/* Stats Bar */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{completedStops}</Text>
              <Text style={styles.statLabel}>Completed Runs</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: "#2E7D32" }]}>{totalWeightCollected}</Text>
              <Text style={styles.statLabel}>Waste Logged</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: "#D97706" }]}>KAL-104</Text>
              <Text style={styles.statLabel}>Assigned Truck</Text>
            </View>
          </View>
        </View>

        {/* 3. ASSIGNED EQUIPMENT CARD */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Assigned Vehicle & Duty</Text>

          <View style={styles.dutyRow}>
            <View style={[styles.dutyIconCircle, { backgroundColor: "#E8F8EE" }]}>
              <MaterialCommunityIcons name="dump-truck" size={22} color="#2E7D32" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.dutyMainText}>{assignedTruck}</Text>
              <Text style={styles.dutySubText}>6-Wheel Municipal Waste Compactor</Text>
            </View>
          </View>

          <View style={[styles.dutyRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
            <View style={[styles.dutyIconCircle, { backgroundColor: "#E3F2FD" }]}>
              <MaterialCommunityIcons name="map-marker-path" size={22} color="#1976D2" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.dutyMainText}>Compactor Route #04 • South Poblacion</Text>
              <Text style={styles.dutySubText}>Barangays 31 to 40 (Mon • Wed • Fri | 08:00 AM – 11:00 AM)</Text>
            </View>
          </View>
        </View>

        {/* 4. COLLECTION HISTORY (Populated from live driver collection records) */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Collection History</Text>
          <Text style={styles.sectionSub}>{collectionHistory.length} Recorded Runs</Text>
        </View>

        <View style={styles.historyList}>
          {collectionHistory.length === 0 ? (
            <View style={styles.emptyHistoryCard}>
              <MaterialCommunityIcons name="clipboard-text-outline" size={32} color="#8DA78B" />
              <Text style={styles.emptyHistoryText}>No collection logs recorded yet.</Text>
            </View>
          ) : (
            collectionHistory.map((item, index) => (
              <View
                key={item.id || index}
                style={[
                  styles.historyCard,
                  index === collectionHistory.length - 1 && { marginBottom: 0 },
                ]}
              >
                <View style={styles.historyTopRow}>
                  <View style={styles.historyBarangayTag}>
                    <MaterialCommunityIcons name="map-marker" size={13} color="#2E7D32" />
                    <Text style={styles.historyBarangayText}>{item.barangay}</Text>
                  </View>

                  <Text style={styles.historyTimestamp}>{item.timestamp}</Text>
                </View>

                <View style={styles.historyMetricsRow}>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>STATUS</Text>
                    <Text style={styles.metricValue}>{item.binsCount}</Text>
                  </View>

                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>DISPOSAL WEIGHT</Text>
                    <Text style={[styles.metricValue, { color: "#2E7D32" }]}>{item.weightKg}</Text>
                  </View>

                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>CATEGORY</Text>
                    <Text style={styles.metricValue}>{item.wasteType}</Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>

        {/* 5. LOGOUT BUTTON (Navigation Guarded) */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.85}
        >
          <MaterialCommunityIcons name="logout" size={20} color="#C62828" />
          <Text style={styles.logoutButtonText}>Log Out of Driver Account</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* 6. BOTTOM NAVIGATION (Requirement 13: Exactly 3 Tabs) */}
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
          onPress={() => router.push("/driver/dashboard" as any)}
        >
          <MaterialCommunityIcons name="truck-fast" size={24} color="#7A8D78" />
          <Text style={styles.navItemText}>Collection</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          activeOpacity={0.8}
          onPress={() => {}}
        >
          <MaterialCommunityIcons name="account" size={24} color="#2E7D32" />
          <Text style={[styles.navItemText, styles.navItemTextActive]}>Profile</Text>
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
  logoutTopBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFEBEE",
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 95,
  },
  profileHeroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EDF4EC",
    elevation: 3,
    shadowColor: "#1A3816",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    marginBottom: 16,
  },
  avatarWrapper: {
    position: "relative",
    marginBottom: 10,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#E8F8EE",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#C5E6CE",
  },
  onlineBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#2E7D32",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  driverName: {
    fontSize: 20,
    fontWeight: "900",
    color: "#1E331B",
  },
  driverEmail: {
    fontSize: 12,
    color: "#688264",
    marginTop: 2,
  },
  tagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  roleTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F8EE",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    gap: 4,
  },
  roleTagText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#2E7D32",
  },
  idTag: {
    backgroundColor: "#F2F7F1",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  idTagText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#4F634D",
  },
  statsRow: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-around",
    alignItems: "center",
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#EEF4ED",
  },
  statBox: {
    alignItems: "center",
    flex: 1,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "900",
    color: "#1E331B",
  },
  statLabel: {
    fontSize: 10,
    color: "#7A8D78",
    marginTop: 2,
    fontWeight: "600",
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: "#EEF4ED",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#EDF4EC",
    marginBottom: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1E331B",
    marginBottom: 12,
  },
  dutyRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 12,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F7F1",
  },
  dutyIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  dutyMainText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1E331B",
  },
  dutySubText: {
    fontSize: 11,
    color: "#6B8468",
    marginTop: 2,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1E331B",
  },
  sectionSub: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2E7D32",
  },
  historyList: {
    gap: 10,
    marginBottom: 20,
  },
  historyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#EDF4EC",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  historyTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  historyBarangayTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F8EE",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  historyBarangayText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#2E7D32",
  },
  historyTimestamp: {
    fontSize: 11,
    color: "#8DA78B",
  },
  historyMetricsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F4F8F3",
  },
  metricItem: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#8DA78B",
    letterSpacing: 0.4,
  },
  metricValue: {
    fontSize: 12,
    fontWeight: "800",
    color: "#1E331B",
    marginTop: 2,
  },
  emptyHistoryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2EFE1",
    marginBottom: 16,
    gap: 8,
  },
  emptyHistoryText: {
    fontSize: 13,
    color: "#7A8D78",
    fontWeight: "600",
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFEBEE",
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#FFCDD2",
    gap: 8,
    marginBottom: 10,
  },
  logoutButtonText: {
    color: "#C62828",
    fontSize: 14,
    fontWeight: "800",
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
