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
import { fetchInspectorStats } from "../../services/inspector";

export default function InspectorDashboard() {
  const router = useRouter();
  const [userName, setUserName] = useState("John Inspector");
  const assignedArea = "Cogon & Carmen Public Markets";
  const [pendingCount, setPendingCount] = useState(0);
  const [completedToday, setCompletedToday] = useState(0);

  const [banner, setBanner] = useState({
    visible: true,
    title: "Market Inspection Roster Loaded",
    message: "Vendor hygiene inspections loaded for today's roster.",
    type: "info" as "truck" | "info" | "success" | "warning",
  });

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const name = await AsyncStorage.getItem("userName");
      if (name) setUserName(name);

      const statsRes = await fetchInspectorStats();
      if (statsRes.success && statsRes.stats) {
        setPendingCount(statsRes.stats.pending_reviews);
        setCompletedToday(statsRes.stats.completed_today);
        setBanner({
          visible: true,
          title: "Market Inspection Roster Active",
          message: `${statsRes.stats.pending_reviews} inspections awaiting review • ${statsRes.stats.completed_today} completed today.`,
          type: "info",
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Banner Alert (Requirement 21) */}
      <TopNotificationBanner
        visible={banner.visible}
        title={banner.title}
        message={banner.message}
        type={banner.type}
        onDismiss={() => setBanner((prev) => ({ ...prev, visible: false }))}
      />

      {/* 1. TOP BRAND & GREETING HEADER */}
      <View style={styles.topHeader}>
        <KatokLogo variant="header" showTagline={false} />

        <TouchableOpacity
          style={styles.greetingRight}
          activeOpacity={0.85}
          onPress={() => router.push("/inspector/profile" as any)}
        >
          <View style={styles.greetingTextContainer}>
            <Text style={styles.greetingTitle}>Hello, {userName}!</Text>
            <Text style={styles.greetingSub}>Official Sanitary Inspector</Text>
          </View>
          <View style={styles.avatarCircle}>
            <MaterialCommunityIcons name="account-check" size={22} color="#2E7D32" />
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 2. TODAY'S INSPECTION ROSTER HERO CARD */}
        <View style={styles.heroCard}>
          <View style={styles.heroLeft}>
            <View style={styles.badgeRow}>
              <MaterialCommunityIcons name="clipboard-text-clock" size={14} color="#2E7D32" />
              <Text style={styles.badgeText}>Active Duty Roster</Text>
            </View>
            <Text style={styles.heroTitle}>Today&apos;s Inspections</Text>
            <Text style={styles.heroSubtitle}>{assignedArea}</Text>

            <View style={styles.metricPillRow}>
              <View style={styles.metricPill}>
                <Text style={styles.metricPillVal}>{pendingCount} Pending</Text>
              </View>
              <View style={[styles.metricPill, { backgroundColor: "#E8F8EE" }]}>
                <Text style={[styles.metricPillVal, { color: "#2E7D32" }]}>
                  {completedToday} Cleared
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.heroRightIconBox}>
            <MaterialCommunityIcons name="shield-check" size={42} color="#2E7D32" />
          </View>
        </View>

        {/* 3. QUICK ACTIONS (Requirement 15) */}
        <Text style={styles.sectionTitle}>Inspector Quick Actions</Text>

        <View style={styles.quickActionsGrid}>
          {/* Action 1: Scan Vendor QR */}
          <TouchableOpacity
            style={styles.actionGridCard}
            activeOpacity={0.85}
            onPress={() => router.push("/inspector/scan" as any)}
          >
            <View style={[styles.actionIconBox, { backgroundColor: "#E8F8EE" }]}>
              <MaterialCommunityIcons name="qrcode-scan" size={26} color="#2E7D32" />
            </View>
            <Text style={styles.actionLabel}>Scan Vendor QR</Text>
          </TouchableOpacity>

          {/* Action 2: View Vendor */}
          <TouchableOpacity
            style={styles.actionGridCard}
            activeOpacity={0.85}
            onPress={() => router.push("/inspector/inspections" as any)}
          >
            <View style={[styles.actionIconBox, { backgroundColor: "#E3F2FD" }]}>
              <MaterialCommunityIcons name="storefront-outline" size={26} color="#1976D2" />
            </View>
            <Text style={styles.actionLabel}>View Vendor</Text>
          </TouchableOpacity>

          {/* Action 3: Inspection History */}
          <TouchableOpacity
            style={styles.actionGridCard}
            activeOpacity={0.85}
            onPress={() => router.push("/inspector/history" as any)}
          >
            <View style={[styles.actionIconBox, { backgroundColor: "#FFF3E0" }]}>
              <MaterialCommunityIcons name="history" size={26} color="#E65100" />
            </View>
            <Text style={styles.actionLabel}>Inspection History</Text>
          </TouchableOpacity>
        </View>

        {/* 4. TODAY'S PRIORITY VENDORS SUMMARY */}
        <View style={styles.priorityHeaderRow}>
          <Text style={styles.sectionTitle}>Priority Vendor Stalls</Text>
          <TouchableOpacity onPress={() => router.push("/inspector/inspections" as any)}>
            <Text style={styles.viewAllLink}>View All Roster</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.vendorCardList}>
          <TouchableOpacity
            style={styles.vendorItemCard}
            activeOpacity={0.88}
            onPress={() =>
              router.push({
                pathname: "/inspector/grade",
                params: {
                  vendor_id: 1,
                  vendor_name: "KatokKalimpyo Fresh Fruits",
                  vendor_code: "2026012345",
                },
              } as any)
            }
          >
            <View style={[styles.vendorIconCircle, { backgroundColor: "#E8F8EE" }]}>
              <MaterialCommunityIcons name="store" size={22} color="#2E7D32" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.vendorNameText}>KatokKalimpyo Fresh Fruits</Text>
              <Text style={styles.vendorStallText}>Stall #12 • Carmen Public Market</Text>
            </View>
            <View style={styles.actionBadge}>
              <Text style={styles.actionBadgeText}>Grade Now</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.vendorItemCard}
            activeOpacity={0.88}
            onPress={() =>
              router.push({
                pathname: "/inspector/grade",
                params: {
                  vendor_id: 2,
                  vendor_name: "KalimpyoKatok Vegetable Stand",
                  vendor_code: "2026012346",
                },
              } as any)
            }
          >
            <View style={[styles.vendorIconCircle, { backgroundColor: "#E3F2FD" }]}>
              <MaterialCommunityIcons name="store" size={22} color="#1976D2" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.vendorNameText}>KalimpyoKatok Vegetable Stand</Text>
              <Text style={styles.vendorStallText}>Stall #45 • Cogon Public Market</Text>
            </View>
            <View style={styles.actionBadge}>
              <Text style={styles.actionBadgeText}>Grade Now</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* 5. BOTTOM NAVIGATION BAR (Requirement 16: Home, Inspections, History, Profile) */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          activeOpacity={0.8}
          onPress={() => { }}
        >
          <MaterialCommunityIcons name="home" size={24} color="#2E7D32" />
          <Text style={[styles.navItemText, styles.navItemTextActive]}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          activeOpacity={0.8}
          onPress={() => router.push("/inspector/inspections" as any)}
        >
          <MaterialCommunityIcons name="clipboard-check-outline" size={24} color="#7A8D78" />
          <Text style={styles.navItemText}>Inspections</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          activeOpacity={0.8}
          onPress={() => router.push("/inspector/history" as any)}
        >
          <MaterialCommunityIcons name="history" size={24} color="#7A8D78" />
          <Text style={styles.navItemText}>History</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          activeOpacity={0.8}
          onPress={() => router.push("/inspector/profile" as any)}
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
  greetingSub: {
    fontSize: 10,
    color: "#688264",
    fontWeight: "600",
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
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#EDF4EC",
    elevation: 3,
    shadowColor: "#1A3816",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    marginBottom: 16,
  },
  heroLeft: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F8EE",
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginBottom: 6,
    gap: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#2E7D32",
  },
  heroTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#1E331B",
  },
  heroSubtitle: {
    fontSize: 12,
    color: "#6B8468",
    marginTop: 2,
  },
  metricPillRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  metricPill: {
    backgroundColor: "#FFF3E0",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  metricPillVal: {
    fontSize: 11,
    fontWeight: "800",
    color: "#E65100",
  },
  heroRightIconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#E8F8EE",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1E331B",
    marginBottom: 12,
  },
  quickActionsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
    gap: 10,
  },
  actionGridCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EDF4EC",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  actionIconBox: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#273824",
    textAlign: "center",
  },
  priorityHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  viewAllLink: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2E7D32",
  },
  vendorCardList: {
    gap: 10,
  },
  vendorItemCard: {
    flexDirection: "row",
    alignItems: "center",
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
  vendorIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  vendorNameText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1E331B",
  },
  vendorStallText: {
    fontSize: 11,
    color: "#6B8468",
    marginTop: 1,
  },
  actionBadge: {
    backgroundColor: "#2E7D32",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  actionBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
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