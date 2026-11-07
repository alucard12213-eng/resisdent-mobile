import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import KatokLogo from "../components/KatokLogo";
import TopNotificationBanner from "../components/TopNotificationBanner";
import { fetchFeedback, submitFeedback } from "../services/resident";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const isSmall = SCREEN_WIDTH < 360;

const FEEDBACK_TOPICS = [
  { id: "collection_timing", label: "Collection Timing", icon: "clock-outline" },
  { id: "missed_pickups", label: "Missed Pickups", icon: "truck-fast-outline" },
  { id: "service_quality", label: "Service Quality", icon: "account-star-outline" },
  { id: "app_notifications", label: "App Notifications", icon: "cellphone-check" },
  { id: "general_inquiries", label: "General Inquiries", icon: "help-circle-outline" },
];

export default function Feedback() {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("collection_timing");
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bannerAlert, setBannerAlert] = useState({
    visible: false,
    title: "",
    message: "",
    type: "success",
  });

  useEffect(() => {
    loadFeedback();
  }, []);

  const loadFeedback = async () => {
    try {
      const response = await fetchFeedback();
      if (response && response.success && Array.isArray(response.feedbacks)) {
        setFeedbacks(response.feedbacks);
      }
    } catch (error) {
      console.error("Load feedback error:", error);
    } finally {
      setFetching(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadFeedback();
  };

  const handleSelectTopic = (topicId) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Haptics fallback
    }
    setSelectedTopic(topicId);
  };

  const handleFeedback = async () => {
    if (!content.trim()) {
      Alert.alert("Missing Feedback", "Please write your thoughts or suggestions before submitting.");
      return;
    }

    try {
      setLoading(true);
      const activeTopic = FEEDBACK_TOPICS.find((t) => t.id === selectedTopic);
      const topicPrefix = activeTopic ? `[${activeTopic.label}] ` : "";
      const fullMessage = `${topicPrefix}${content.trim()}`;

      const response = await submitFeedback(fullMessage);

      if (response && response.success) {
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {
          // Haptics fallback
        }

        setBannerAlert({
          visible: true,
          title: "Feedback Received",
          message: "Thank you! Your feedback has been sent to our municipal sanitation dispatchers.",
          type: "success",
        });

        setContent("");
        loadFeedback();
      } else {
        Alert.alert("Error", (response && response.message) || "Failed to submit feedback.");
      }
    } catch (_error) {
      Alert.alert("Error", "An unexpected connection error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Top Banner Alert Component */}
      <TopNotificationBanner
        visible={bannerAlert.visible}
        title={bannerAlert.title}
        message={bannerAlert.message}
        type={bannerAlert.type}
        onDismiss={() => setBannerAlert((prev) => ({ ...prev, visible: false }))}
      />

      {/* 1. TOP HEADER (Identical to Dashboard / Notifications / Report header) */}
      <View style={styles.topHeader}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color="#1E331B" />
          </TouchableOpacity>
          <KatokLogo variant="header" showTagline={false} />
        </View>

        <View style={styles.headerRightBadge}>
          <MaterialCommunityIcons name="message-draw" size={15} color="#2E7D32" />
          <Text style={styles.headerRightBadgeText}>Feedback</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#2E7D32"]}
            tintColor="#2E7D32"
          />
        }
      >
        {/* 2. TITLE BAR */}
        <View style={styles.titleSection}>
          <Text style={styles.pageTitle}>Community Feedback</Text>
          <Text style={styles.pageSubtitle}>
            Share suggestions to help us improve garbage collection & local hygiene
          </Text>
        </View>

        {/* 3. COMPOSE FEEDBACK CARD (Clean card styled identical to Report & Dashboard cards) */}
        <View style={styles.formCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.iconCircle}>
              <MaterialCommunityIcons name="comment-edit-outline" size={18} color="#2E7D32" />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.cardHeaderTitle}>Share Your Thoughts</Text>
              <Text style={styles.cardHeaderSubtitle}>
                Collection timing, route suggestions, or service quality remarks
              </Text>
            </View>
          </View>

          {/* TOPIC SELECTOR PILLS */}
          <Text style={styles.inputLabel}>Feedback Topic</Text>
          <View style={styles.topicsGrid}>
            {FEEDBACK_TOPICS.map((topic) => {
              const isSelected = selectedTopic === topic.id;
              return (
                <TouchableOpacity
                  key={topic.id}
                  style={[styles.topicPill, isSelected && styles.topicPillActive]}
                  onPress={() => handleSelectTopic(topic.id)}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons
                    name={topic.icon}
                    size={14}
                    color={isSelected ? "#FFFFFF" : "#2E7D32"}
                    style={{ marginRight: 5 }}
                  />
                  <Text style={[styles.topicPillText, isSelected && styles.topicPillTextActive]}>
                    {topic.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* TEXTAREA WRAPPER */}
          <Text style={[styles.inputLabel, { marginTop: 12 }]}>Your Message</Text>
          <View style={styles.textareaWrapper}>
            <TextInput
              multiline
              placeholder="Tell us about collection timing, service quality, or suggestions..."
              placeholderTextColor="#8FA58A"
              style={styles.textarea}
              textAlignVertical="top"
              value={content}
              onChangeText={setContent}
              maxLength={500}
            />
            <Text style={styles.charCounter}>{content.length}/500</Text>
          </View>

          {/* SUBMIT BUTTON */}
          <TouchableOpacity
            style={[styles.submitButton, (!content.trim() || loading) && styles.disabledButton]}
            onPress={handleFeedback}
            disabled={loading || !content.trim()}
            activeOpacity={0.88}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Text style={styles.submitText}>Submit Feedback</Text>
                <MaterialCommunityIcons name="send" size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* 4. NOTICE CARD (Matching Schedule & Dashboard notice style) */}
        <View style={styles.noticeCard}>
          <View style={styles.noticeIconBox}>
            <MaterialCommunityIcons name="shield-check-outline" size={22} color="#2E7D32" />
          </View>
          <View style={styles.noticeTextContainer}>
            <Text style={styles.noticeTitle}>Direct Line to Municipal Dispatch</Text>
            <Text style={styles.noticeBody}>
              Your feedback is transmitted directly to the City Local Environment and Natural Resources Office (CLENRO) sanitation team to optimize collection routes.
            </Text>
          </View>
        </View>

        {/* 5. PAST FEEDBACK SECTION */}
        <View style={styles.historyHeaderRow}>
          <Text style={styles.sectionTitle}>Your Past Feedback</Text>
          <View style={styles.historyCountBadge}>
            <Text style={styles.historyCountText}>{feedbacks.length}</Text>
          </View>
        </View>

        {fetching && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color="#2E7D32" />
            <Text style={styles.loadingText}>Loading feedback history...</Text>
          </View>
        ) : feedbacks.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconCircle}>
              <MaterialCommunityIcons name="chat-processing-outline" size={34} color="#8DA78B" />
            </View>
            <Text style={styles.emptyTitle}>No Feedback Submitted Yet</Text>
            <Text style={styles.emptySub}>
              Your voice matters! Share your suggestions above to help keep Cagayan de Oro clean and well-serviced.
            </Text>
          </View>
        ) : (
          feedbacks.map((f) => {
            const hasTopicTag = f.content && f.content.startsWith("[");
            let topicTag = "Suggestion";
            let displayContent = f.content;

            if (hasTopicTag) {
              const closeBracket = f.content.indexOf("]");
              if (closeBracket > 1) {
                topicTag = f.content.substring(1, closeBracket);
                displayContent = f.content.substring(closeBracket + 1).trim();
              }
            }

            return (
              <View key={f.id} style={styles.feedbackCard}>
                <View style={styles.feedbackCardHeader}>
                  <View style={styles.typeBadge}>
                    <MaterialCommunityIcons name="comment-text-outline" size={13} color="#2E7D32" />
                    <Text style={styles.typeBadgeText}>{topicTag}</Text>
                  </View>

                  <View style={styles.dateRow}>
                    <MaterialCommunityIcons name="clock-outline" size={12} color="#8DA78B" />
                    <Text style={styles.feedbackDate}>
                      {f.created_at ? new Date(f.created_at).toLocaleDateString() : "Recent"}
                    </Text>
                  </View>
                </View>

                <Text style={styles.feedbackText}>{displayContent}</Text>

                <View style={styles.cardFooterDivider} />
                <View style={styles.feedbackCardFooter}>
                  <View style={styles.statusIndicator}>
                    <MaterialCommunityIcons name="check-circle" size={13} color="#2E7D32" />
                    <Text style={styles.statusIndicatorText}>Submitted to Municipal Dispatch</Text>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FBFDFB",
    paddingTop: 45,
  },

  // 1. Header (matches dashboard & notifications)
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
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F2F7F1",
    alignItems: "center",
    justifyContent: "center",
  },
  headerRightBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F8EE",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#C5EBD2",
    gap: 4,
  },
  headerRightBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2E7D32",
  },

  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 40,
  },

  // 2. Title Section
  titleSection: {
    marginBottom: 16,
  },
  pageTitle: {
    fontSize: isSmall ? 20 : 22,
    fontWeight: "900",
    color: "#1E331B",
    letterSpacing: -0.2,
  },
  pageSubtitle: {
    fontSize: 13,
    color: "#5C7558",
    marginTop: 4,
    lineHeight: 18,
  },

  // 3. Form Card
  formCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "#EEF4EC",
    marginBottom: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#E8F8EE",
    alignItems: "center",
    justifyContent: "center",
  },
  cardHeaderTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1E331B",
  },
  cardHeaderSubtitle: {
    fontSize: 11,
    color: "#7A8D78",
    marginTop: 1,
  },

  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2E3F2C",
    marginBottom: 8,
  },

  topicsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginBottom: 6,
  },
  topicPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F2F7F1",
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E0EBE0",
  },
  topicPillActive: {
    backgroundColor: "#2E7D32",
    borderColor: "#2E7D32",
  },
  topicPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2E7D32",
  },
  topicPillTextActive: {
    color: "#FFFFFF",
  },

  textareaWrapper: {
    backgroundColor: "#F9FCF8",
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: "#D6E4D4",
    padding: 12,
    height: 115,
    position: "relative",
  },
  textarea: {
    fontSize: 14,
    color: "#1F2920",
    height: "85%",
  },
  charCounter: {
    position: "absolute",
    bottom: 8,
    right: 12,
    fontSize: 10,
    color: "#99AA96",
    fontWeight: "600",
  },

  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2E7D32",
    borderRadius: 14,
    paddingVertical: 13,
    marginTop: 14,
    elevation: 2,
    shadowColor: "#2E7D32",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  disabledButton: {
    opacity: 0.55,
  },
  submitText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.2,
  },

  // 4. Notice Card (Matches Schedule)
  noticeCard: {
    flexDirection: "row",
    backgroundColor: "#EAF6E9",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#CCE8CB",
    alignItems: "center",
    marginBottom: 20,
  },
  noticeIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  noticeTextContainer: {
    flex: 1,
  },
  noticeTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1E5822",
    marginBottom: 2,
  },
  noticeBody: {
    fontSize: 11,
    color: "#476A44",
    lineHeight: 16,
    fontWeight: "500",
  },

  // 5. Past Feedback History
  historyHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1E331B",
  },
  historyCountBadge: {
    backgroundColor: "#E8F8EE",
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#C5EBD2",
  },
  historyCountText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#2E7D32",
  },

  loadingContainer: {
    paddingVertical: 30,
    alignItems: "center",
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: "#7A8D78",
    fontWeight: "600",
  },

  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 26,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EEF4EC",
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.03,
  },
  emptyIconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#F2F7F1",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1E331B",
    marginBottom: 4,
  },
  emptySub: {
    fontSize: 12,
    color: "#6B8468",
    textAlign: "center",
    lineHeight: 17,
    maxWidth: 280,
  },

  feedbackCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#EEF4EC",
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
  },
  feedbackCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F8EE",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
    gap: 4,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2E7D32",
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  feedbackDate: {
    fontSize: 11,
    color: "#8DA78B",
    fontWeight: "600",
  },
  feedbackText: {
    fontSize: 13,
    color: "#2E382D",
    lineHeight: 19,
  },
  cardFooterDivider: {
    height: 1,
    backgroundColor: "#F2F7F1",
    marginTop: 10,
    marginBottom: 8,
  },
  feedbackCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  statusIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statusIndicatorText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#5C7558",
  },
});
