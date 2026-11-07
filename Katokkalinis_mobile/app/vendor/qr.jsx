import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
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

export default function VendorQrScreen() {
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
    valid_through: "Q2 2026",
    updated_at: null,
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
      console.error("Vendor QR loadData error:", error);
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
        console.error("Vendor QR syncEvaluation error:", err);
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
          <Text style={styles.pageTitle}>Stall QR Verification</Text>
          <Text style={styles.pageSubtitle}>Official Municipal Digital Sanitation Badge</Text>
        </View>

        {/* QR BADGE CARD */}
        <View style={styles.qrCard}>
          <View style={styles.badgeRow}>
            <MaterialCommunityIcons name="shield-check" size={16} color={gradeColor} />
            <Text style={[styles.badgeText, { color: gradeColor }]}>
              Certified Sanitation Compliance
            </Text>
          </View>

          <View style={styles.qrMockContainer}>
            <Image
              source={{
                uri: `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=8&data=${encodeURIComponent(
                  vendorCode
                )}`,
              }}
              style={styles.qrImage}
              resizeMode="contain"
            />
          </View>

          <Text style={styles.qrCodeNumber}>UID: {vendorCode}</Text>
          <Text style={styles.qrStallText}>{stallNumber}</Text>
          <Text style={styles.qrVendorSub}>{vendorName} • {marketLocation}</Text>

          <View style={[styles.verifiedPill, { backgroundColor: evaluation.grade === 'A' ? '#E8F8EE' : '#FFF3E0' }]}>
            <MaterialCommunityIcons name="check-decagram" size={15} color={gradeColor} />
            <Text style={[styles.verifiedPillText, { color: gradeColor }]}>
              Grade {evaluation.grade || "A"} Valid Stall Certificate ({evaluation.total_score ?? 100}%)
            </Text>
          </View>
        </View>

        {/* INSTRUCTIONS CARD */}
        <View style={styles.card}>
          <Text style={styles.cardHeaderTitle}>Inspector Instructions</Text>
          <Text style={styles.infoParagraph}>
            Present this QR code when City Environment & Natural Resources (CLENRO) or sanitary inspectors
            perform routine compliance audits.
          </Text>

          <View style={styles.instructionStep}>
            <MaterialCommunityIcons name="numeric-1-circle" size={18} color="#2E7D32" />
            <Text style={styles.stepText}>Hold screen steady for inspector scanner.</Text>
          </View>
          <View style={styles.instructionStep}>
            <MaterialCommunityIcons name="numeric-2-circle" size={18} color="#2E7D32" />
            <Text style={styles.stepText}>The scanner logs inspection timestamps directly to the city database.</Text>
          </View>
          <View style={styles.instructionStep}>
            <MaterialCommunityIcons name="numeric-3-circle" size={18} color="#2E7D32" />
            <Text style={styles.stepText}>Your sanitation score is instantly updated upon audit submission.</Text>
          </View>
        </View>

        {/* STATUS SHORTCUT BUTTON */}
        <TouchableOpacity
          style={styles.statusNavButton}
          activeOpacity={0.85}
          onPress={() => router.push("/vendor/status")}
        >
          <MaterialCommunityIcons name="shield-check" size={20} color="#FFFFFF" />
          <Text style={styles.statusNavButtonText}>View Detailed Inspection Status</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* 2. CONNECTED VENDOR HOTBAR */}
      <VendorHotbar activeTab="qr" />
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
  qrCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 22,
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
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F8EE",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginBottom: 14,
    gap: 5,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#2E7D32",
  },
  qrMockContainer: {
    padding: 14,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    borderWidth: 2,
    borderColor: "#E2ECE0",
    marginBottom: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1A3816",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  qrImage: {
    width: 190,
    height: 190,
    borderRadius: 8,
  },
  qrCodeNumber: {
    fontSize: 15,
    fontWeight: "900",
    color: "#2E7D32",
    letterSpacing: 1.5,
  },
  qrStallText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1E331B",
    marginTop: 4,
  },
  qrVendorSub: {
    fontSize: 12,
    color: "#6B8468",
    marginTop: 2,
  },
  verifiedPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F8EE",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginTop: 14,
    gap: 6,
  },
  verifiedPillText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#2E7D32",
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
    marginBottom: 8,
  },
  infoParagraph: {
    fontSize: 12,
    lineHeight: 18,
    color: "#465D43",
    marginBottom: 12,
  },
  instructionStep: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  stepText: {
    flex: 1,
    fontSize: 12,
    color: "#354C32",
  },
  statusNavButton: {
    backgroundColor: "#2E7D32",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
    elevation: 2,
  },
  statusNavButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
});
