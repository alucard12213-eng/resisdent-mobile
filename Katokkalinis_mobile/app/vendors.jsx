import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import ResidentHotbar from "../components/ResidentHotbar";
import {
  fetchPublicVendorDetail,
  fetchPublicVendors,
} from "../services/resident";

const MARKET_FILTERS = [
  { key: "all", label: "All Markets" },
  { key: "Cogon", label: "Cogon Market" },
  { key: "Carmen", label: "Carmen Market" },
];

const GRADE_FILTERS = [
  { key: "all", label: "All Grades" },
  { key: "A", label: "Grade A" },
  { key: "B", label: "Grade B" },
  { key: "C", label: "Grade C" },
];

function getGradeTheme(grade) {
  switch (String(grade || "").toUpperCase()) {
    case "A":
      return {
        color: "#2E7D32",
        bg: "#E8F8EE",
        border: "#C5E6CE",
        badgeText: "Grade A • Certified",
        statusText: "Certified Compliant",
      };
    case "B":
      return {
        color: "#1976D2",
        bg: "#E3F2FD",
        border: "#BBDEFB",
        badgeText: "Grade B • Conditional",
        statusText: "Conditional Pass",
      };
    case "C":
      return {
        color: "#D97706",
        bg: "#FFF8E1",
        border: "#FFE082",
        badgeText: "Grade C • Needs Attention",
        statusText: "Re-Inspection Scheduled",
      };
    default:
      return {
        color: "#546E7A",
        bg: "#ECEFF1",
        border: "#CFD8DC",
        badgeText: "Pending Evaluation",
        statusText: "Pending Inspection",
      };
  }
}

