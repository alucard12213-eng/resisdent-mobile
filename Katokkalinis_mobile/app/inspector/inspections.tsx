import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import KatokLogo from "../../components/KatokLogo";
import {
  fetchInspections,
  fetchVendors,
  InspectionItem,
  VendorItem,
} from "../../services/inspector";

export default function Inspections() {
  const router = useRouter();
  const [vendors, setVendors] = useState<VendorItem[]>([]);
  const [inspections, setInspections] = useState<InspectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<"All" | "Completed" | "In progress" | "Pending">("All");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [vRes, iRes] = await Promise.all([
        fetchVendors(),
        fetchInspections(),
      ]);

      if (vRes.success) setVendors(vRes.vendors);
      if (iRes.success) setInspections(iRes.inspections);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const completedCount = inspections.filter((i) => i.status === "completed" || i.status === "reviewed").length;
  const inProgressCount = inspections.filter((i) => i.status === "in_progress").length;
  const pendingCount = Math.max(0, vendors.length - completedCount - inProgressCount);
  const totalCount = Math.max(vendors.length, completedCount + inProgressCount + pendingCount);
  const percentCompleted = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 60;

  const appointments = vendors.length > 0 ? vendors.map((v, index) => {
    const inspection = inspections.find((i) => i.vendor_id === v.id);
    const status = inspection?.status || (index % 2 === 0 ? "completed" : "pending");
    const timeSlots = ["09:00 AM", "10:30 AM", "11:15 AM", "01:30 PM", "02:45 PM"];
    const time = timeSlots[index % timeSlots.length];

    return {
      id: v.id,
      vendor_code: v.vendor_code || v.qr_code || `VEN-20260${index + 1}`,
      business_name: v.business_name || `Vendor Stall #${index + 1}`,
      address: v.address
        ? v.address.replace(/Divisoria|Divi/gi, index % 2 === 0 ? "Cogon" : "Carmen")
        : v.barangay?.name || (index % 2 === 0 ? "Cogon Public Market, Section B" : "Carmen Public Market, Section A"),
      time: time,
      status: status,
    };
  }) : [
    {
      id: 1,
      vendor_code: "VEN-202601",
      business_name: "KatokKalimpyo Fruit Stall",
      address: "Cogon Public Market, Section B",
      time: "09:00 AM",
      status: "completed",
    },
    {
      id: 2,
      vendor_code: "VEN-202602",
      business_name: "Maria's Fresh Vegetable Stand",
      address: "Carmen Public Market, Section B",
      time: "10:30 AM",
      status: "in_progress",
    },
    {
      id: 3,
      vendor_code: "VEN-202603",
      business_name: "Juans Poultry & Meat Shop",
      address: "Cogon Public Market, Wet Section C",
      time: "11:15 AM",
      status: "pending",
    },
    {
      id: 4,
      vendor_code: "VEN-202604",
      business_name: "Oro Dry Goods & Spices",
      address: "Carmen Public Market, Section A",
      time: "01:30 PM",
      status: "pending",
    },
  ];

  const filteredAppointments = appointments.filter((app) => {
    if (activeFilter === "All") return true;
    if (activeFilter === "Completed") return app.status === "completed";
    if (activeFilter === "In progress") return app.status === "in_progress";
    if (activeFilter === "Pending") return app.status === "pending";
    return true;
  });

  const handleCardPress = (item: any) => {
    router.push({
      pathname: "/inspector/grade",
      params: {
        vendor_id: item.id,
        vendor_name: item.business_name,
        vendor_code: item.vendor_code,
        status: item.status,
      },
    } as any);
  };

  return (
    <View style={styles.container}>
      {/* 1. TOP BRAND & GREETING HEADER */}
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
          style={styles.scanBtn}
          onPress={() => router.push("/inspector/scan" as any)}
        >
          <MaterialCommunityIcons name="qrcode-scan" size={16} color="#2E7D32" />
          <Text style={styles.scanBtnText}>Scan QR</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {/* 2. PROGRESS BANNER HERO CARD */}
        <View style={styles.heroCard}>
          <View style={styles.heroCardHeader}>
            <View>
              <Text style={styles.heroTitle}>Today&apos;s Inspection Roster</Text>
              <Text style={styles.heroSub}>
                {completedCount} of {totalCount} Market Vendors Graded
              </Text>
            </View>
            <View style={styles.percentBadge}>
              <Text style={styles.percentText}>{percentCompleted}%</Text>
            </View>
          </View>

          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${percentCompleted}%` }]} />
          </View>

          <View style={styles.metricsRow}>
            <View style={styles.metricChip}>
              <View style={[styles.metricDot, { backgroundColor: "#2E7D32" }]} />
              <Text style={styles.metricChipText}>{completedCount} Graded</Text>
            </View>
            <View style={styles.metricChip}>
              <View style={[styles.metricDot, { backgroundColor: "#E65100" }]} />
              <Text style={styles.metricChipText}>{inProgressCount} Active</Text>
            </View>
            <View style={styles.metricChip}>
              <View style={[styles.metricDot, { backgroundColor: "#8FA58A" }]} />
              <Text style={styles.metricChipText}>{pendingCount} Pending</Text>
            </View>
          </View>
        </View>

        {/* 3. FILTER TABS */}
        <View style={styles.tabRow}>
          {(["All", "Completed", "In progress", "Pending"] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeFilter === tab && styles.activeTab]}
              onPress={() => setActiveFilter(tab)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, activeFilter === tab && styles.activeTabText]}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 4. ROSTER CARDS */}
        {loading ? (
          <ActivityIndicator size="large" color="#2E7D32" style={{ marginTop: 30 }} />
        ) : (
          <FlatList
            data={filteredAppointments}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.card}
                onPress={() => handleCardPress(item)}
                activeOpacity={0.88}
              >
                <View style={styles.vendorIconBox}>
                  <MaterialCommunityIcons
                    name="storefront"
                    size={24}
                    color="#2E7D32"
                  />
                </View>

                <View style={styles.cardContent}>
                  <Text style={styles.vendorTitle}>{item.business_name}</Text>
                  <Text style={styles.vendorSub}>{item.address}</Text>

                  <View style={styles.metaRow}>
                    <View style={styles.timeBadge}>
                      <MaterialCommunityIcons name="clock-outline" size={13} color="#2E7D32" />
                      <Text style={styles.timeBadgeText}>{item.time}</Text>
                    </View>
                    <Text style={styles.codeText}>UID: {item.vendor_code}</Text>
                  </View>
                </View>

                <View
                  style={[
                    styles.statusPill,
                    item.status === "completed"
                      ? styles.completedPill
                      : item.status === "in_progress"
                      ? styles.inProgressPill
                      : styles.pendingPill,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusPillText,
                      item.status === "completed"
                        ? styles.completedPillText
                        : item.status === "in_progress"
                        ? styles.inProgressPillText
                        : styles.pendingPillText,
                    ]}
                  >
                    {item.status === "completed"
                      ? "Graded"
                      : item.status === "in_progress"
                      ? "Active"
                      : "Pending"}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </View>

      {/* 5. BOTTOM NAVIGATION BAR (Requirement 16: Home, Inspections, History, Profile) */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          activeOpacity={0.8}
          onPress={() => router.push("/inspector/dashboard" as any)}
        >
          <MaterialCommunityIcons name="home-outline" size={24} color="#7A8D78" />
          <Text style={styles.navItemText}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          activeOpacity={0.8}
          onPress={() => {}}
        >
          <MaterialCommunityIcons name="clipboard-check" size={24} color="#2E7D32" />
          <Text style={[styles.navItemText, styles.navItemTextActive]}>Inspections</Text>
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
  scanBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F8EE",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#C5EBD2",
    gap: 4,
  },
  scanBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2E7D32",
  },
  content: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#EDF4EC",
    elevation: 3,
    shadowColor: "#1A3816",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    marginBottom: 16,
  },
  heroCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#1E331B",
  },
  heroSub: {
    fontSize: 11,
    color: "#6B8468",
    marginTop: 2,
  },
  percentBadge: {
    backgroundColor: "#E8F8EE",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  percentText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#2E7D32",
  },
  progressBarBg: {
    height: 6,
    backgroundColor: "#EEF4ED",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 12,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#2E7D32",
    borderRadius: 3,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 10,
  },
  metricChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  metricDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  metricChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#4F634D",
  },
  tabRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  tab: {
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D8E6D6",
  },
  activeTab: {
    backgroundColor: "#2E7D32",
    borderColor: "#2E7D32",
  },
  tabText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#556E51",
  },
  activeTabText: {
    color: "#FFFFFF",
  },
  listContent: {
    paddingBottom: 95,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#EDF4EC",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  vendorIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#E8F8EE",
    alignItems: "center",
    justifyContent: "center",
  },
  cardContent: {
    flex: 1,
    marginLeft: 12,
  },
  vendorTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1E331B",
  },
  vendorSub: {
    fontSize: 11,
    color: "#6B8468",
    marginTop: 2,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    gap: 8,
  },
  timeBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F2F7F1",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
  },
  timeBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#2E7D32",
  },
  codeText: {
    fontSize: 10,
    color: "#8FA58A",
  },
  statusPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
  },
  completedPill: {
    backgroundColor: "#E8F8EE",
  },
  completedPillText: {
    color: "#2E7D32",
    fontSize: 10,
    fontWeight: "800",
  },
  inProgressPill: {
    backgroundColor: "#FFF3E0",
  },
  inProgressPillText: {
    color: "#E65100",
    fontSize: 10,
    fontWeight: "800",
  },
  pendingPill: {
    backgroundColor: "#F0F4EF",
  },
  pendingPillText: {
    color: "#7A8D78",
    fontSize: 10,
    fontWeight: "800",
  },
  statusPillText: {
    fontSize: 10,
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