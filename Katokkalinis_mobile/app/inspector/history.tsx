import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import KatokLogo from "../../components/KatokLogo";
import { fetchInspections } from "../../services/inspector";

interface InspectionItem {
  id: number | string;
  vendorName: string;
  stall: string;
  market: string;
  score: number;
  grade: string;
  status: string;
  date: string;
  notes?: string;
}

const DEFAULT_HISTORY: InspectionItem[] = [
  {
    id: 1,
    vendorName: "KatokKalimpyo",
    stall: "Stall #12",
    market: "Cogon Public Market",
    score: 92,
    grade: "Grade A",
    status: "Passed",
    date: "May 10, 2026",
    notes: "Excellent segregation and clean preparation surface.",
  },
  {
    id: 2,
    vendorName: "KalimpyoKatok",
    stall: "Stall #45",
    market: "Cogon Public Market",
    score: 85,
    grade: "Grade B",
    status: "Passed",
    date: "May 8, 2026",
    notes: "Minor storage organization needed near wash basin.",
  },
  {
    id: 3,
    vendorName: "Aling Nena Store",
    stall: "Stall #03",
    market: "Carmen Public Market",
    score: 74,
    grade: "Grade C",
    status: "Warning",
    date: "May 5, 2026",
    notes: "Grease trap cleaning due. Re-inspection required next week.",
  },
];

export default function InspectorHistory() {
  const router = useRouter();
  const [history, setHistory] = useState<InspectionItem[]>(DEFAULT_HISTORY);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const res = await fetchInspections();
      if (res && res.success && Array.isArray(res.inspections) && res.inspections.length > 0) {
        const formatted: InspectionItem[] = res.inspections.map((i: any) => ({
          id: i.id,
          vendorName: i.vendor?.business_name || i.vendor?.owner_name || "Vendor",
          stall: i.vendor?.stall_number || "Stall #",
          market: (i.vendor?.market || "Cogon Public Market").replace(/Divisoria|Divi/gi, "Cogon"),
          score: Number(i.total_score || i.compliance_level || 85),
          grade: (i.total_score || 85) >= 90 ? "Grade A" : (i.total_score || 85) >= 80 ? "Grade B" : "Grade C",
          status: (i.total_score || 85) >= 75 ? "Passed" : "Action Required",
          date: i.inspected_at ? new Date(i.inspected_at).toLocaleDateString() : "Recent",
          notes: i.notes || "Sanitation compliance inspection completed.",
        }));
        setHistory(formatted);
      }
    } catch {
      // Use fallback data
    } finally {
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadHistory();
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
          style={styles.scanBtn}
          onPress={() => router.push("/inspector/scan" as any)}
        >
          <MaterialCommunityIcons name="qrcode-scan" size={16} color="#2E7D32" />
          <Text style={styles.scanBtnText}>Scan QR</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#2E7D32"]} />}
      >
        {/* 2. TITLE BAR */}
        <View style={styles.titleSection}>
          <Text style={styles.pageTitle}>Inspection History</Text>
          <Text style={styles.pageSubtitle}>
            Completed market vendor audits and compliance certifications
          </Text>
        </View>

        {/* 3. HISTORY LIST */}
        <View style={styles.list}>
          {history.map((item) => {
            const isPassed = item.score >= 75;
            return (
              <View key={item.id} style={styles.historyCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.storeIconCircle}>
                    <MaterialCommunityIcons name="store" size={22} color="#2E7D32" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.vendorName}>{item.vendorName}</Text>
                    <Text style={styles.marketText}>{item.stall} • {item.market}</Text>
                  </View>
                  <View
                    style={[
                      styles.gradeBadge,
                      item.grade === "Grade A"
                        ? styles.gradeABadge
                        : item.grade === "Grade B"
                        ? styles.gradeBBadge
                        : styles.gradeCBadge,
                    ]}
                  >
                    <Text
                      style={[
                        styles.gradeText,
                        item.grade === "Grade A"
                          ? styles.gradeAText
                          : item.grade === "Grade B"
                          ? styles.gradeBText
                          : styles.gradeCText,
                      ]}
                    >
                      {item.grade}
                    </Text>
                  </View>
                </View>

                {item.notes ? (
                  <View style={styles.notesBox}>
                    <Text style={styles.notesText}>{item.notes}</Text>
                  </View>
                ) : null}

                <View style={styles.cardFooter}>
                  <View style={styles.footerItem}>
                    <Text style={styles.footerLabel}>SCORE</Text>
                    <Text style={[styles.footerValue, { color: isPassed ? "#2E7D32" : "#D97706" }]}>
                      {item.score}%
                    </Text>
                  </View>

                  <View style={styles.footerItem}>
                    <Text style={styles.footerLabel}>STATUS</Text>
                    <Text style={[styles.footerValue, { color: isPassed ? "#2E7D32" : "#C62828" }]}>
                      {item.status}
                    </Text>
                  </View>

                  <View style={styles.footerItem}>
                    <Text style={styles.footerLabel}>DATE</Text>
                    <Text style={styles.footerValue}>{item.date}</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* 4. BOTTOM NAVIGATION (Requirement 16: Home, Inspections, History, Profile) */}
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
          onPress={() => router.push("/inspector/inspections" as any)}
        >
          <MaterialCommunityIcons name="clipboard-check-outline" size={24} color="#7A8D78" />
          <Text style={styles.navItemText}>Inspections</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          activeOpacity={0.8}
          onPress={() => {}}
        >
          <MaterialCommunityIcons name="history" size={24} color="#2E7D32" />
          <Text style={[styles.navItemText, styles.navItemTextActive]}>History</Text>
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
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 95,
  },
  titleSection: {
    marginBottom: 16,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#1E331B",
  },
  pageSubtitle: {
    fontSize: 12,
    color: "#688264",
    marginTop: 2,
    fontWeight: "500",
  },
  list: {
    gap: 12,
  },
  historyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#EDF4EC",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  storeIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#E8F8EE",
    alignItems: "center",
    justifyContent: "center",
  },
  vendorName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1E331B",
  },
  marketText: {
    fontSize: 11,
    color: "#6B8468",
    marginTop: 1,
  },
  gradeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  gradeABadge: {
    backgroundColor: "#E8F8EE",
  },
  gradeAText: {
    color: "#2E7D32",
    fontSize: 11,
    fontWeight: "900",
  },
  gradeBBadge: {
    backgroundColor: "#E3F2FD",
  },
  gradeBText: {
    color: "#1976D2",
    fontSize: 11,
    fontWeight: "900",
  },
  gradeCBadge: {
    backgroundColor: "#FFF3E0",
  },
  gradeCText: {
    color: "#E65100",
    fontSize: 11,
    fontWeight: "900",
  },
  gradeText: {
    fontSize: 11,
    fontWeight: "900",
  },
  notesBox: {
    backgroundColor: "#F9FAF8",
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#EEF3ED",
  },
  notesText: {
    fontSize: 12,
    lineHeight: 17,
    color: "#425640",
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F4F8F3",
  },
  footerItem: {
    flex: 1,
  },
  footerLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: "#8DA78B",
    letterSpacing: 0.4,
  },
  footerValue: {
    fontSize: 12,
    fontWeight: "800",
    color: "#1E331B",
    marginTop: 2,
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
