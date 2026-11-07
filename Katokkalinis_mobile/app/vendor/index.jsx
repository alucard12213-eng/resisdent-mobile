import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import InitialsAvatar from "../../components/InitialsAvatar";
import KatokLogo from "../../components/KatokLogo";
import TopNotificationBanner from "../../components/TopNotificationBanner";
import VendorHotbar from "../../components/VendorHotbar";
import { resolveMediaUrl } from "../../services/api";
import { fetchVendorEvaluation, fetchVendorStatus } from "../../services/vendor";

export default function VendorDashboard() {
  const router = useRouter();

  const [vendorName, setVendorName] = useState("Katok Vendor");
  const [vendorCode, setVendorCode] = useState("2026012345");
  const [stallNumber, setStallNumber] = useState("Stall #12");
  const [marketLocation, setMarketLocation] = useState("Cogon Public Market");
  const [avatarUri, setAvatarUri] = useState(null);

  // Single Source of Truth Evaluation State
  const [evaluation, setEvaluation] = useState({
    id: null,
    grade: "A",
    total_score: 100,
    hygiene_score: 100,
    premises_score: 100,
    pest_control_score: 100,
    violations_count: 0,
    notes: "Excellent segregation and clean food preparation surface.",
    inspected_at_formatted: "May 10, 2026",
    inspector_name: "John Inspector",
    valid_through: "Q2 2026",
    updated_at: null,
    has_pending_change: false,
  });

  const lastEvalRef = useRef({
    updated_at: null,
    total_score: null,
    isFirst: true,
  });

  // Modals for Quick Actions
  const [gradesModalVisible, setGradesModalVisible] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);

  // Top Banner Alert
  const [banner, setBanner] = useState({
    visible: true,
    title: "Sanitation Certificate Valid",
    message: "Your stall is certified Grade A through end of quarter.",
    type: "success",
  });

  const loadData = useCallback(async () => {
    try {
      const storedName = await AsyncStorage.getItem("userName");
      const storedId = await AsyncStorage.getItem("userId");
      const storedAvatar = await AsyncStorage.getItem("userAvatar");

      if (storedName) setVendorName(storedName);
      if (storedId) setVendorCode(`2026${storedId.padStart(6, "0")}`);
      if (storedAvatar) setAvatarUri(storedAvatar);

      const statusRes = await fetchVendorStatus();
      if (statusRes?.success && statusRes.user) {
        if (statusRes.user.name) setVendorName(statusRes.user.name);
        if (statusRes.user.vendor?.vendor_code) {
          setVendorCode(statusRes.user.vendor.vendor_code);
        }
        if (statusRes.user.vendor?.stall_number) {
          setStallNumber(statusRes.user.vendor.stall_number);
        }
        if (statusRes.user.vendor?.market) {
          const m = statusRes.user.vendor.market;
          setMarketLocation(/divi/i.test(m) ? "Cogon Public Market" : m);
        }
        if (statusRes.user.avatar || statusRes.user.avatar_url) {
          const resolved = resolveMediaUrl(statusRes.user.avatar_url || statusRes.user.avatar);
          if (resolved) {
            setAvatarUri(resolved);
            await AsyncStorage.setItem("userAvatar", resolved);
          }
        }
      }
    } catch (error) {
      console.error("Vendor loadData error:", error);
    }
  }, []);

  // Real-Time Instant Sync with Database Evaluation
  const syncEvaluation = useCallback(async (isSilent = false) => {
    try {
      const res = await fetchVendorEvaluation();
      if (res?.success && res.evaluation) {
        const ev = res.evaluation;
        const prev = lastEvalRef.current;

        // When admin approves a change, updated_at or score updates in the database
        if (
          !prev.isFirst &&
          prev.updated_at &&
          (prev.updated_at !== ev.updated_at || prev.total_score !== ev.total_score)
        ) {
          setBanner({
            visible: true,
            title: "Evaluation Updated Real-Time",
            message: `Admin approved updated inspection rating: Grade ${ev.grade} (${ev.total_score}%).`,
            type: "success",
          });
          try {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch {}
        }

        lastEvalRef.current = {
          updated_at: ev.updated_at,
          total_score: ev.total_score,
          isFirst: false,
        };

        setEvaluation(ev);
      }
    } catch (err) {
      if (!isSilent) {
        console.error("Vendor syncEvaluation error:", err);
      }
    }
  }, []);

  useEffect(() => {
    loadData();
    syncEvaluation();

    // 1-second ultra-responsive heartbeat for instant real-time sync with admin approvals
    const interval = setInterval(() => {
      syncEvaluation(true);
    }, 1000);

    return () => clearInterval(interval);
  }, [loadData, syncEvaluation]);

  // Re-sync avatar and evaluation whenever screen gains focus
  useFocusEffect(
    useCallback(() => {
      loadData();
      syncEvaluation(true);
    }, [loadData, syncEvaluation])
  );

  const getGradeColor = (grade) => {
    switch ((grade || "").toUpperCase()) {
      case "A":
        return "#2E7D32";
      case "B":
        return "#1976D2";
      case "C":
        return "#D97706";
      default:
        return "#D32F2F";
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Banner Alert */}
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
          onPress={() => router.push({ pathname: "/profile", params: { role: "vendor" } })}
          accessibilityRole="button"
          accessibilityLabel="Open vendor profile"
        >
          <View style={styles.greetingTextContainer}>
            <Text style={styles.greetingTitle}>Hello, {vendorName}!</Text>
            <Text style={styles.greetingSub}>{stallNumber}</Text>
          </View>
          <View style={styles.avatarCircle}>
            <InitialsAvatar
              avatarUri={avatarUri}
              name={vendorName}
              size={36}
              style={{ borderRadius: 18 }}
            />
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 2. SANITATION STATUS HERO CARD */}
        <View style={styles.heroCard}>
          <View style={styles.heroLeft}>
            <View style={styles.badgeRow}>
              <MaterialCommunityIcons name="check-decagram" size={14} color={getGradeColor(evaluation.grade)} />
              <Text style={[styles.badgeText, { color: getGradeColor(evaluation.grade) }]}>
                Certified Compliance
              </Text>
            </View>
            <Text style={styles.heroTitle}>Sanitation Status</Text>
            <Text style={styles.heroSubtitle}>{marketLocation}</Text>
            <Text style={styles.inspectionDateText}>
              Last Inspected: {evaluation.inspected_at_formatted || "Recently Audited"}
            </Text>

            {evaluation.has_pending_change && (
              <View style={styles.pendingBadge}>
                <MaterialCommunityIcons name="clock-outline" size={12} color="#D97706" />
                <Text style={styles.pendingBadgeText}>
                  Inspector revision pending Admin approval
                </Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[styles.gradeCircle, { backgroundColor: getGradeColor(evaluation.grade) }]}
            activeOpacity={0.88}
            onPress={() => router.push("/vendor/status")}
            accessibilityRole="button"
            accessibilityLabel="View sanitation grade details"
          >
            <Text style={styles.gradeLetter}>{evaluation.grade || "A"}</Text>
            <Text style={styles.gradeScore}>{evaluation.total_score ?? 100}%</Text>
          </TouchableOpacity>
        </View>

        {/* 3. QUICK ACTIONS */}
        <Text style={styles.sectionTitle}>Vendor Quick Actions</Text>

        <View style={styles.quickActionsGrid}>
          {/* Action 1: View QR -> Navigates to /vendor/qr */}
          <TouchableOpacity
            style={styles.actionGridCard}
            activeOpacity={0.85}
            onPress={() => router.push("/vendor/qr")}
            accessibilityRole="button"
            accessibilityLabel="Open QR code screen"
          >
            <View style={[styles.actionIconBox, { backgroundColor: "#E8F8EE" }]}>
              <MaterialCommunityIcons name="qrcode-scan" size={26} color="#2E7D32" />
            </View>
            <Text style={styles.actionLabel}>View QR</Text>
          </TouchableOpacity>

          {/* Action 2: View Grades -> Navigates to /vendor/status */}
          <TouchableOpacity
            style={styles.actionGridCard}
            activeOpacity={0.85}
            onPress={() => router.push("/vendor/status")}
            accessibilityRole="button"
            accessibilityLabel="Open Sanitation Status screen"
          >
            <View style={[styles.actionIconBox, { backgroundColor: "#E3F2FD" }]}>
              <MaterialCommunityIcons name="star-check-outline" size={26} color="#1976D2" />
            </View>
            <Text style={styles.actionLabel}>View Grades</Text>
          </TouchableOpacity>

          {/* Action 3: View Inspection Report */}
          <TouchableOpacity
            style={styles.actionGridCard}
            activeOpacity={0.85}
            onPress={() => setReportModalVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Open Inspection Report Modal"
          >
            <View style={[styles.actionIconBox, { backgroundColor: "#FFF3E0" }]}>
              <MaterialCommunityIcons
                name="clipboard-text-search-outline"
                size={26}
                color="#E65100"
              />
            </View>
            <Text style={styles.actionLabel}>View Report</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.quickActionsGrid}>
          {/* Action 4: Inspection Notices & Market Advisories */}
          <TouchableOpacity
            style={styles.actionGridCard}
            activeOpacity={0.85}
            onPress={() => router.push("/notifications")}
            accessibilityRole="button"
            accessibilityLabel="Open Market Advisories and Notices"
          >
            <View style={[styles.actionIconBox, { backgroundColor: "#FFF8E1" }]}>
              <MaterialCommunityIcons
                name="bell-ring-outline"
                size={24}
                color="#F57F17"
              />
            </View>
            <Text style={styles.actionLabel}>Notices</Text>
          </TouchableOpacity>

          {/* Action 5: Submit Market Sanitation Feedback */}
          <TouchableOpacity
            style={styles.actionGridCard}
            activeOpacity={0.85}
            onPress={() => router.push("/feedback")}
            accessibilityRole="button"
            accessibilityLabel="Submit Market Sanitation Feedback"
          >
            <View style={[styles.actionIconBox, { backgroundColor: "#F3E5F5" }]}>
              <MaterialCommunityIcons
                name="message-text-outline"
                size={24}
                color="#7B1FA2"
              />
            </View>
            <Text style={styles.actionLabel}>Feedback</Text>
          </TouchableOpacity>
        </View>

        {/* 4. MARKET DISPATCH & COLLECTION TIMING */}
        <View style={styles.card}>
          <Text style={styles.cardHeaderTitle}>Daily Commercial Waste Pickup</Text>

          <View style={styles.pickupRow}>
            <View style={[styles.pickupIconCircle, { backgroundColor: "#E8F8EE" }]}>
              <MaterialCommunityIcons name="truck-fast" size={22} color="#2E7D32" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.pickupTimeTitle}>Compactor Truck Arrival: 11:30 AM</Text>
              <Text style={styles.pickupSubText}>
                Wet & dry segregated bins must be placed at market Bay 4.
              </Text>
            </View>
          </View>
        </View>

        {/* 5. SANITATION GUIDELINES REMINDER */}
        <View style={styles.card}>
          <Text style={styles.cardHeaderTitle}>Market Hygiene Standards</Text>
          <View style={styles.ruleItem}>
            <MaterialCommunityIcons name="check-circle" size={16} color="#2E7D32" />
            <Text style={styles.ruleText}>
              Keep separate colored bins for wet organic and dry residual waste.
            </Text>
          </View>
          <View style={styles.ruleItem}>
            <MaterialCommunityIcons name="check-circle" size={16} color="#2E7D32" />
            <Text style={styles.ruleText}>
              Maintain clean floor drains and grease interceptors daily.
            </Text>
          </View>
          <View style={styles.ruleItem}>
            <MaterialCommunityIcons name="check-circle" size={16} color="#2E7D32" />
            <Text style={styles.ruleText}>
              Display certified QR code visibly for health inspectors.
            </Text>
          </View>
        </View>

        {/* 6. MARKET INFORMATION & SOLID WASTE ORDINANCE */}
        <View style={styles.card}>
          <Text style={styles.cardHeaderTitle}>Market Operational Hours</Text>
          <Text style={styles.infoParagraph}>
            Cogon & Carmen Public Markets operate daily from 04:00 AM to 08:00 PM. Municipal sanitation sweeps
            occur twice daily at 11:30 AM and 07:30 PM.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardHeaderTitle}>Solid Waste Management Ordinance</Text>
          <Text style={styles.infoParagraph}>
            Pursuant to Cagayan de Oro City Environmental Code, all wet and dry stalls must practice
            segregation-at-source. Non-compliance may result in administrative warnings or suspension of
            stall permits.
          </Text>
        </View>
      </ScrollView>

      {/* MODAL: VIEW INSPECTION REPORT */}
      <Modal visible={reportModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Recent Inspection Findings</Text>
              <TouchableOpacity onPress={() => setReportModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={22} color="#556655" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 10 }}>
              <View style={styles.reportSummaryRow}>
                <View>
                  <Text style={styles.reportAuditTitle}>Comprehensive Sanitation Audit</Text>
                  <Text style={styles.reportInspectorName}>Inspector: {evaluation.inspector_name || "John Inspector"}</Text>
                  <Text style={styles.reportDate}>{evaluation.inspected_at_formatted || "Recently Audited"}</Text>
                </View>
                <View style={[styles.reportGradeBadge, { backgroundColor: evaluation.grade === 'A' ? '#E8F8EE' : '#FFF3E0' }]}>
                  <Text style={[styles.reportGradeBadgeText, { color: getGradeColor(evaluation.grade) }]}>
                    Grade {evaluation.grade || "A"} • {evaluation.total_score ?? 100}%
                  </Text>
                </View>
              </View>

              <Text style={styles.reportSectionLabel}>Inspector Findings & Remarks</Text>
              <View style={styles.reportRemarksBox}>
                <Text style={styles.reportRemarksText}>{evaluation.notes || "Official audit certified in compliance with municipal sanitation requirements."}</Text>
              </View>

              <Text style={styles.reportSectionLabel}>Compliance Status</Text>
              <View style={styles.reportPassBox}>
                <MaterialCommunityIcons name="shield-check" size={18} color={getGradeColor(evaluation.grade)} />
                <Text style={[styles.reportPassText, { color: getGradeColor(evaluation.grade) }]}>
                  {evaluation.total_score >= 75
                    ? "Official audit satisfies municipal environmental sanitation standards."
                    : "Action required: Remedial sanitation measures recommended."}
                </Text>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setReportModalVisible(false)}
            >
              <Text style={styles.modalCloseButtonText}>Close Report</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 7. CONNECTED VENDOR HOTBAR */}
      <VendorHotbar activeTab="home" />
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
    overflow: "hidden",
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 95,
  },
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
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
    fontSize: 18,
    fontWeight: "900",
    color: "#1E331B",
  },
  heroSubtitle: {
    fontSize: 12,
    color: "#688264",
    marginTop: 2,
  },
  inspectionDateText: {
    fontSize: 11,
    color: "#8DA78B",
    marginTop: 4,
  },
  pendingBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF8E1",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#FFE082",
    marginTop: 6,
    gap: 4,
    alignSelf: "flex-start",
  },
  pendingBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#B45309",
  },
  gradeCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#2E7D32",
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
  },
  gradeLetter: {
    fontSize: 26,
    fontWeight: "900",
    color: "#FFFFFF",
    lineHeight: 30,
  },
  gradeScore: {
    fontSize: 11,
    fontWeight: "800",
    color: "rgba(255,255,255,0.9)",
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
    marginBottom: 18,
    gap: 8,
  },
  actionGridCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 6,
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
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#EDF4EC",
    marginBottom: 14,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  cardHeaderTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1E331B",
    marginBottom: 10,
  },
  pickupRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  pickupIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  pickupTimeTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1E331B",
  },
  pickupSubText: {
    fontSize: 11,
    color: "#6B8468",
    marginTop: 2,
  },
  ruleItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 8,
  },
  ruleText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: "#384E35",
  },
  infoParagraph: {
    fontSize: 13,
    lineHeight: 19,
    color: "#3F563B",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(10,20,10,0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 18,
  },
  modalCard: {
    width: "100%",
    maxHeight: "85%",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF4ED",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#1E331B",
  },
  reportSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  reportAuditTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1E331B",
  },
  reportInspectorName: {
    fontSize: 11,
    color: "#4A6146",
    marginTop: 2,
  },
  reportDate: {
    fontSize: 10,
    color: "#7A8D78",
    marginTop: 1,
  },
  reportGradeBadge: {
    backgroundColor: "#E8F8EE",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  reportGradeBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#2E7D32",
  },
  reportSectionLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#3B5238",
    marginTop: 10,
    marginBottom: 6,
  },
  reportRemarksBox: {
    backgroundColor: "#F7FAF6",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5EEE3",
  },
  reportRemarksText: {
    fontSize: 12,
    lineHeight: 18,
    color: "#2C3D29",
  },
  reportPassBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F8EE",
    padding: 10,
    borderRadius: 12,
    gap: 8,
    marginBottom: 10,
  },
  reportPassText: {
    flex: 1,
    fontSize: 11,
    fontWeight: "700",
    color: "#2E7D32",
  },
  modalCloseButton: {
    backgroundColor: "#2E7D32",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 10,
  },
  modalCloseButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
});
