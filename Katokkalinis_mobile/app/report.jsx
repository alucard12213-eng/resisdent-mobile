import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import InitialsAvatar from "../components/InitialsAvatar";
import KatokLogo from "../components/KatokLogo";
import ReportEvidenceImage from "../components/ReportEvidenceImage";
import ResidentHotbar from "../components/ResidentHotbar";
import { resolveMediaUrl } from "../services/api";
import { fetchReports } from "../services/resident";

const fallbackReports = [
  {
    id: "1",
    name: "Jane Doe",
    location: "Barangay 4, Cagayan de Oro",
    time: "1 hour ago",
    status: "In Progress",
    text: "Uncollected waste bags accumulating along the designated barangay roadside pickup point. Needs compactor clearing.",
    imageUrl: "https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&w=600&q=80",
    avatar: null,
    category: "Uncollected Waste",
  },
  {
    id: "2",
    name: "John Doe",
    location: "Barangay 12, Cagayan de Oro",
    time: "2 days ago",
    status: "Resolved",
    text: "Missed scheduled garbage collection on Wednesday morning. Assigned compactor unit returned and completed clearing.",
    avatar: null,
    category: "Missed Schedules",
  },
  {
    id: "3",
    name: "Maria Santos",
    location: "Barangay 1, Cagayan de Oro",
    time: "4 days ago",
    status: "Resolved",
    text: "Damaged roadside waste receptacle replaced with a new color-coded segregated container.",
    avatar: null,
    category: "Other Sanitation Concerns",
  },
];

