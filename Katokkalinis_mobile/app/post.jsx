import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import BarangayPickerModal, {
  BARANGAYS_1_TO_40,
} from "../components/BarangayPickerModal";
import { submitReport } from "../services/resident";

const issueCategories = [
  { id: "uncollected", label: "Uncollected Waste", icon: "trash-can-outline" },
  { id: "missed_schedules", label: "Missed Schedules", icon: "calendar-alert" },
  { id: "illegal_dumping", label: "Illegal Dumping", icon: "alert-octagon-outline" },
  { id: "other_concerns", label: "Other Sanitation Concerns", icon: "clipboard-alert-outline" },
];

export default function Post() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedBarangay, setSelectedBarangay] = useState(BARANGAYS_1_TO_40[11]);
  const [selectedCategory, setSelectedCategory] = useState(issueCategories[0].id);
  const [photoUri, setPhotoUri] = useState(null);
  const [photoBase64, setPhotoBase64] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadStoredData = async () => {
      try {

        const stored = await AsyncStorage.getItem("userBarangay");
        if (stored) {
          const match = stored.match(/(\d+)/);
          if (match) {
            const id = parseInt(match[1], 10);
            if (id >= 1 && id <= 40) {
              setSelectedBarangay(BARANGAYS_1_TO_40[id - 1]);
            }
          }
        }
      } catch (e) {
        console.error(e);
      }
    };
    loadStoredData();
  }, []);

  const handleReport = async () => {
    if (!title.trim()) {
      Alert.alert("Missing Title", "Please provide a short title for the report.");
      return;
    }
    if (!description.trim()) {
      Alert.alert("Missing Description", "Please describe the situation or location details.");
      return;
    }

    try {
      setLoading(true);
      const activeCat = issueCategories.find((c) => c.id === selectedCategory);
      const categoryLabel = activeCat ? activeCat.label : "Uncollected Waste";
      const data = {
        title: `[${categoryLabel}] ${title.trim()}`,
        category: categoryLabel,
        description: description.trim(),
        location: `${selectedBarangay.name}, Cagayan de Oro City`,
        barangay_id: selectedBarangay.id,
        image_url: photoBase64
          ? `data:image/jpeg;base64,${photoBase64}`
          : (photoUri && photoUri.startsWith("http") ? photoUri : undefined),
      };

      const response = await submitReport(data);

      if (response.success) {
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {
          // Haptics fallback
        }

        try {
          const currentCountStr = await AsyncStorage.getItem("userReportsCount");
          const nextCount = parseInt(currentCountStr || "0", 10) + 1;
          await AsyncStorage.setItem("userReportsCount", String(nextCount));
        } catch (e) {
          console.warn("Could not update local report count:", e);
        }

        Alert.alert(
          "Report Submitted",
          "Your report has been logged and sent to municipal sanitation dispatchers.",
          [
            {
              text: "OK",
              onPress: () => router.back(),
            },
          ]
        );
      } else {
        Alert.alert("Error", response.message || "Failed to submit report.");
      }
    } catch (_error) {
      Alert.alert("Error", "An unexpected error occurred while connecting.");
    } finally {
      setLoading(false);
    }
  };

  const handlePickPhoto = () => {
    Alert.alert("Photo Evidence", "Choose photo source:", [
      {
        text: "Take Photo (Camera)",
        onPress: async () => {
          try {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== "granted") {
              Alert.alert("Permission needed", "Camera permission is required to take a photo.");
              return;
            }
            const result = await ImagePicker.launchCameraAsync({
              allowsEditing: true,
              quality: 0.6,
              base64: true,
            });
            if (!result.canceled && result.assets?.[0]?.uri) {
              setPhotoUri(result.assets[0].uri);
              if (result.assets[0].base64) {
                setPhotoBase64(result.assets[0].base64);
              }
            }
          } catch (e) {
            console.error("Camera error:", e);
          }
        },
      },
      {
        text: "Choose from Gallery",
        onPress: async () => {
          try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== "granted") {
              Alert.alert("Permission needed", "Gallery permission is required to select a photo.");
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ["images"],
              allowsEditing: true,
              quality: 0.6,
              base64: true,
            });
            if (!result.canceled && result.assets?.[0]?.uri) {
              setPhotoUri(result.assets[0].uri);
              if (result.assets[0].base64) {
                setPhotoBase64(result.assets[0].base64);
              }
            }
          } catch (e) {
            console.error("Gallery error:", e);
          }
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
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

        <Text style={styles.headerTitle}>Create Issue Report</Text>

        <View style={styles.headerRightPlaceholder} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* 2. SECTION GREETING BANNER (Matching Dashboard section intro) */}
        <View style={styles.greetingBar}>
          <Text style={styles.sectionTitle}>Report Waste Issue</Text>
          <Text style={styles.sectionSubtitle}>
            Submit sanitation alerts directly to municipal collection teams
          </Text>
        </View>

        {/* 3. MAIN FORM CARD (Matching Dashboard / Profile clean white card) */}
        <View style={styles.formCard}>
          {/* LOCATION / BARANGAY */}
          <View style={styles.labelRow}>
            <View style={styles.iconBadge}>
              <MaterialCommunityIcons name="map-marker" size={15} color="#2E7D32" />
            </View>
            <Text style={styles.fieldLabel}>Location / Barangay</Text>
          </View>
          <BarangayPickerModal
            selectedBarangay={selectedBarangay.name}
            onSelect={(b) => setSelectedBarangay(b)}
          />

          <View style={styles.divider} />

          {/* ISSUE CATEGORY */}
          <View style={styles.labelRow}>
            <View style={styles.iconBadge}>
              <MaterialCommunityIcons name="tag-outline" size={15} color="#2E7D32" />
            </View>
            <Text style={styles.fieldLabel}>Category</Text>
          </View>
          <View style={styles.categoriesGrid}>
            {issueCategories.map((cat) => {
              const isSelected = selectedCategory === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.categoryPill, isSelected && styles.categoryPillActive]}
                  onPress={() => setSelectedCategory(cat.id)}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons
                    name={cat.icon}
                    size={15}
                    color={isSelected ? "#FFFFFF" : "#2E7D32"}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.categoryPillText,
                      isSelected && styles.categoryPillTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.divider} />

          {/* ISSUE TITLE */}
          <View style={styles.labelRow}>
            <View style={styles.iconBadge}>
              <MaterialCommunityIcons name="format-title" size={15} color="#2E7D32" />
            </View>
            <Text style={styles.fieldLabel}>Issue Title</Text>
          </View>
          <View style={styles.inputContainer}>
            <TextInput
              placeholder="e.g. Garbage uncollected near market gate"
              placeholderTextColor="#9AA998"
              style={styles.input}
              value={title}
              onChangeText={setTitle}
            />
          </View>

          <View style={styles.divider} />

          {/* DETAILED DESCRIPTION */}
          <View style={styles.labelRow}>
            <View style={styles.iconBadge}>
              <MaterialCommunityIcons name="text-box-outline" size={15} color="#2E7D32" />
            </View>
            <Text style={styles.fieldLabel}>Detailed Description</Text>
          </View>
          <View style={styles.textareaContainer}>
            <TextInput
              multiline
              placeholder="Describe the exact location, landmarks, severity, or special instructions..."
              placeholderTextColor="#9AA998"
              style={styles.textarea}
              textAlignVertical="top"
              value={description}
              onChangeText={setDescription}
            />
          </View>

          <View style={styles.divider} />

          {/* PHOTO EVIDENCE */}
          <View style={styles.labelRow}>
            <View style={styles.iconBadge}>
              <MaterialCommunityIcons name="camera-outline" size={15} color="#2E7D32" />
            </View>
            <Text style={styles.fieldLabel}>Photo Evidence (Optional)</Text>
          </View>

          {photoUri ? (
            <View style={styles.previewContainer}>
              <Image source={{ uri: photoUri }} style={styles.previewImage} resizeMode="cover" />
              <TouchableOpacity
                style={styles.removePhotoBtn}
                onPress={() => {
                  setPhotoUri(null);
                  setPhotoBase64(null);
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialCommunityIcons name="close-circle" size={24} color="#D32F2F" />
              </TouchableOpacity>
              <View style={styles.photoAttachedBadge}>
                <MaterialCommunityIcons name="check-circle" size={15} color="#2E7D32" />
                <Text style={styles.photoAttachedText}>Photo attached as evidence</Text>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.attachCard}
              onPress={handlePickPhoto}
              activeOpacity={0.85}
            >
              <View style={styles.attachIconBox}>
                <MaterialCommunityIcons name="camera-plus" size={22} color="#2E7D32" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.attachTitle}>Add Photo Evidence</Text>
                <Text style={styles.attachSubtitle}>Take a photo or choose from gallery</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#9AA998" />
            </TouchableOpacity>
          )}
        </View>

        {/* 4. SUBMIT ACTION BUTTON (Matching Dashboard/Profile Primary Button) */}
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.disabledButton]}
          onPress={handleReport}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.submitText}>Submit Report</Text>
              <MaterialCommunityIcons
                name="arrow-right"
                size={20}
                color="#FFFFFF"
                style={{ marginLeft: 8 }}
              />
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
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
    paddingBottom: 40,
  },

  // Greeting Section matching Dashboard
  greetingBar: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#1E331B",
    letterSpacing: -0.2,
  },

  sectionSubtitle: {
    fontSize: 13,
    color: "#5C7558",
    marginTop: 3,
    lineHeight: 18,
  },

  // Form Card matching Dashboard heroCard & Profile card
  formCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 16,
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#EEF5ED",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },

  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },

  iconBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#E8F8EE",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },

  fieldLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#2E382D",
  },

  divider: {
    width: "100%",
    height: 1,
    backgroundColor: "#EEF5ED",
    marginVertical: 14,
  },

  // Categories
  categoriesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  categoryPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F2F9F0",
    borderWidth: 1,
    borderColor: "#D9EED3",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },

  categoryPillActive: {
    backgroundColor: "#2E7D32",
    borderColor: "#2E7D32",
    elevation: 2,
    shadowColor: "#2E7D32",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },

  categoryPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2E7D32",
  },

  categoryPillTextActive: {
    color: "#FFFFFF",
  },

  // Inputs
  inputContainer: {
    backgroundColor: "#F9FCF8",
    borderRadius: 14,
    height: 48,
    paddingHorizontal: 14,
    borderWidth: 1.2,
    borderColor: "#D6E4D4",
    justifyContent: "center",
  },

  input: {
    fontSize: 14,
    color: "#1F2920",
    fontWeight: "500",
  },

  textareaContainer: {
    backgroundColor: "#F9FCF8",
    borderRadius: 14,
    height: 110,
    padding: 12,
    borderWidth: 1.2,
    borderColor: "#D6E4D4",
  },

  textarea: {
    fontSize: 14,
    color: "#1F2920",
    height: "100%",
    fontWeight: "500",
  },

  // Photo Attachment
  attachCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F8EE",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1.2,
    borderColor: "#C5EBD2",
    gap: 12,
  },

  attachIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },

  attachTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#2E7D32",
  },

  attachSubtitle: {
    fontSize: 11,
    color: "#5F7558",
    marginTop: 1,
  },

  previewContainer: {
    borderRadius: 16,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#F2F7F1",
    borderWidth: 1.5,
    borderColor: "#C5EBD2",
  },

  previewImage: {
    width: "100%",
    height: 180,
    borderRadius: 14,
  },

  removePhotoBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },

  photoAttachedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F8EE",
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 6,
  },

  photoAttachedText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2E7D32",
  },

  // Submit Button
  submitButton: {
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

  disabledButton: {
    opacity: 0.6,
  },

  submitText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 16,
    letterSpacing: 0.2,
  },
});