export default function ResidentVendorsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMarket, setSelectedMarket] = useState("all");
  const [selectedGrade, setSelectedGrade] = useState("all");

  // Detail Modal State
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const lastHandledVendorCodeRef = useRef(null);

  const loadVendors = useCallback(
    async (isSilent = false) => {
      try {
        if (!isSilent) {
          setLoading(true);
          setErrorMessage(null);
        }
        const res = await fetchPublicVendors({
          search: searchQuery,
          market: selectedMarket,
          grade: selectedGrade,
        });
        if (res && res.success && Array.isArray(res.vendors)) {
          setVendors(res.vendors);
          setErrorMessage(null);
        } else {
          setVendors([]);
          if (!isSilent && res?.message) {
            setErrorMessage(res.message);
          }
        }
      } catch (e) {
        console.warn("Failed to load public vendors:", e);
        if (!isSilent) {
          setVendors([]);
          setErrorMessage(
            e?.message ||
              "Unable to load public market vendors. Please check your connection and try again."
          );
        }
      } finally {
        if (!isSilent) setLoading(false);
        setRefreshing(false);
      }
    },
    [searchQuery, selectedMarket, selectedGrade]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      loadVendors();
    }, 200);
    return () => clearTimeout(timer);
  }, [loadVendors]);

  // Periodic background sync so newly approved vendor grades reflect automatically
  useEffect(() => {
    const interval = setInterval(() => {
      loadVendors(true);
    }, 10000);
    return () => clearInterval(interval);
  }, [loadVendors]);

  // Deep link / navigation param handler for ?vendorCode=...
  useEffect(() => {
    const incomingCode = params?.vendorCode ? String(params.vendorCode).trim() : "";
    if (incomingCode && lastHandledVendorCodeRef.current !== incomingCode) {
      lastHandledVendorCodeRef.current = incomingCode;
      (async () => {
        setDetailModalVisible(true);
        setLoadingDetail(true);
        try {
          const res = await fetchPublicVendorDetail(incomingCode);
          if (res && res.success && res.vendor) {
            setSelectedVendor(res.vendor);
          }
        } catch (err) {
          console.warn("Could not load vendor from vendorCode param:", err);
        } finally {
          setLoadingDetail(false);
        }
      })();
    }
  }, [params?.vendorCode]);

  const handleRefresh = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setRefreshing(true);
    loadVendors(false);
  };

  const handleOpenVendorDetail = async (vendorItem) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    setSelectedVendor(vendorItem);
    setDetailModalVisible(true);
    setLoadingDetail(true);

    try {
      const res = await fetchPublicVendorDetail(
        vendorItem.id || vendorItem.vendor_code
      );
      if (res && res.success && res.vendor) {
        setSelectedVendor(res.vendor);
      }
    } catch (e) {
      console.warn("Could not refresh vendor detail:", e);
    } finally {
      setLoadingDetail(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* 1. TOP HEADER */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.push("/dashboard")}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialCommunityIcons name="arrow-left" size={22} color="#1E331B" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Public Market Directory
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            Cogon & Carmen Public Market Records
          </Text>
        </View>

        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={["#2E7D32"]}
            tintColor="#2E7D32"
          />
        }
      >
        {/* 2. SEARCH INPUT */}
        <View style={styles.searchBar}>
          <MaterialCommunityIcons name="magnify" size={20} color="#688264" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search vendor name, stall #, or market..."
            placeholderTextColor="#9AA998"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <MaterialCommunityIcons
                name="close-circle"
                size={18}
                color="#8FA58C"
              />
            </TouchableOpacity>
          )}
        </View>

        {/* 3. MARKET FILTER PILLS */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {MARKET_FILTERS.map((m) => {
            const active = selectedMarket === m.key;
            return (
              <TouchableOpacity
                key={m.key}
                style={[styles.filterPill, active && styles.filterPillActive]}
                onPress={() => setSelectedMarket(m.key)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons
                  name="storefront-outline"
                  size={14}
                  color={active ? "#FFFFFF" : "#4A6B46"}
                />
                <Text
                  style={[
                    styles.filterPillText,
                    active && styles.filterPillTextActive,
                  ]}
                >
                  {m.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* 4. GRADE FILTER PILLS */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.gradeFilterRow}
        >
          {GRADE_FILTERS.map((g) => {
            const active = selectedGrade === g.key;
            return (
              <TouchableOpacity
                key={g.key}
                style={[styles.gradeChip, active && styles.gradeChipActive]}
                onPress={() => setSelectedGrade(g.key)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.gradeChipText,
                    active && styles.gradeChipTextActive,
                  ]}
                >
                  {g.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* 5. VENDOR LIST HEADER */}
        <View style={styles.listHeaderRow}>
          <Text style={styles.sectionTitle}>Registered Public Vendors</Text>
          <Text style={styles.vendorCountBadge}>
            {vendors.length} {vendors.length === 1 ? "Stall" : "Stalls"}
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2E7D32" />
            <Text style={styles.loadingText}>
              Loading registered public market vendors...
            </Text>
          </View>
        ) : errorMessage ? (
          <View style={styles.errorCard}>
            <MaterialCommunityIcons
              name="alert-circle-outline"
              size={40}
              color="#D32F2F"
            />
            <Text style={styles.errorTitle}>Unable to Load Vendors</Text>
            <Text style={styles.errorSub}>{errorMessage}</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => loadVendors(false)}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="refresh" size={16} color="#FFFFFF" />
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : vendors.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialCommunityIcons
              name="store-search-outline"
              size={42}
              color="#7A8D78"
            />
            <Text style={styles.emptyTitle}>No Matching Vendors Found</Text>
            <Text style={styles.emptySub}>
              Try adjusting your search query or market/grade filters.
            </Text>
            <TouchableOpacity
              style={styles.resetFilterBtn}
              onPress={() => {
                setSearchQuery("");
                setSelectedMarket("all");
                setSelectedGrade("all");
              }}
            >
              <Text style={styles.resetFilterBtnText}>Reset Filters</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.vendorList}>
            {vendors.map((vendor) => {
              const gradeTheme = getGradeTheme(vendor.sanitation_grade);
              const summary = vendor.public_inspection_summary || {};
              const inspectionStatusLabel =
                summary.status_label ||
                summary.inspection_status ||
                gradeTheme.statusText;

              return (
                <TouchableOpacity
                  key={String(vendor.id || vendor.vendor_code)}
                  style={styles.vendorCard}
                  activeOpacity={0.88}
                  onPress={() => handleOpenVendorDetail(vendor)}
                >
                  <View style={styles.vendorCardTop}>
                    {/* Left: Grade Circle */}
                    <View
                      style={[
                        styles.gradeBadgeCircle,
                        { backgroundColor: gradeTheme.color },
                      ]}
                    >
                      <Text style={styles.gradeCircleLetter}>
                        {vendor.sanitation_grade || "A"}
                      </Text>
                      <Text style={styles.gradeCircleScore}>
                        {vendor.compliance_score ?? 100}%
                      </Text>
                    </View>

                    {/* Middle: Vendor Info */}
                    <View style={styles.vendorMainInfo}>
                      <View style={styles.vendorTagRow}>
                        <View
                          style={[
                            styles.gradePill,
                            {
                              backgroundColor: gradeTheme.bg,
                              borderColor: gradeTheme.border,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.gradePillText,
                              { color: gradeTheme.color },
                            ]}
                          >
                            {gradeTheme.badgeText}
                          </Text>
                        </View>
                        <Text style={styles.vendorCodeText}>
                          {vendor.vendor_code}
                        </Text>
                      </View>

                      <Text style={styles.vendorBusinessName} numberOfLines={1}>
                        {vendor.business_name}
                      </Text>

                      <View style={styles.vendorMetaRow}>
                        <MaterialCommunityIcons
                          name="storefront-outline"
                          size={14}
                          color="#4A6E46"
                        />
                        <Text style={styles.vendorMetaText} numberOfLines={1}>
                          {vendor.stall_number} • {vendor.market}
                        </Text>
                      </View>
                    </View>

                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={22}
                      color="#7A8D78"
                    />
                  </View>

                  {/* Bottom Summary Strip: Latest Inspection Date & Inspection Status */}
                  <View style={styles.vendorCardFooter}>
                    <View style={styles.footerItem}>
                      <MaterialCommunityIcons
                        name="calendar-check-outline"
                        size={14}
                        color="#5C7858"
                      />
                      <Text style={styles.footerItemText}>
                        Inspected: {summary.inspected_at_formatted || "Certified"}
                      </Text>
                    </View>

                    <View style={styles.footerItem}>
                      <MaterialCommunityIcons
                        name="shield-check-outline"
                        size={14}
                        color={gradeTheme.color}
                      />
                      <Text
                        style={[
                          styles.footerItemText,
                          {
                            color: gradeTheme.color,
                            fontWeight: "700",
                          },
                        ]}
                      >
                        {inspectionStatusLabel}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* ====================================================================
          MODAL 1: PUBLIC VENDOR SANITATION & INSPECTION SUMMARY (READ-ONLY)
          ==================================================================== */}
      <Modal
        visible={detailModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <View style={styles.readOnlyPill}>
                  <MaterialCommunityIcons
                    name="eye-check-outline"
                    size={12}
                    color="#2E7D32"
                  />
                  <Text style={styles.readOnlyPillText}>
                    PUBLIC SANITATION RECORD (READ-ONLY)
                  </Text>
                </View>
                <Text style={styles.modalTitle} numberOfLines={1}>
                  {selectedVendor?.business_name || "Market Vendor Details"}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeModalBtn}
                onPress={() => setDetailModalVisible(false)}
              >
                <MaterialCommunityIcons name="close" size={22} color="#1E331B" />
              </TouchableOpacity>
            </View>

            {loadingDetail && (
              <View style={styles.inlineSyncRow}>
                <ActivityIndicator size="small" color="#2E7D32" />
                <Text style={styles.inlineSyncText}>
                  Syncing latest city inspection record...
                </Text>
              </View>
            )}

            {selectedVendor && (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.modalScroll}
              >
                {(() => {
                  const gradeTheme = getGradeTheme(
                    selectedVendor.sanitation_grade
                  );
                  const summary =
                    selectedVendor.public_inspection_summary || {};
                  const violations = selectedVendor.permitted_violations || {};

                  return (
                    <>
                      {/* 1. PUBLIC GRADE HERO CARD */}
                      <View
                        style={[
                          styles.detailHeroCard,
                          { borderColor: gradeTheme.border },
                        ]}
                      >
                        <View style={styles.detailHeroTop}>
                          <View
                            style={[
                              styles.detailBigGradeCircle,
                              { backgroundColor: gradeTheme.color },
                            ]}
                          >
                            <Text style={styles.detailBigGradeLetter}>
                              {selectedVendor.sanitation_grade || "A"}
                            </Text>
                          </View>

                          <View style={{ flex: 1, marginLeft: 14 }}>
                            <Text
                              style={[
                                styles.detailGradeLabel,
                                { color: gradeTheme.color },
                              ]}
                            >
                              {selectedVendor.grade_label ||
                                `Grade ${selectedVendor.sanitation_grade}`}
                            </Text>
                            <Text style={styles.detailStallMeta}>
                              {selectedVendor.stall_number} •{" "}
                              {selectedVendor.market}
                            </Text>
                            <Text style={styles.detailCodeMeta}>
                              Stall Code: {selectedVendor.vendor_code} • Valid:{" "}
                              {summary.valid_through || "Current Quarter"}
                            </Text>
                          </View>

                          <View
                            style={[
                              styles.scorePillBox,
                              { backgroundColor: gradeTheme.bg },
                            ]}
                          >
                            <Text
                              style={[
                                styles.scorePillVal,
                                { color: gradeTheme.color },
                              ]}
                            >
                              {selectedVendor.compliance_score ?? 100}%
                            </Text>
                            <Text style={styles.scorePillSub}>Score</Text>
                          </View>
                        </View>

                        <View style={styles.standingSummaryBox}>
                          <MaterialCommunityIcons
                            name="shield-check-outline"
                            size={18}
                            color={gradeTheme.color}
                          />
                          <Text style={styles.standingSummaryText}>
                            {summary.standing_summary ||
                              "Certified compliant with municipal public market sanitation standards."}
                          </Text>
                        </View>
                      </View>

                      {/* 2. LATEST PUBLIC INSPECTION SUMMARY */}
                      <View style={styles.detailSectionCard}>
                        <View style={styles.detailSectionHeader}>
                          <MaterialCommunityIcons
                            name="clipboard-check-outline"
                            size={18}
                            color="#2E7D32"
                          />
                          <Text style={styles.detailSectionTitle}>
                            Latest Public Inspection Summary
                          </Text>
                        </View>

                        <View style={styles.metricRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.metricLabel}>
                              Waste Storage & Segregation
                            </Text>
                            <Text style={styles.metricSub}>
                              Segregated bins & color-coded liners
                            </Text>
                          </View>
                          <Text style={styles.metricValue}>
                            {summary.waste_segregation_rating ?? "4.5"} / 5.0 (
                            {summary.waste_segregation_score ?? 90}%)
                          </Text>
                        </View>

                        <View style={styles.metricRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.metricLabel}>
                              Stall Cleanliness
                            </Text>
                            <Text style={styles.metricSub}>
                              Preparation surface & drainage hygiene
                            </Text>
                          </View>
                          <Text style={styles.metricValue}>
                            {summary.stall_cleanliness_rating ?? "4.5"} / 5.0 (
                            {summary.stall_cleanliness_score ?? 90}%)
                          </Text>
                        </View>

                        <View style={styles.metricRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.metricLabel}>
                              Pest Control & Storage
                            </Text>
                            <Text style={styles.metricSub}>
                              Elevated dry storage & sanitary guards
                            </Text>
                          </View>
                          <Text style={styles.metricValue}>
                            {summary.pest_control_rating ?? "4.5"} / 5.0 (
                            {summary.pest_control_score ?? 90}%)
                          </Text>
                        </View>

                        <View style={[styles.metricRow, { borderBottomWidth: 0 }]}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.metricLabel}>
                              Latest Inspection Date
                            </Text>
                            <Text style={styles.metricSub}>
                              Verified by CLENRO Market Sanitation Unit
                            </Text>
                          </View>
                          <Text style={styles.metricValue}>
                            {summary.inspected_at_formatted || "Certified"}
                          </Text>
                        </View>
                      </View>

                      {/* 3. PUBLIC VIOLATIONS INFORMATION */}
                      <View style={styles.detailSectionCard}>
                        <View style={styles.detailSectionHeader}>
                          <MaterialCommunityIcons
                            name="file-certificate-outline"
                            size={18}
                            color="#2E7D32"
                          />
                          <Text style={styles.detailSectionTitle}>
                            Public Violations Information
                          </Text>
                        </View>

                        <View style={styles.violationStatsRow}>
                          <View style={styles.violationStatBox}>
                            <Text
                              style={[
                                styles.violationStatNum,
                                {
                                  color:
                                    (violations.active_count || 0) === 0
                                      ? "#2E7D32"
                                      : "#D97706",
                                },
                              ]}
                            >
                              {violations.active_count ?? 0}
                            </Text>
                            <Text style={styles.violationStatLabel}>
                              Active Citations
                            </Text>
                          </View>

                          <View style={styles.violationStatBox}>
                            <Text style={styles.violationStatNum}>
                              {violations.resolved_count ?? 0}
                            </Text>
                            <Text style={styles.violationStatLabel}>
                              Resolved
                            </Text>
                          </View>

                          <View style={styles.violationStatBox}>
                            <Text style={styles.violationStatNum}>
                              {violations.total_count ?? 0}
                            </Text>
                            <Text style={styles.violationStatLabel}>
                              Total Recorded
                            </Text>
                          </View>
                        </View>

                        <View style={styles.violationStandingBanner}>
                          <MaterialCommunityIcons
                            name={
                              (violations.active_count || 0) === 0
                                ? "check-circle"
                                : "alert-circle"
                            }
                            size={16}
                            color={
                              (violations.active_count || 0) === 0
                                ? "#2E7D32"
                                : "#D97706"
                            }
                          />
                          <Text style={styles.violationStandingText}>
                            {violations.standing_text ||
                              "No active sanitation violations on record"}
                          </Text>
                        </View>

                        {Array.isArray(violations.items) &&
                          violations.items.length > 0 && (
                            <View style={styles.violationItemsList}>
                              {violations.items.map((vItem) => (
                                <View
                                  key={String(vItem.id)}
                                  style={styles.violationRecordRow}
                                >
                                  <View style={{ flex: 1 }}>
                                    <Text style={styles.violationTypeTitle}>
                                      {vItem.violation_type}
                                    </Text>
                                    <Text style={styles.violationMetaSub}>
                                      Penalty: {vItem.penalty} •{" "}
                                      {vItem.recorded_date}
                                    </Text>
                                  </View>
                                  <View
                                    style={[
                                      styles.violationStatusBadge,
                                      vItem.status === "resolved"
                                        ? styles.violationResolvedBadge
                                        : styles.violationPendingBadge,
                                    ]}
                                  >
                                    <Text
                                      style={[
                                        styles.violationStatusText,
                                        vItem.status === "resolved"
                                          ? styles.violationResolvedText
                                          : styles.violationPendingText,
                                      ]}
                                    >
                                      {vItem.status_label}
                                    </Text>
                                  </View>
                                </View>
                              ))}
                            </View>
                          )}
                      </View>
                    </>
                  );
                })()}
              </ScrollView>
            )}

            <TouchableOpacity
              style={styles.modalPrimaryCloseBtn}
              onPress={() => setDetailModalVisible(false)}
            >
              <Text style={styles.modalPrimaryCloseText}>Close Details</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* RESIDENT 5-TAB BOTTOM HOTBAR */}
      <ResidentHotbar />
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
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#EEF5ED",
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F2F7F1",
    justifyContent: "center",
    alignItems: "center",
  },
  headerCenter: {
    flex: 1,
    marginHorizontal: 10,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#1E331B",
  },
  headerSubtitle: {
    fontSize: 11,
    color: "#688264",
    fontWeight: "600",
  },
  scanHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2E7D32",
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 5,
  },
  scanHeaderBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 105,
  },
  searchBar: {
    height: 46,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    borderWidth: 1.2,
    borderColor: "#DDEADA",
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13.5,
    color: "#1E331B",
  },
  filterRow: {
    gap: 8,
    paddingBottom: 8,
  },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#F2F7F1",
    borderWidth: 1,
    borderColor: "#DCE8D9",
  },
  filterPillActive: {
    backgroundColor: "#2E7D32",
    borderColor: "#2E7D32",
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#4A6B46",
  },
  filterPillTextActive: {
    color: "#FFFFFF",
  },
  gradeFilterRow: {
    gap: 8,
    paddingBottom: 14,
  },
  gradeChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E0EAE0",
  },
  gradeChipActive: {
    backgroundColor: "#E8F8EE",
    borderColor: "#2E7D32",
  },
  gradeChipText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#688264",
  },
  gradeChipTextActive: {
    color: "#2E7D32",
    fontWeight: "800",
  },
  listHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#1E331B",
  },
  vendorCountBadge: {
    fontSize: 11.5,
    fontWeight: "800",
    color: "#2E7D32",
    backgroundColor: "#E8F8EE",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: "#688264",
    fontWeight: "600",
  },
  errorCard: {
    backgroundColor: "#FFF8F8",
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FFCDD2",
  },
  errorTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#B71C1C",
    marginTop: 8,
  },
  errorSub: {
    fontSize: 12,
    color: "#6E4B4B",
    textAlign: "center",
    marginTop: 4,
    lineHeight: 17,
  },
  retryBtn: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#2E7D32",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
  },
  retryBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 28,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E6EFE5",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1E331B",
    marginTop: 10,
  },
  emptySub: {
    fontSize: 12,
    color: "#7A8D78",
    textAlign: "center",
    marginTop: 4,
  },
  resetFilterBtn: {
    marginTop: 14,
    backgroundColor: "#2E7D32",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
  },
  resetFilterBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  vendorList: {
    gap: 12,
  },
  vendorCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: "#E6EFE5",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
  },
  vendorCardTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  gradeBadgeCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  gradeCircleLetter: {
    fontSize: 21,
    fontWeight: "900",
    color: "#FFFFFF",
    lineHeight: 24,
  },
  gradeCircleScore: {
    fontSize: 10,
    fontWeight: "800",
    color: "rgba(255,255,255,0.92)",
  },
  vendorMainInfo: {
    flex: 1,
    marginRight: 8,
  },
  vendorTagRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 4,
  },
  gradePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  gradePillText: {
    fontSize: 10,
    fontWeight: "800",
  },
  vendorCodeText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#7A8D78",
  },
  vendorBusinessName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1E331B",
  },
  vendorMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
  },
  vendorMetaText: {
    fontSize: 12,
    color: "#4A6E46",
    fontWeight: "600",
    flex: 1,
  },
  vendorCardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F1F6F0",
  },
  footerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  footerItemText: {
    fontSize: 11,
    color: "#5C7858",
    fontWeight: "600",
  },

  /* MODALS */
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 28, 15, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalSheet: {
    width: "100%",
    maxWidth: 520,
    maxHeight: "88%",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 18,
  },
  scannerModalCard: {
    width: "100%",
    maxWidth: 480,
    maxHeight: "88%",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 18,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF5ED",
  },
  readOnlyPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
  readOnlyPillText: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#2E7D32",
    letterSpacing: 0.4,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#1E331B",
  },
  scannerModalSub: {
    fontSize: 11.5,
    color: "#688264",
    marginTop: 2,
  },
  closeModalBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F2F7F1",
    justifyContent: "center",
    alignItems: "center",
  },
  inlineSyncRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
  },
  inlineSyncText: {
    fontSize: 11.5,
    color: "#2E7D32",
    fontWeight: "600",
  },
  modalScroll: {
    paddingVertical: 12,
  },
  detailHeroCard: {
    backgroundColor: "#FAFDFA",
    borderRadius: 18,
    padding: 15,
    borderWidth: 1.5,
    marginBottom: 14,
  },
  detailHeroTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  detailBigGradeCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    justifyContent: "center",
    alignItems: "center",
  },
  detailBigGradeLetter: {
    fontSize: 30,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  detailGradeLabel: {
    fontSize: 14,
    fontWeight: "900",
  },
  detailStallMeta: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#1E331B",
    marginTop: 2,
  },
  detailCodeMeta: {
    fontSize: 11,
    color: "#688264",
    marginTop: 2,
  },
  scorePillBox: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    alignItems: "center",
  },
  scorePillVal: {
    fontSize: 15,
    fontWeight: "900",
  },
  scorePillSub: {
    fontSize: 9.5,
    fontWeight: "700",
    color: "#5C7858",
  },
  standingSummaryBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#E8F2E6",
  },
  standingSummaryText: {
    flex: 1,
    fontSize: 11.5,
    color: "#2C3E2A",
    lineHeight: 16,
    fontWeight: "600",
  },
  detailSectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E8F0E6",
    marginBottom: 14,
  },
  detailSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  detailSectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1E331B",
  },
  metricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: "#F2F6F1",
  },
  metricLabel: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#1E331B",
  },
  metricSub: {
    fontSize: 10.5,
    color: "#7A8D78",
    marginTop: 1,
  },
  metricValue: {
    fontSize: 12.5,
    fontWeight: "800",
    color: "#2E7D32",
  },
  violationStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 10,
  },
  violationStatBox: {
    flex: 1,
    backgroundColor: "#F7FAF6",
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E6EFE5",
  },
  violationStatNum: {
    fontSize: 18,
    fontWeight: "900",
    color: "#1E331B",
  },
  violationStatLabel: {
    fontSize: 10.5,
    fontWeight: "600",
    color: "#688264",
    marginTop: 2,
  },
  violationStandingBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F2F8F3",
    padding: 10,
    borderRadius: 10,
  },
  violationStandingText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    color: "#1E331B",
  },
  violationItemsList: {
    marginTop: 10,
    gap: 8,
  },
  violationRecordRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#EEF4ED",
  },
  violationTypeTitle: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#1E331B",
  },
  violationMetaSub: {
    fontSize: 11,
    color: "#688264",
    marginTop: 2,
  },
  violationStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  violationResolvedBadge: {
    backgroundColor: "#E8F8EE",
  },
  violationPendingBadge: {
    backgroundColor: "#FFF8E1",
  },
  violationStatusText: {
    fontSize: 10.5,
    fontWeight: "800",
  },
  violationResolvedText: {
    color: "#2E7D32",
  },
  violationPendingText: {
    color: "#D97706",
  },
  modalPrimaryCloseBtn: {
    backgroundColor: "#2E7D32",
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 6,
  },
  modalPrimaryCloseText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
});
