import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  fetchVendorByCodeOrId,
  verifyVendorQrToken,
  recordViolation,
  VendorItem,
  InspectionItem,
} from "../../services/inspector";
import * as Haptics from "expo-haptics";
import { Alert, Modal, TextInput } from "react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const isSmall = SCREEN_WIDTH < 360;

export default function Vendor() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [vendor, setVendor] = useState<VendorItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [complianceInfo, setComplianceInfo] = useState<{
    score: number;
    grade: string;
    status_label: string;
  }>({
    score: 85,
    grade: "Grade A",
    status_label: "Certified Compliant",
  });
  const [recentInspections, setRecentInspections] = useState<InspectionItem[]>([]);
  const [recentViolations, setRecentViolations] = useState<any[]>([]);

  // Violation recording modal
  const [violationModalVisible, setViolationModalVisible] = useState(false);
  const [violationType, setViolationType] = useState("Improper Waste Segregation");
  const [violationDescription, setViolationDescription] = useState("");
  const [violationPenalty, setViolationPenalty] = useState("Written Warning (1st Offense)");
  const [correctiveAction, setCorrectiveAction] = useState("");
  const [submittingViolation, setSubmittingViolation] = useState(false);

  const loadVendor = React.useCallback(async () => {
    try {
      setLoading(true);
      const idOrCode = (params.vendor_id as string) || "2026012345";
      const res = await verifyVendorQrToken(idOrCode);
      if (res.success && res.vendor) {
        setVendor(res.vendor);
        if (res.compliance) {
          setComplianceInfo({
            score: res.compliance.score,
            grade: res.compliance.grade,
            status_label: res.compliance.status_label,
          });
        }
        if (res.recent_inspections) {
          setRecentInspections(res.recent_inspections);
        }
        if (res.recent_violations) {
          setRecentViolations(res.recent_violations);
        }
      } else {
        const fallbackRes = await fetchVendorByCodeOrId(idOrCode);
        if (fallbackRes.success && fallbackRes.vendor) {
          setVendor(fallbackRes.vendor);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [params.vendor_id]);

  useEffect(() => {
    loadVendor();
  }, [loadVendor]);

  const handleContinue = () => {
    router.push({
      pathname: "/inspector/grade",
      params: {
        vendor_id: vendor?.id || 1,
        vendor_name: vendor?.business_name || "Market Vendor Stall",
        vendor_code: vendor?.vendor_code || "VND-COG-001",
      },
    });
  };

  const handleSubmitViolation = async () => {
    if (!violationDescription.trim()) {
      Alert.alert("Missing Description", "Please describe the sanitation violation observed.");
      return;
    }
    if (!vendor?.id) return;

    try {
      setSubmittingViolation(true);
      const res = await recordViolation({
        vendor_id: vendor.id,
        violation_type: violationType,
        description: violationDescription.trim(),
        penalty: violationPenalty,
        corrective_action: correctiveAction.trim() || undefined,
      });

      if (res.success) {
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {
          // fallback
        }
        Alert.alert("Violation Recorded", "Official sanitation violation notice has been logged to central CLENRO database.");
        setViolationModalVisible(false);
        setViolationDescription("");
        setCorrectiveAction("");
        loadVendor();
      } else {
        Alert.alert("Recording Failed", res.message || "Failed to record violation.");
      }
    } catch (err: any) {
      Alert.alert("Error", err?.message || "An error occurred.");
    } finally {
      setSubmittingViolation(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* 1. TOP HEADER (Dashboard / Profile Theme: Clean white with dark arrow and centered title) */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#1E331B" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Vendor Profile</Text>

        <View style={styles.headerRightPlaceholder} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator size="large" color="#2E7D32" style={{ marginVertical: 40 }} />
        ) : (
          <>
            {/* 2. TOP PROFILE CARD (Matching Image 2 Resident Profile Card) */}
            <View style={styles.profileCard}>
              <View style={styles.avatarContainer}>
                <View style={styles.avatarCircle}>
                  <MaterialCommunityIcons name="storefront" size={44} color="#2E7D32" />
                </View>
                <View style={styles.verifiedBadge}>
                  <MaterialCommunityIcons name="check" size={14} color="#FFFFFF" />
                </View>
              </View>

              <Text style={styles.vendorName}>
                {vendor?.business_name || "KatokKalimpyo Fresh Fruits"}
              </Text>
              <Text style={styles.vendorEmail}>
                {vendor?.user?.email || "vendor@katokkalinis.com"}
              </Text>

              {/* Badges Row (Matching Image 2: Barangay Resident & ID) */}
              <View style={styles.badgeRow}>
                <View style={styles.roleBadge}>
                  <MaterialCommunityIcons name="storefront-outline" size={14} color="#2E7D32" />
                  <Text style={styles.roleBadgeText}>Official Vendor</Text>
                </View>

                <View style={styles.idBadge}>
                  <Text style={styles.idBadgeText}>
                    Code: {vendor?.vendor_code || vendor?.qr_code || "2026012345"}
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              {/* Stats Row (Matching Image 2 Collections / Reports stats) */}
              <View style={styles.statsRow}>
                <View style={styles.statCol}>
                  <Text style={styles.statNumber}>Verified</Text>
                  <Text style={styles.statLabel}>Compliance Status</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statCol}>
                  <Text style={[styles.statNumber, { color: "#2E7D32" }]}>Active</Text>
                  <Text style={styles.statLabel}>Registration</Text>
                </View>
              </View>
            </View>

            {/* 3. DETAILS CARD (Matching Image 2 List rows) */}
            <View style={styles.detailsCard}>
              {/* Registered Owner */}
              <View style={styles.detailRow}>
                <View style={[styles.detailIconBox, { backgroundColor: "#E8F8EE" }]}>
                  <MaterialCommunityIcons name="account-outline" size={20} color="#2E7D32" />
                </View>
                <View style={styles.detailTextCol}>
                  <Text style={styles.detailLabel}>Registered Owner</Text>
                  <Text style={styles.detailValue}>{vendor?.owner_name || "Juan Dela Cruz"}</Text>
                </View>
              </View>

              <View style={styles.rowDivider} />

              {/* Contact Number */}
              <View style={styles.detailRow}>
                <View style={[styles.detailIconBox, { backgroundColor: "#E3F2FD" }]}>
                  <MaterialCommunityIcons name="phone-outline" size={20} color="#1976D2" />
                </View>
                <View style={styles.detailTextCol}>
                  <Text style={styles.detailLabel}>Contact Number</Text>
                  <Text style={styles.detailValue}>{vendor?.contact_number || "09467802940"}</Text>
                </View>
              </View>

              <View style={styles.rowDivider} />

              {/* Official Email */}
              <View style={styles.detailRow}>
                <View style={[styles.detailIconBox, { backgroundColor: "#FFF3E0" }]}>
                  <MaterialCommunityIcons name="email-outline" size={20} color="#E65100" />
                </View>
                <View style={styles.detailTextCol}>
                  <Text style={styles.detailLabel}>Official Email</Text>
                  <Text style={styles.detailValue}>
                    {vendor?.user?.email || "vendor@katokkalinis.com"}
                  </Text>
                </View>
              </View>

              <View style={styles.rowDivider} />

              {/* Stall Location */}
              <View style={styles.detailRow}>
                <View style={[styles.detailIconBox, { backgroundColor: "#F3E5F5" }]}>
                  <MaterialCommunityIcons name="map-marker-outline" size={20} color="#7B1FA2" />
                </View>
                <View style={styles.detailTextCol}>
                  <Text style={styles.detailLabel}>Stall Market Location</Text>
                  <Text style={styles.detailValue}>
                    {vendor?.address
                      ? vendor.address.replace(/Divisoria|Divi/gi, "Cogon")
                      : vendor?.barangay?.name || "Cogon Public Market, Section B"}
                  </Text>
                </View>
              </View>
            </View>

            {/* 4. COMPLIANCE & GRADE CERTIFICATION CARD */}
            <View style={[styles.detailsCard, { marginTop: 14 }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#6B8468", textTransform: "uppercase", letterSpacing: 0.6 }}>
                    Compliance Certification
                  </Text>
                  <Text style={{ fontSize: 18, fontWeight: "800", color: "#1E331B", marginTop: 2 }}>
                    {complianceInfo.grade} · {complianceInfo.score}%
                  </Text>
                </View>
                <View style={{
                  paddingHorizontal: 12,
                  paddingVertical: 5,
                  borderRadius: 20,
                  backgroundColor: complianceInfo.score >= 85 ? "#E8F8EE" : (complianceInfo.score >= 70 ? "#E3F2FD" : "#FFEBEE"),
                }}>
                  <Text style={{
                    fontSize: 12,
                    fontWeight: "800",
                    color: complianceInfo.score >= 85 ? "#2E7D32" : (complianceInfo.score >= 70 ? "#1976D2" : "#C62828"),
                  }}>
                    {complianceInfo.status_label}
                  </Text>
                </View>
              </View>

              {recentInspections.length > 0 && (
                <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: "#E2ECE0", paddingTop: 10 }}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: "#1E331B", marginBottom: 6 }}>
                    Recent Sanitation Audits ({recentInspections.length})
                  </Text>
                  {recentInspections.slice(0, 3).map((item, idx) => (
                    <View key={`insp-${item.id || idx}`} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
                      <Text style={{ fontSize: 12, color: "#5C7858" }}>
                        {item.inspected_at ? item.inspected_at.substring(0, 10) : "Recent Audit"}
                      </Text>
                      <Text style={{ fontSize: 12, fontWeight: "700", color: "#1E331B" }}>
                        Score: {item.total_score}% · {item.total_score >= 85 ? "Grade A" : (item.total_score >= 70 ? "Grade B" : "Grade C")}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* 5. ACTION BUTTONS: INSPECTION & VIOLATION RECORDING */}
            <View style={{ marginTop: 16, gap: 10 }}>
              <TouchableOpacity
                style={styles.continueButton}
                onPress={handleContinue}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="clipboard-check-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.buttonText}>Start Sanitation Inspection</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.continueButton, { backgroundColor: "#FFF", borderWidth: 1.5, borderColor: "#C62828" }]}
                onPress={() => setViolationModalVisible(true)}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="alert-octagon-outline" size={20} color="#C62828" style={{ marginRight: 8 }} />
                <Text style={[styles.buttonText, { color: "#C62828" }]}>Record Violation / Notice</Text>
              </TouchableOpacity>
            </View>

            {/* 6. RECORD VIOLATION MODAL */}
            <Modal
              visible={violationModalVisible}
              animationType="slide"
              transparent={true}
              onRequestClose={() => setViolationModalVisible(false)}
            >
              <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 20 }}>
                <View style={{ backgroundColor: "#FFF", borderRadius: 16, padding: 20, maxHeight: "85%" }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <Text style={{ fontSize: 17, fontWeight: "800", color: "#1E331B" }}>Record Violation Notice</Text>
                    <TouchableOpacity onPress={() => setViolationModalVisible(false)}>
                      <MaterialCommunityIcons name="close" size={22} color="#666" />
                    </TouchableOpacity>
                  </View>

                  <ScrollView showsVerticalScrollIndicator={false}>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: "#1E331B", marginBottom: 4 }}>Violation Category</Text>
                    {[
                      "Improper Waste Segregation",
                      "Unsanitary Food Handling Area",
                      "Drainage / Grease Trap Obstruction",
                      "Expired Sanitary Permit",
                      "Lack of Segregated Covered Bins",
                    ].map((type) => (
                      <TouchableOpacity
                        key={type}
                        onPress={() => setViolationType(type)}
                        style={{
                          padding: 10,
                          borderRadius: 8,
                          marginBottom: 6,
                          backgroundColor: violationType === type ? "#FFEBEE" : "#F8FAF8",
                          borderWidth: 1,
                          borderColor: violationType === type ? "#C62828" : "#E2ECE0",
                        }}
                      >
                        <Text style={{ fontSize: 13, fontWeight: violationType === type ? "700" : "500", color: violationType === type ? "#C62828" : "#333" }}>
                          {type}
                        </Text>
                      </TouchableOpacity>
                    ))}

                    <Text style={{ fontSize: 12, fontWeight: "700", color: "#1E331B", marginTop: 10, marginBottom: 4 }}>
                      Inspector Observations / Evidence Notes
                    </Text>
                    <TextInput
                      style={{
                        backgroundColor: "#F8FAF8",
                        borderWidth: 1,
                        borderColor: "#E2ECE0",
                        borderRadius: 8,
                        padding: 10,
                        minHeight: 70,
                        fontSize: 13,
                        textAlignVertical: "top",
                      }}
                      placeholder="Specify observed sanitary violation or non-compliance..."
                      placeholderTextColor="#999"
                      multiline
                      value={violationDescription}
                      onChangeText={setViolationDescription}
                    />

                    <Text style={{ fontSize: 12, fontWeight: "700", color: "#1E331B", marginTop: 10, marginBottom: 4 }}>
                      Sanction / Penalty
                    </Text>
                    {[
                      "Written Warning (1st Offense)",
                      "Administrative Fine - Php 500 (2nd Offense)",
                      "Stall Closure Recommendation (3rd Offense)",
                    ].map((pen) => (
                      <TouchableOpacity
                        key={pen}
                        onPress={() => setViolationPenalty(pen)}
                        style={{
                          padding: 10,
                          borderRadius: 8,
                          marginBottom: 6,
                          backgroundColor: violationPenalty === pen ? "#FFF3E0" : "#F8FAF8",
                          borderWidth: 1,
                          borderColor: violationPenalty === pen ? "#E65100" : "#E2ECE0",
                        }}
                      >
                        <Text style={{ fontSize: 13, fontWeight: violationPenalty === pen ? "700" : "500", color: violationPenalty === pen ? "#E65100" : "#333" }}>
                          {pen}
                        </Text>
                      </TouchableOpacity>
                    ))}

                    <Text style={{ fontSize: 12, fontWeight: "700", color: "#1E331B", marginTop: 10, marginBottom: 4 }}>
                      Corrective Action Required
                    </Text>
                    <TextInput
                      style={{
                        backgroundColor: "#F8FAF8",
                        borderWidth: 1,
                        borderColor: "#E2ECE0",
                        borderRadius: 8,
                        padding: 10,
                        minHeight: 50,
                        fontSize: 13,
                        textAlignVertical: "top",
                      }}
                      placeholder="E.g. Clear stall drainage and clean preparation surface within 24h"
                      placeholderTextColor="#999"
                      value={correctiveAction}
                      onChangeText={setCorrectiveAction}
                    />

                    <TouchableOpacity
                      style={{
                        backgroundColor: "#C62828",
                        paddingVertical: 13,
                        borderRadius: 10,
                        alignItems: "center",
                        marginTop: 18,
                        marginBottom: 10,
                      }}
                      onPress={handleSubmitViolation}
                      disabled={submittingViolation}
                    >
                      {submittingViolation ? (
                        <ActivityIndicator color="#FFF" size="small" />
                      ) : (
                        <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 15 }}>Submit Violation Notice</Text>
                      )}
                    </TouchableOpacity>
                  </ScrollView>
                </View>
              </View>
            </Modal>
          </>
        )}
      </ScrollView>

      {/* 5. BOTTOM NAVIGATION (Consistent 4-Tab Inspector Navigation) */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          activeOpacity={0.8}
          onPress={() => router.push("/inspector/dashboard" as any)}
        >
          <MaterialCommunityIcons name="home-outline" size={24} color="#7A8D78" />
          <Text style={styles.navText}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          activeOpacity={0.8}
          onPress={() => router.push("/inspector/inspections" as any)}
        >
          <MaterialCommunityIcons name="clipboard-check" size={24} color="#2E7D32" />
          <Text style={[styles.navText, styles.navTextActive]}>Inspections</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          activeOpacity={0.8}
          onPress={() => router.push("/inspector/history" as any)}
        >
          <MaterialCommunityIcons name="history" size={24} color="#7A8D78" />
          <Text style={styles.navText}>History</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          activeOpacity={0.8}
          onPress={() => router.push("/inspector/profile" as any)}
        >
          <MaterialCommunityIcons name="account-outline" size={24} color="#7A8D78" />
          <Text style={styles.navText}>Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FBFDFB",
  },

  // 1. Top Header matching Dashboard & Profile
  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    paddingTop: Platform.OS === "ios" ? 50 : 42,
    paddingBottom: 14,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF5ED",
  },

  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F2F7F1",
    justifyContent: "center",
    alignItems: "center",
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1E331B",
    textAlign: "center",
  },

  headerRightPlaceholder: {
    width: 36,
  },

  scrollContent: {
    paddingBottom: 95,
  },

  // 2. Profile Card matching Image 2 "Resident Profile"
  profileCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 14,
    borderRadius: 24,
    padding: 22,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EEF5ED",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },

  avatarContainer: {
    position: "relative",
    marginBottom: 12,
  },

  avatarCircle: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: "#E8F8EE",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#C5E6CE",
  },

  verifiedBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#2E7D32",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },

  vendorName: {
    fontSize: isSmall ? 18 : 21,
    fontWeight: "900",
    color: "#1E331B",
    textAlign: "center",
  },

  vendorEmail: {
    fontSize: 13,
    color: "#5C7558",
    marginTop: 2,
    textAlign: "center",
  },

  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
  },

  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F8EE",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },

  roleBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2E7D32",
  },

  idBadge: {
    backgroundColor: "#F2F7F1",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },

  idBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#4A6146",
  },

  divider: {
    width: "100%",
    height: 1,
    backgroundColor: "#EEF5ED",
    marginVertical: 16,
  },

  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    justifyContent: "space-around",
  },

  statCol: {
    alignItems: "center",
    flex: 1,
  },

  statNumber: {
    fontSize: 18,
    fontWeight: "900",
    color: "#1E331B",
  },

  statLabel: {
    fontSize: 12,
    color: "#6B8267",
    marginTop: 2,
  },

  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: "#EEF5ED",
  },

  // 3. Details Card matching Image 2 second card
  detailsCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: "#EEF5ED",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },

  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
  },

  detailIconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },

  detailTextCol: {
    flex: 1,
  },

  detailLabel: {
    fontSize: 12,
    color: "#688264",
    fontWeight: "600",
  },

  detailValue: {
    fontSize: 14,
    color: "#1E331B",
    fontWeight: "800",
    marginTop: 1,
  },

  rowDivider: {
    width: "100%",
    height: 1,
    backgroundColor: "#F2F7F1",
    marginVertical: 4,
  },

  // 4. Action Button matching primary green
  continueButton: {
    backgroundColor: "#2E7D32",
    marginHorizontal: 16,
    paddingVertical: 15,
    borderRadius: 26,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    elevation: 3,
    shadowColor: "#2E7D32",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },

  buttonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 16,
    letterSpacing: 0.2,
  },

  // 5. Bottom Navigation
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

  navText: {
    color: "#7A8D78",
    fontSize: 10,
    marginTop: 2,
    fontWeight: "600",
  },

  navTextActive: {
    color: "#2E7D32",
    fontWeight: "800",
  },
});