export default function Report() {
  const router = useRouter();
  const [filter, setFilter] = useState("all");
  const [reports, setReports] = useState(fallbackReports);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [fullScreenPhoto, setFullScreenPhoto] = useState(null);

  const loadReports = useCallback(async () => {
    try {
      const res = await fetchReports({ status: filter === "all" ? undefined : filter });
      if (res && res.success && Array.isArray(res.reports)) {
        if (res.reports.length > 0) {
          const formatted = res.reports.map((r) => ({
            id: String(r.id),
            name: r.user?.name || "Resident",
            location: r.barangay?.name || r.location || "Cagayan de Oro",
            time: r.created_at ? new Date(r.created_at).toLocaleDateString() : "Recent",
            status: r.status === "completed" || r.status === "resolved" ? "Resolved" : "In Progress",
            text: r.description || r.title || "Waste issue reported",
            imageUrl: resolveMediaUrl(r.image_url || r.image),
            avatar: resolveMediaUrl(r.user?.avatar_url || r.user?.avatar || null),
            category: r.category || "Waste Report",
          }));
          setReports(formatted);
        } else {
          setReports([]);
        }
      } else {
        setReports(fallbackReports);
      }
    } catch (e) {
      console.warn("Could not load backend reports, showing fallbacks:", e);
      setReports(fallbackReports);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const onRefresh = () => {
    setRefreshing(true);
    loadReports();
  };

  const filteredReports = reports.filter((r) => {
    if (filter === "all") return true;
    if (filter === "pending") return r.status === "In Progress";
    if (filter === "resolved") return r.status === "Resolved";
    return true;
  });

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
          style={styles.newReportBtn}
          activeOpacity={0.85}
          onPress={() => router.push("/post")}
        >
          <MaterialCommunityIcons name="plus" size={18} color="#FFFFFF" />
          <Text style={styles.newReportBtnText}>Report</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#2E7D32"]} />}
      >
        {/* 2. TITLE BAR */}
        <View style={styles.titleSection}>
          <Text style={styles.pageTitle}>Community Reports</Text>
          <Text style={styles.pageSubtitle}>
            Waste reports and sanitation updates submitted across Cagayan de Oro
          </Text>
        </View>

        {/* 3. FILTER CHIPS */}
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterChip, filter === "all" && styles.filterChipActive]}
            onPress={() => setFilter("all")}
          >
            <Text style={[styles.filterText, filter === "all" && styles.filterTextActive]}>
              All ({reports.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filter === "pending" && styles.filterChipActive]}
            onPress={() => setFilter("pending")}
          >
            <Text style={[styles.filterText, filter === "pending" && styles.filterTextActive]}>
              In Progress
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filter === "resolved" && styles.filterChipActive]}
            onPress={() => setFilter("resolved")}
          >
            <Text style={[styles.filterText, filter === "resolved" && styles.filterTextActive]}>
              Resolved
            </Text>
          </TouchableOpacity>
        </View>

        {/* 4. QUICK CREATE BANNER */}
        <TouchableOpacity
          style={styles.createBanner}
          activeOpacity={0.88}
          onPress={() => router.push("/post")}
        >
          <View style={styles.createIconBox}>
            <MaterialCommunityIcons name="camera-plus" size={24} color="#2E7D32" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.createBannerTitle}>Submit New Report</Text>
            <Text style={styles.createBannerSub}>
              Attach photo evidence of uncollected garbage or bin issues.
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color="#2E7D32" />
        </TouchableOpacity>

        {/* 5. REPORTS FEED */}
        {loading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#2E7D32" />
            <Text style={styles.loadingText}>Loading reports...</Text>
          </View>
        ) : filteredReports.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <MaterialCommunityIcons name="clipboard-check-outline" size={36} color="#2E7D32" />
            </View>
            <Text style={styles.emptyTitle}>No Reports in this Category</Text>
            <Text style={styles.emptySub}>
              There are currently no active sanitation issues or missed collection reports logged for this view.
            </Text>
            <TouchableOpacity
              style={styles.emptyActionButton}
              onPress={() => router.push("/post")}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="plus-circle-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.emptyActionText}>Submit New Report</Text>
            </TouchableOpacity>
          </View>
        ) : (
          filteredReports.map((report) => (
            <TouchableOpacity
              key={report.id}
              style={styles.reportCard}
              activeOpacity={0.88}
              onPress={() => setSelectedReport(report)}
            >
              <View style={styles.cardHeader}>
                <InitialsAvatar
                  name={report.name}
                  avatarUri={report.avatar}
                  size={42}
                  style={styles.authorAvatar}
                />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.authorName}>{report.name}</Text>
                  <View style={styles.locationRow}>
                    <MaterialCommunityIcons name="map-marker-outline" size={13} color="#6B8468" />
                    <Text style={styles.locationText} numberOfLines={1}>{report.location}</Text>
                  </View>
                </View>

                <View
                  style={[
                    styles.statusBadge,
                    report.status === "Resolved" ? styles.resolvedBadge : styles.inProgressBadge,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      report.status === "Resolved" ? styles.resolvedBadgeText : styles.inProgressBadgeText,
                    ]}
                  >
                    {report.status}
                  </Text>
                </View>
              </View>

              <Text style={styles.reportDescription} numberOfLines={3}>
                {report.text}
              </Text>

              {report.imageUrl ? (
                <View style={styles.cardImageContainer}>
                  <ReportEvidenceImage
                    uri={report.imageUrl}
                    imageHeight={180}
                    onPressFullScreen={(url) => setFullScreenPhoto(url)}
                  />
                </View>
              ) : null}

              <View style={styles.cardFooter}>
                <View style={styles.timeRow}>
                  <MaterialCommunityIcons name="clock-outline" size={13} color="#8DA78B" />
                  <Text style={styles.timeText}>{report.time}</Text>
                </View>

                <View style={styles.tapDetailsPrompt}>
                  <Text style={styles.tapDetailsText}>View Details</Text>
                  <MaterialCommunityIcons name="chevron-right" size={14} color="#2E7D32" />
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* 6. DETAIL VIEW MODAL (Requirement 7) */}
      <Modal visible={!!selectedReport} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Issue Report Details</Text>
                <Text style={styles.modalSub}>Report #{selectedReport?.id}</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setSelectedReport(null)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialCommunityIcons name="close" size={22} color="#556655" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
              {/* Status Badge & Reporter */}
              <View style={styles.modalMetaRow}>
                <View style={styles.reporterInfo}>
                  <InitialsAvatar
                    name={selectedReport?.name}
                    avatarUri={selectedReport?.avatar}
                    size={44}
                    style={styles.modalAvatar}
                  />
                  <View style={{ marginLeft: 8 }}>
                    <Text style={styles.modalReporterName}>{selectedReport?.name}</Text>
                    <Text style={styles.modalTime}>{selectedReport?.time}</Text>
                  </View>
                </View>

                <View
                  style={[
                    styles.statusBadge,
                    selectedReport?.status === "Resolved" ? styles.resolvedBadge : styles.inProgressBadge,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusBadgeText,
                      selectedReport?.status === "Resolved" ? styles.resolvedBadgeText : styles.inProgressBadgeText,
                    ]}
                  >
                    {selectedReport?.status}
                  </Text>
                </View>
              </View>

              {/* Location Tag */}
              <View style={styles.modalLocationTag}>
                <MaterialCommunityIcons name="map-marker" size={16} color="#2E7D32" />
                <Text style={styles.modalLocationText}>{selectedReport?.location}</Text>
              </View>

              {/* Full Description */}
              <Text style={styles.modalSectionLabel}>Description</Text>
              <View style={styles.modalTextBox}>
                <Text style={styles.modalDescriptionText}>{selectedReport?.text}</Text>
              </View>

              {/* Photo Evidence */}
              {selectedReport?.imageUrl ? (
                <View style={{ marginTop: 14 }}>
                  <Text style={styles.modalSectionLabel}>Photo Evidence</Text>
                  <ReportEvidenceImage
                    uri={selectedReport.imageUrl}
                    imageHeight={220}
                    onPressFullScreen={(url) => setFullScreenPhoto(url)}
                  />
                </View>
              ) : null}

              <TouchableOpacity
                style={styles.modalActionButton}
                onPress={() => setSelectedReport(null)}
                activeOpacity={0.88}
              >
                <Text style={styles.modalActionText}>Close</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 7. FULL-SCREEN IMAGE VIEWER MODAL */}
      <Modal visible={!!fullScreenPhoto} transparent animationType="fade">
        <View style={styles.fullScreenBackdrop}>
          <TouchableOpacity
            style={styles.fullScreenCloseBtn}
            onPress={() => setFullScreenPhoto(null)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <MaterialCommunityIcons name="close" size={26} color="#FFFFFF" />
          </TouchableOpacity>

          {fullScreenPhoto && (
            <Image
              source={{ uri: fullScreenPhoto }}
              style={styles.fullScreenImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      {/* 8. BOTTOM NAVIGATION BAR */}
      <ResidentHotbar activeTab="reports" />
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
  newReportBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2E7D32",
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 18,
    gap: 4,
  },
  newReportBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 90,
  },
  titleSection: {
    marginBottom: 14,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#1E331B",
  },
  pageSubtitle: {
    fontSize: 12,
    color: "#688264",
    marginTop: 3,
    fontWeight: "500",
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  filterChip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D8E6D6",
  },
  filterChipActive: {
    backgroundColor: "#2E7D32",
    borderColor: "#2E7D32",
  },
  filterText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#556E51",
  },
  filterTextActive: {
    color: "#FFFFFF",
  },
  createBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F8EE",
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#C5EBD2",
  },
  createIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#C5EBD2",
  },
  createBannerTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1E331B",
  },
  createBannerSub: {
    fontSize: 11,
    color: "#557551",
    marginTop: 2,
  },
  loadingContainer: {
    paddingVertical: 30,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 8,
    fontSize: 13,
    color: "#688264",
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 26,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EDF4EC",
    marginTop: 10,
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.03,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#E8F8EE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1E331B",
    marginTop: 4,
  },
  emptySub: {
    fontSize: 12,
    color: "#6B8468",
    marginTop: 4,
    textAlign: "center",
    lineHeight: 17,
    maxWidth: 270,
  },
  emptyActionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2E7D32",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 16,
    elevation: 2,
    shadowColor: "#2E7D32",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  emptyActionText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "800",
  },
  reportCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#EDF4EC",
    elevation: 2,
    shadowColor: "#1A3816",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  authorAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#E8F8EE",
  },
  authorName: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1E331B",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  locationText: {
    fontSize: 11,
    color: "#6B8468",
    marginLeft: 3,
  },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
  },
  inProgressBadge: {
    backgroundColor: "#FFF3E0",
  },
  inProgressBadgeText: {
    color: "#E65100",
    fontSize: 11,
    fontWeight: "800",
  },
  resolvedBadge: {
    backgroundColor: "#E8F8EE",
  },
  resolvedBadgeText: {
    color: "#2E7D32",
    fontSize: 11,
    fontWeight: "800",
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "800",
  },
  reportDescription: {
    fontSize: 13,
    lineHeight: 18,
    color: "#2C3D29",
    marginBottom: 10,
  },
  cardImageContainer: {
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
    marginBottom: 10,
  },
  cardImage: {
    width: "100%",
    height: 140,
  },
  photoOverlayBadge: {
    position: "absolute",
    bottom: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  photoOverlayText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F4F8F3",
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  timeText: {
    fontSize: 11,
    color: "#8DA78B",
  },
  tapDetailsPrompt: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  tapDetailsText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2E7D32",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(10, 20, 10, 0.55)",
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
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF4ED",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#1E331B",
  },
  modalSub: {
    fontSize: 11,
    color: "#7A8D78",
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F2F7F1",
    alignItems: "center",
    justifyContent: "center",
  },
  modalScroll: {
    paddingTop: 14,
    paddingBottom: 10,
  },
  modalMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  reporterInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  modalAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  modalReporterName: {
    fontSize: 12,
    fontWeight: "800",
    color: "#1E331B",
  },
  modalTime: {
    fontSize: 10,
    color: "#8DA78B",
  },
  modalLocationTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0F7EE",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 14,
    gap: 6,
  },
  modalLocationText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1E331B",
  },
  modalSectionLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: "#557050",
    marginBottom: 6,
  },
  modalTextBox: {
    backgroundColor: "#F9FAF8",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#EDF2EC",
    marginBottom: 12,
  },
  modalDescriptionText: {
    fontSize: 13,
    lineHeight: 19,
    color: "#243322",
  },
  modalFullImage: {
    width: "100%",
    height: 200,
    borderRadius: 14,
    marginBottom: 14,
  },
  modalActionButton: {
    backgroundColor: "#2E7D32",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  modalActionText: {
    color: "#FFFFFF",
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
  fullScreenBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.94)",
    justifyContent: "center",
    alignItems: "center",
    padding: 10,
  },
  fullScreenCloseBtn: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 99,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  fullScreenImage: {
    width: "100%",
    height: "85%",
  },
});