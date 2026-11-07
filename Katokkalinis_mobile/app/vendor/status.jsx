import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
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

export default function VendorStatusScreen() {
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

  const [banner, setBanner] = useState({
    visible: false,
    title: "",
    message: "",
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
      console.error("Vendor Status loadData error:", error);
    }
  }, []);

  const syncEvaluation = useCallback(async (isSilent = false) => {
    try {
      const res = await fetchVendorEvaluation();
      if (res?.success && res.evaluation) {
        const ev = res.evaluation;
        const prev = lastEvalRef.current;

        if (
          !prev.isFirst &&
          prev.updated_at &&
          (prev.updated_at !== ev.updated_at || prev.total_score !== ev.total_score)
        ) {
          setBanner({
            visible: true,
            title: "Evaluation Updated Real-Time",
            message: `Admin approved updated inspection evaluation: Grade ${ev.grade} (${ev.total_score}%).`,
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
        console.error("Vendor Status syncEvaluation error:", err);
      }
    }
  }, []);

  useEffect(() => {
    loadData();
    syncEvaluation();

    const interval = setInterval(() => {
      syncEvaluation(true);
    }, 1000);

    return () => clearInterval(interval);
  }, [loadData, syncEvaluation]);

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

  const gradeColor = getGradeColor(evaluation.grade);

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
        <KatokLogo variant="header" showTagline={false} />

        <TouchableOpacity
          style={styles.greetingRight}
          activeOpacity={0.85}
          onPress={() => router.push({ pathname: "/profile", params: { role: "vendor" } })}
          accessibilityRole="button"
          accessibilityLabel="Open vendor profile"
        >
          <View style={styles.greetingTextContainer}>
            <Text style={styles.greetingTitle}>{vendorName}</Text>
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
        {/* Title */}
        <View style={styles.titleSection}>
          <Text style={styles.pageTitle}>Sanitation & Grade History</Text>
          <Text style={styles.pageSubtitle}>Official audit evaluations for {stallNumber}</Text>
        </View>

        {/* HERO GRADE SUMMARY CARD */}
        <View style={styles.heroCard}>
          <View style={styles.heroLeft}>
            <View style={styles.statusHeaderRow}>
              <View>
                <Text style={styles.statusSectionTitle}>Current Rating</Text>
                <Text style={styles.statusSectionSub}>Valid through {evaluation.valid_through || "Current Period"}</Text>
              </View>
              <View style={[styles.gradeBadgeA, { backgroundColor: evaluation.grade === 'A' ? '#E8F8EE' : '#FFF3E0' }]}>
                <Text style={[styles.gradeBadgeAText, { color: gradeColor }]}>
                  Grade {evaluation.grade || "A"} • {evaluation.total_score ?? 100}%
                </Text>
              </View>
            </View>

            <View style={styles.gradeBigDisplayRow}>
              <View style={[styles.gradeBigCircle, { backgroundColor: gradeColor }]}>
                <Text style={styles.gradeBigLetter}>{evaluation.grade || "A"}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={styles.gradeStandingText}>
                  {evaluation.total_score >= 75 ? "Certified Compliance" : "Remedial Attention"}
                </Text>
                <Text style={styles.gradeMetaText}>{marketLocation}</Text>
                <Text style={styles.gradeDateText}>
                  Last Audit: {evaluation.inspected_at_formatted || "Recently Audited"}
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
            </View>
          </View>
        </View>

        {/* DETAILED SCORE BREAKDOWN */}
        <View style={styles.card}>
          <Text style={styles.cardHeaderTitle}>Audit Metric Breakdown</Text>

          <View style={styles.breakdownRow}>
            <View>
              <Text style={styles.breakdownLabel}>Waste Storage & Segregation</Text>
              <Text style={styles.breakdownSub}>Color-coded liners & bin covers</Text>
            </View>
            <Text style={styles.breakdownVal}>
              {((evaluation.hygiene_score / 100) * 5).toFixed(1)} / 5.0 ({evaluation.hygiene_score}%)
            </Text>
          </View>

          <View style={styles.breakdownRow}>
            <View>
              <Text style={styles.breakdownLabel}>Stall Cleanliness</Text>
              <Text style={styles.breakdownSub}>Food prep surface & drainage</Text>
            </View>
            <Text style={styles.breakdownVal}>
              {((evaluation.premises_score / 100) * 5).toFixed(1)} / 5.0 ({evaluation.premises_score}%)
            </Text>
          </View>

          <View style={styles.breakdownRow}>
            <View>
              <Text style={styles.breakdownLabel}>Pest Control & Storage</Text>
              <Text style={styles.breakdownSub}>Dry elevation & vector guards</Text>
            </View>
            <Text style={styles.breakdownVal}>
              {((evaluation.pest_control_score / 100) * 5).toFixed(1)} / 5.0 ({evaluation.pest_control_score}%)
            </Text>
          </View>

          <View style={[styles.breakdownRow, { borderBottomWidth: 0 }]}>
            <View>
              <Text style={styles.breakdownLabel}>Violations Record</Text>
              <Text style={styles.breakdownSub}>Municipal citations issued</Text>
            </View>
            <Text style={[styles.breakdownVal, { color: "#2E7D32" }]}>
              {evaluation.violations_count ?? 0} Violations
            </Text>
          </View>
        </View>

        {/* INSPECTOR FINDINGS & REMARKS */}
        <View style={styles.card}>
          <Text style={styles.cardHeaderTitle}>Latest Inspector Remarks</Text>
          <View style={styles.reportSummaryRow}>
            <View>
              <Text style={styles.reportAuditTitle}>Comprehensive Sanitation Audit</Text>
              <Text style={styles.reportInspectorName}>Inspector: {evaluation.inspector_name || "John Inspector"}</Text>
              <Text style={styles.reportDate}>{evaluation.inspected_at_formatted || "Recently Audited"}</Text>
            </View>
            <View style={[styles.reportGradeBadge, { backgroundColor: evaluation.grade === 'A' ? '#E8F8EE' : '#FFF3E0' }]}>
              <Text style={[styles.reportGradeBadgeText, { color: gradeColor }]}>
                Grade {evaluation.grade || "A"}
              </Text>
            </View>
          </View>

          <View style={styles.reportRemarksBox}>
            <Text style={styles.reportRemarksText}>
              {evaluation.notes || "Official audit certified in compliance with municipal sanitation requirements."}
            </Text>
          </View>

          <View style={styles.reportPassBox}>
            <MaterialCommunityIcons name="shield-check" size={18} color={gradeColor} />
            <Text style={[styles.reportPassText, { color: gradeColor }]}>
              {evaluation.total_score >= 75
                ? "All municipal environmental standards satisfied."
                : "Notice: Remedial cleanup and compliance actions advised."}
            </Text>
          </View>
        </View>

        {/* QR SHORTCUT BUTTON */}
        <TouchableOpacity
          style={styles.qrNavButton}
          activeOpacity={0.85}
          onPress={() => router.push("/vendor/qr")}
        >
          <MaterialCommunityIcons name="qrcode" size={20} color="#FFFFFF" />
          <Text style={styles.qrNavButtonText}>View Official Stall QR Badge</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* 2. CONNECTED VENDOR HOTBAR */}
      <VendorHotbar activeTab="status" />
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
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
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
    width: "100%",
  },
  statusHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  statusSectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1E331B",
  },
  statusSectionSub: {
    fontSize: 11,
    color: "#7A8D78",
  },
  gradeBadgeA: {
    backgroundColor: "#E8F8EE",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  gradeBadgeAText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#2E7D32",
  },
  gradeBigDisplayRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  gradeBigCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#2E7D32",
    alignItems: "center",
    justifyContent: "center",
  },
  gradeBigLetter: {
    fontSize: 32,
    fontWeight: "900",
    color: "#FFFFFF",
    lineHeight: 36,
  },
  gradeStandingText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1E331B",
  },
  gradeMetaText: {
    fontSize: 11,
    color: "#688264",
    marginTop: 2,
  },
  gradeDateText: {
    fontSize: 10,
    color: "#8DA78B",
    marginTop: 2,
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
  cardHeaderTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1E331B",
    marginBottom: 12,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F4EF",
  },
  breakdownLabel: {
    fontSize: 12,
    color: "#2E422C",
    fontWeight: "700",
  },
  breakdownSub: {
    fontSize: 10,
    color: "#7A8D78",
    marginTop: 2,
  },
  breakdownVal: {
    fontSize: 12,
    fontWeight: "800",
    color: "#1E331B",
  },
  reportSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  reportAuditTitle: {
    fontSize: 13,
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
  reportRemarksBox: {
    backgroundColor: "#F7FAF6",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5EEE3",
    marginBottom: 10,
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
  },
  reportPassText: {
    flex: 1,
    fontSize: 11,
    fontWeight: "700",
    color: "#2E7D32",
  },
  qrNavButton: {
    backgroundColor: "#2E7D32",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
    elevation: 2,
  },
  qrNavButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
});
