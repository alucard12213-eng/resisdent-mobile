import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import InitialsAvatar from "../components/InitialsAvatar";
import ResidentHotbar from "../components/ResidentHotbar";
import VendorHotbar from "../components/VendorHotbar";
import { apiRequest, resolveMediaUrl } from "../services/api";
import { logoutUser } from "../services/auth";
import { fetchMyReportsCount } from "../services/resident";
import { fetchVendorEvaluation } from "../services/vendor";
import { sanitizePhoneNumber, validatePhilippinePhone } from "../utils/phoneValidation";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const isSmall = SCREEN_WIDTH < 360;

export default function Profile() {
  const router = useRouter();
  const params = useLocalSearchParams();

  // User & role info
  const initialRole = params?.role ? String(params.role) : "resident";
  const [role, setRole] = useState(initialRole); // "resident" | "vendor"
  const [name, setName] = useState("Katok Resident");
  const [email, setEmail] = useState("resident@katokkalinis.com");
  const [contactNumber, setContactNumber] = useState("09467802940");
  const [address, setAddress] = useState("Barangay 12, Cagayan de Oro");
  const [avatarUri, setAvatarUri] = useState(null);

  // Vendor specific fields (dynamically loaded from backend)
  const [vendorId, setVendorId] = useState("VEN-2026012345");
  const [stallNumber, setStallNumber] = useState("Stall #14, Section B");
  const [marketLocation, setMarketLocation] = useState("Cogon Public Market");
  const [businessType, setBusinessType] = useState("Fresh Produce & Food Stall");
  const [sanitationScore, setSanitationScore] = useState("0.0");
  const [complianceScore, setComplianceScore] = useState("0%");
  const [complianceGrade, setComplianceGrade] = useState("N/A");
  const [complianceHistory, setComplianceHistory] = useState("Pending Inspection");
  const [violations, setViolations] = useState("0 Recorded Violations");
  const [violationsCount, setViolationsCount] = useState(0);
  const [recentInspection, setRecentInspection] = useState(null);

  // Modals state
  const [viewModalVisible, setViewModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [securityModalVisible, setSecurityModalVisible] = useState(false);
  const [notifModalVisible, setNotifModalVisible] = useState(false);
  const [activityModalVisible, setActivityModalVisible] = useState(false);
  const [complianceModalVisible, setComplianceModalVisible] = useState(false);

  // Reports count (starts at 0 for new accounts, updates when they post)
  const [reportsCount, setReportsCount] = useState(0);

  // Edit form state
  const [editName, setEditName] = useState(name);
  const [editContact, setEditContact] = useState(contactNumber);
  const [editAddress, setEditAddress] = useState(address);
  const [savingProfile, setSavingProfile] = useState(false);

  // Change Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPass, setChangingPass] = useState(false);

  // Notification Preferences
  const [collectionAlerts, setCollectionAlerts] = useState(true);
  const [pushNotifs, setPushNotifs] = useState(true);
  const [inspectionAlerts, setInspectionAlerts] = useState(true);

  const loadProfile = async () => {
    try {
      const storedRole = await AsyncStorage.getItem("userRole");
      const effectiveRole = params?.role ? String(params.role) : (storedRole || "resident");
      if (effectiveRole) setRole(effectiveRole);

      const storedName = await AsyncStorage.getItem("userName");
      const storedEmail = await AsyncStorage.getItem("userEmail");
      const storedId = await AsyncStorage.getItem("userId");

      if (storedName) {
        setName(storedName);
        setEditName(storedName);
      }
      if (storedEmail) setEmail(storedEmail);
      if (storedId) setVendorId(`VEN-${storedId}`);

      // Load user report count (defaults to 0 for newly created accounts)
      const cachedCountStr = await AsyncStorage.getItem("userReportsCount");
      if (cachedCountStr !== null) {
        setReportsCount(parseInt(cachedCountStr, 10) || 0);
      } else {
        setReportsCount(0);
      }

      // Sync live count from API
      try {
        const liveCount = await fetchMyReportsCount(storedId);
        setReportsCount(liveCount);
        await AsyncStorage.setItem("userReportsCount", String(liveCount));
      } catch (err) {
        console.warn("Could not sync live report count:", err);
      }

      const storedAvatar = await AsyncStorage.getItem("userAvatar");
      if (storedAvatar) setAvatarUri(storedAvatar);

      try {
        const res = await apiRequest("/me", { method: "GET" });
        if (res && res.user) {
          const detectedRole = res.user.vendor
            ? "vendor"
            : (res.user.roles?.[0]?.name || effectiveRole || "resident");
          if (detectedRole) {
            setRole(detectedRole);
            await AsyncStorage.setItem("userRole", detectedRole);
          }
          if (res.user.name) setName(res.user.name);
          if (res.user.email) setEmail(res.user.email);
          if (res.user.contact_number) setContactNumber(res.user.contact_number);
          if (res.user.address) setAddress(res.user.address);
          if (res.user.avatar || res.user.avatar_url) {
            const resolved = resolveMediaUrl(res.user.avatar_url || res.user.avatar);
            if (resolved) {
              setAvatarUri(resolved);
              await AsyncStorage.setItem("userAvatar", resolved);
            }
          }

          if (res.user.vendor) {
            const v = res.user.vendor;
            if (v.stall_number) setStallNumber(v.stall_number);
            if (v.market) {
              setMarketLocation(/divi/i.test(v.market) ? "Cogon Public Market" : v.market);
            }
            if (v.business_name) setBusinessType(v.business_name);
            if (v.vendor_code) setVendorId(`VEN-${v.vendor_code}`);

            const sScore = v.sanitation_score !== null && v.sanitation_score !== undefined
              ? Number(v.sanitation_score).toFixed(1)
              : "0.0";
            const cScore = (v.compliance_score !== null && v.compliance_score !== undefined)
              ? `${v.compliance_score}%`
              : "0%";
            const cGrade = v.compliance_grade ? `Grade ${v.compliance_grade.replace(/^Grade\s*/i, "")}` : "N/A";
            const vCount = v.violations_count ?? 0;

            setSanitationScore(sScore);
            setComplianceScore(cScore);
            setComplianceGrade(cGrade);
            setViolationsCount(vCount);
            setViolations(`${vCount} Recorded Violation${vCount === 1 ? "" : "s"}`);

            try {
              const evalRes = await fetchVendorEvaluation(v.id);
              if (evalRes && evalRes.success && evalRes.evaluation) {
                const ev = evalRes.evaluation;
                if (ev.total_score !== undefined && ev.total_score !== null) {
                  setComplianceScore(`${ev.total_score}%`);
                  setSanitationScore((ev.total_score / 10).toFixed(1));
                  setComplianceGrade(`Grade ${ev.grade}`);
                }
                setComplianceHistory(`Status: ${ev.status ? ev.status.toUpperCase() : 'COMPLETED'} (${ev.valid_through || 'Current Quarter'})`);
                setRecentInspection(ev);
              }
            } catch (err) {
              console.warn("Could not load vendor evaluation details:", err);
            }
          }
        }
      } catch {
        // Offline default fallback
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  // Automatically refresh report count when returning to this screen
  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [])
  );

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      Alert.alert("Validation", "Name cannot be empty.");
      return;
    }

    if (editContact.trim()) {
      const phoneVal = validatePhilippinePhone(editContact);
      if (!phoneVal.isValid) {
        Alert.alert("Invalid Contact Number", phoneVal.error || "Please enter a valid 11-digit mobile number starting with 09.");
        return;
      }
    }

    try {
      setSavingProfile(true);
      const res = await apiRequest("/profile", {
        method: "PUT",
        body: JSON.stringify({
          name: editName.trim(),
          email: email.trim(),
          contact_number: editContact.trim(),
          address: editAddress.trim(),
        }),
      });

      if (res && res.success) {
        setName(editName.trim());
        setContactNumber(editContact.trim());
        setAddress(editAddress.trim());
        await AsyncStorage.setItem("userName", editName.trim());
        Alert.alert("Success", "Profile updated successfully.");
        setEditModalVisible(false);
      } else {
        Alert.alert("Error", res?.message || "Could not update profile.");
      }
    } catch (error) {
      Alert.alert("Error", error?.message || "An error occurred.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert("Validation", "Please fill in all password fields.");
      return;
    }

    if (newPassword.length < 8) {
      Alert.alert("Validation", "New password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Validation", "New passwords do not match.");
      return;
    }

    try {
      setChangingPass(true);
      const res = await apiRequest("/change-password", {
        method: "PUT",
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
          new_password_confirmation: confirmPassword,
        }),
      });

      if (res && res.success) {
        Alert.alert("Success", "Password changed successfully.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setSecurityModalVisible(false);
      } else {
        Alert.alert("Error", res?.message || "Failed to change password.");
      }
    } catch (error) {
      Alert.alert("Error", error?.message || "An error occurred.");
    } finally {
      setChangingPass(false);
    }
  };

  const uploadAvatar = async (asset) => {
    try {
      setAvatarUri(asset.uri);
      const effectiveName = name || (await AsyncStorage.getItem("userName")) || "User";
      const effectiveEmail = email || (await AsyncStorage.getItem("userEmail")) || "user@katokkalinis.com";
      const effectiveContact = contactNumber || (await AsyncStorage.getItem("userContact")) || "";
      const effectiveAddress = address || (await AsyncStorage.getItem("userAddress")) || (await AsyncStorage.getItem("userBarangay")) || "";

      const payload = {
        name: effectiveName,
        email: effectiveEmail,
        contact_number: effectiveContact,
        phone: effectiveContact,
        address: effectiveAddress,
      };
      if (asset.base64) {
        payload.avatar = `data:image/jpeg;base64,${asset.base64}`;
      } else if (asset.uri) {
        payload.avatar = asset.uri;
      }

      const res = await apiRequest("/profile", {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      if (res && res.success && res.user) {
        const perm = resolveMediaUrl(res.user.avatar_url || res.user.avatar);
        if (perm) {
          setAvatarUri(perm);
          await AsyncStorage.setItem("userAvatar", perm);
        }
        Alert.alert("Success", "Profile photo updated and saved permanently.");
      }
    } catch (err) {
      console.warn("Avatar upload error:", err);
      await AsyncStorage.setItem("userAvatar", asset.uri);
    }
  };

  const handlePickAvatar = () => {
    Alert.alert("Profile Photo", "Choose photo source:", [
      {
        text: "Take Photo",
        onPress: async () => {
          try {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== "granted") {
              Alert.alert("Permission needed", "Camera permission is required.");
              return;
            }
            const result = await ImagePicker.launchCameraAsync({
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.7,
              base64: true,
            });
            if (!result.canceled && result.assets?.[0]?.uri) {
              await uploadAvatar(result.assets[0]);
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
              Alert.alert("Permission needed", "Gallery permission is required.");
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ["images"],
              allowsEditing: true,
              aspect: [1, 1],
              quality: 0.7,
              base64: true,
            });
            if (!result.canceled && result.assets?.[0]?.uri) {
              await uploadAvatar(result.assets[0]);
            }
          } catch (e) {
            console.error("Gallery error:", e);
          }
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleLogout = () => {
    Alert.alert(
      "Confirm Logout",
      "Are you sure you want to log out of your account?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            await logoutUser(router);
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={24} color="#1E331B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {role === "vendor" ? "Vendor Profile" : "Resident Profile"}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bounces={true}
      >
        {/* PROFILE CARD */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <InitialsAvatar
              name={name}
              avatarUri={avatarUri}
              size={86}
              style={styles.avatarPhoto}
            />
            <TouchableOpacity
              style={styles.cameraBadge}
              onPress={handlePickAvatar}
              activeOpacity={0.85}
            >
              <Ionicons name="camera" size={16} color="#fff" />
            </TouchableOpacity>
          </View>

          <Text style={styles.nameText}>{name}</Text>
          <Text style={styles.emailText}>{email}</Text>

          <View style={styles.badgeRow}>
            <View style={styles.roleBadge}>
              <Ionicons
                name={role === "vendor" ? "storefront-outline" : "home-outline"}
                size={14}
                color="#2E7D32"
                style={{ marginRight: 4 }}
              />
              <Text style={styles.roleBadgeText}>
                {role === "vendor" ? "Registered Vendor" : "Barangay Resident"}
              </Text>
            </View>
            <View style={styles.idBadge}>
              <Text style={styles.idBadgeText}>ID: {vendorId}</Text>
            </View>
          </View>

          {/* VENDOR METRICS */}
          {role === "vendor" ? (
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{sanitationScore}</Text>
                <Text style={styles.statLabel}>Sanitation Score</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: parseInt(complianceScore, 10) >= 85 ? "#2E7D32" : (parseInt(complianceScore, 10) >= 70 ? "#1976D2" : "#DC2626") }]}>
                  {complianceScore}
                </Text>
                <Text style={styles.statLabel}>Compliance ({complianceGrade})</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: violationsCount > 0 ? "#DC2626" : "#2E7D32" }]}>
                  {violationsCount}
                </Text>
                <Text style={styles.statLabel}>Violations</Text>
              </View>
            </View>
          ) : (
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: "#2E7D32" }]}>{reportsCount}</Text>
                <Text style={styles.statLabel}>Reports Submitted</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: "#1E331B" }]}>Active</Text>
                <Text style={styles.statLabel}>Account Status</Text>
              </View>
            </View>
          )}
        </View>

        {/* MENU SECTIONS */}
        <View style={styles.menuCard}>
          {/* 1. VIEW PROFILE */}
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => setViewModalVisible(true)}
          >
            <View style={[styles.iconBox, { backgroundColor: "#E8F5E9" }]}>
              <Ionicons name="person-outline" size={22} color="#4CAF50" />
            </View>
            <View style={styles.menuTextBox}>
              <Text style={styles.menuTitle}>View Profile</Text>
              <Text style={styles.menuSub}>Personal & stall business details</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#888" />
          </TouchableOpacity>

          {/* 2. EDIT PROFILE */}
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => {
              setEditName(name);
              setEditContact(contactNumber);
              setEditAddress(address);
              setEditModalVisible(true);
            }}
          >
            <View style={[styles.iconBox, { backgroundColor: "#E3F2FD" }]}>
              <Ionicons name="create-outline" size={22} color="#1976D2" />
            </View>
            <View style={styles.menuTextBox}>
              <Text style={styles.menuTitle}>Edit Profile</Text>
              <Text style={styles.menuSub}>Update name, contact & address</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#888" />
          </TouchableOpacity>

          {/* VENDOR SANITATION & COMPLIANCE HISTORY */}
          {role === "vendor" && (
            <TouchableOpacity
              style={styles.menuItem}
              activeOpacity={0.7}
              onPress={() => setComplianceModalVisible(true)}
            >
              <View style={[styles.iconBox, { backgroundColor: "#E0F2F1" }]}>
                <Ionicons name="shield-checkmark-outline" size={22} color="#00796B" />
              </View>
              <View style={styles.menuTextBox}>
                <Text style={styles.menuTitle}>Sanitation & Compliance</Text>
                <Text style={styles.menuSub}>Grades, inspections & violation records</Text>
              </View>
              <Ionicons name="chevron-forward" size={22} color="#888" />
            </TouchableOpacity>
          )}

          {/* 3. SECURITY */}
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => setSecurityModalVisible(true)}
          >
            <View style={[styles.iconBox, { backgroundColor: "#FFF3E0" }]}>
              <Ionicons name="lock-closed-outline" size={22} color="#F57C00" />
            </View>
            <View style={styles.menuTextBox}>
              <Text style={styles.menuTitle}>Security</Text>
              <Text style={styles.menuSub}>Change password & login history</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#888" />
          </TouchableOpacity>

          {/* 4. NOTIFICATIONS */}
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => setNotifModalVisible(true)}
          >
            <View style={[styles.iconBox, { backgroundColor: "#F3E5F5" }]}>
              <Ionicons name="notifications-outline" size={22} color="#7B1FA2" />
            </View>
            <View style={styles.menuTextBox}>
              <Text style={styles.menuTitle}>Notification Settings</Text>
              <Text style={styles.menuSub}>Collection & inspection alerts</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#888" />
          </TouchableOpacity>

          {/* 5. ACTIVITY HISTORY */}
          <TouchableOpacity
            style={styles.menuItem}
            activeOpacity={0.7}
            onPress={() => setActivityModalVisible(true)}
          >
            <View style={[styles.iconBox, { backgroundColor: "#EFEBE9" }]}>
              <Ionicons name="time-outline" size={22} color="#5D4037" />
            </View>
            <View style={styles.menuTextBox}>
              <Text style={styles.menuTitle}>Activity History</Text>
              <Text style={styles.menuSub}>Recent transactions and waste drop-offs</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#888" />
          </TouchableOpacity>

          {/* 6. LOGOUT */}
          <TouchableOpacity
            style={[styles.menuItem, { borderBottomWidth: 0 }]}
            activeOpacity={0.7}
            onPress={handleLogout}
          >
            <View style={[styles.iconBox, { backgroundColor: "#FFEBEE" }]}>
              <Ionicons name="log-out-outline" size={22} color="#D32F2F" />
            </View>
            <View style={styles.menuTextBox}>
              <Text style={[styles.menuTitle, { color: "#D32F2F" }]}>Logout</Text>
              <Text style={styles.menuSub}>Sign out of this device</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#D32F2F" />
          </TouchableOpacity>
        </View>

        {/* EXTRA BOTTOM LOGOUT BUTTON */}
        <TouchableOpacity
          style={styles.bottomLogoutButton}
          activeOpacity={0.8}
          onPress={handleLogout}
        >
          <Ionicons name="power" size={20} color="#D32F2F" style={{ marginRight: 8 }} />
          <Text style={styles.bottomLogoutText}>Log Out Account</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ==================================================== */}
      {/* 1. VIEW PROFILE MODAL */}
      {/* ==================================================== */}
      <Modal visible={viewModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>General Profile</Text>
              <TouchableOpacity onPress={() => setViewModalVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              <Text style={styles.modalSectionHeader}>Personal Information</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Full Name / Business Name</Text>
                <Text style={styles.infoValue}>{name}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Contact Number</Text>
                <Text style={styles.infoValue}>{contactNumber}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Address / Barangay</Text>
                <Text style={styles.infoValue}>{address}</Text>
              </View>

              {role === "vendor" && (
                <>
                  <Text style={styles.modalSectionHeader}>Stall & Business Information</Text>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Vendor ID</Text>
                    <Text style={styles.infoValue}>{vendorId}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Market Location</Text>
                    <Text style={styles.infoValue}>{marketLocation}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Stall Number</Text>
                    <Text style={styles.infoValue}>{stallNumber}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Business Type</Text>
                    <Text style={styles.infoValue}>{businessType}</Text>
                  </View>
                </>
              )}
            </ScrollView>

            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setViewModalVisible(false)}>
              <Text style={styles.modalCloseText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ==================================================== */}
      {/* 2. SANITATION & COMPLIANCE MODAL */}
      {/* ==================================================== */}
      <Modal visible={complianceModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sanitation & Compliance</Text>
              <TouchableOpacity onPress={() => setComplianceModalVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              <Text style={styles.modalSectionHeader}>Current Ratings</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Sanitation Score / Grade</Text>
                <Text style={[styles.infoValue, { color: "#2E7D32", fontWeight: "700" }]}>
                  {sanitationScore} / 10 ({complianceGrade})
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Compliance Score</Text>
                <Text style={styles.infoValue}>{complianceScore}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Compliance History</Text>
                <Text style={styles.infoValue}>{complianceHistory}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Violations Record</Text>
                <Text style={[styles.infoValue, { color: violationsCount > 0 ? "#DC2626" : "#2E7D32" }]}>
                  {violations}
                </Text>
              </View>

              <Text style={styles.modalSectionHeader}>Recent Inspection Assessment</Text>
              {recentInspection ? (
                <View style={styles.activityCard}>
                  <Ionicons name="checkmark-circle-outline" size={22} color="#2E7D32" />
                  <View style={{ marginLeft: 10, flex: 1 }}>
                    <Text style={styles.activityTitle}>Official Inspection ({recentInspection.grade ? `Grade ${recentInspection.grade}` : 'Certified'})</Text>
                    <Text style={styles.activitySub}>Score: {recentInspection.total_score}% • Inspector: {recentInspection.inspector_name || 'Assigned Officer'}</Text>
                    <Text style={styles.activityDate}>{recentInspection.inspected_at_formatted || 'Recently Inspected'}</Text>
                    {recentInspection.notes ? (
                      <Text style={{ fontSize: 11, color: "#666", marginTop: 4, fontStyle: "italic" }}>
                        &ldquo;{recentInspection.notes}&rdquo;
                      </Text>
                    ) : null}
                  </View>
                </View>
              ) : (
                <View style={[styles.activityCard, { opacity: 0.8 }]}>
                  <Ionicons name="information-circle-outline" size={22} color="#7A8D78" />
                  <View style={{ marginLeft: 10, flex: 1 }}>
                    <Text style={styles.activityTitle}>Pending Official Inspection</Text>
                    <Text style={styles.activitySub}>An inspector will conduct an assessment on your stall.</Text>
                  </View>
                </View>
              )}
            </ScrollView>

            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setComplianceModalVisible(false)}>
              <Text style={styles.modalCloseText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ==================================================== */}
      {/* 3. EDIT PROFILE MODAL */}
      {/* ==================================================== */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              <Text style={styles.inputLabel}>Name / Business Name</Text>
              <TextInput
                style={styles.modalInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Enter name"
                placeholderTextColor="#999"
              />

              <Text style={styles.inputLabel}>Contact Number</Text>
              <TextInput
                style={[
                  styles.modalInput,
                  editContact.length > 0 && !validatePhilippinePhone(editContact).isValid && { borderColor: "#D32F2F" },
                ]}
                value={editContact}
                onChangeText={(text) => setEditContact(sanitizePhoneNumber(text))}
                placeholder="09XXXXXXXXX (11 digits)"
                placeholderTextColor="#999"
                keyboardType="numeric"
                maxLength={11}
              />
              {editContact.length > 0 && !validatePhilippinePhone(editContact).isValid && (
                <Text style={{ color: "#D32F2F", fontSize: 12, marginTop: -6, marginBottom: 8 }}>
                  {validatePhilippinePhone(editContact).error}
                </Text>
              )}

              <Text style={styles.inputLabel}>Address</Text>
              <TextInput
                style={styles.modalInput}
                value={editAddress}
                onChangeText={setEditAddress}
                placeholder="Enter address"
                placeholderTextColor="#999"
              />
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalActionButton, savingProfile && { opacity: 0.6 }]}
              onPress={handleSaveProfile}
              disabled={savingProfile}
            >
              {savingProfile ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.modalActionText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ==================================================== */}
      {/* 4. SECURITY MODAL */}
      {/* ==================================================== */}
      <Modal visible={securityModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Security</Text>
              <TouchableOpacity onPress={() => setSecurityModalVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              <Text style={styles.modalSectionHeader}>Change Password</Text>

              <Text style={styles.inputLabel}>Current Password</Text>
              <TextInput
                style={styles.modalInput}
                secureTextEntry
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Enter current password"
                placeholderTextColor="#999"
              />

              <Text style={styles.inputLabel}>New Password</Text>
              <TextInput
                style={styles.modalInput}
                secureTextEntry
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Minimum 8 characters"
                placeholderTextColor="#999"
              />

              <Text style={styles.inputLabel}>Confirm New Password</Text>
              <TextInput
                style={styles.modalInput}
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Re-enter new password"
                placeholderTextColor="#999"
              />

              <TouchableOpacity
                style={[styles.modalActionButton, changingPass && { opacity: 0.6 }]}
                onPress={handleChangePassword}
                disabled={changingPass}
              >
                {changingPass ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalActionText}>Update Password</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ==================================================== */}
      {/* 5. NOTIFICATIONS MODAL */}
      {/* ==================================================== */}
      <Modal visible={notifModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Notification Settings</Text>
              <TouchableOpacity onPress={() => setNotifModalVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.toggleRow}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.toggleTitle}>Collection Arrival Alerts</Text>
                <Text style={styles.toggleSub}>Get notified when the garbage truck is approaching</Text>
              </View>
              <Switch
                value={collectionAlerts}
                onValueChange={setCollectionAlerts}
                trackColor={{ false: "#ccc", true: "#7ED957" }}
                thumbColor={collectionAlerts ? "#4CAF50" : "#f4f3f4"}
              />
            </View>

            <View style={styles.toggleRow}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.toggleTitle}>Push Notifications</Text>
                <Text style={styles.toggleSub}>Receive immediate reminders and announcements</Text>
              </View>
              <Switch
                value={pushNotifs}
                onValueChange={setPushNotifs}
                trackColor={{ false: "#ccc", true: "#7ED957" }}
                thumbColor={pushNotifs ? "#4CAF50" : "#f4f3f4"}
              />
            </View>

            <View style={styles.toggleRow}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={styles.toggleTitle}>Inspection & Sanitation Alerts</Text>
                <Text style={styles.toggleSub}>Receive alerts on scheduled audits and ratings</Text>
              </View>
              <Switch
                value={inspectionAlerts}
                onValueChange={setInspectionAlerts}
                trackColor={{ false: "#ccc", true: "#7ED957" }}
                thumbColor={inspectionAlerts ? "#4CAF50" : "#f4f3f4"}
              />
            </View>

            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setNotifModalVisible(false)}>
              <Text style={styles.modalCloseText}>Save Preferences</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ==================================================== */}
      {/* 6. ACTIVITY HISTORY MODAL */}
      {/* ==================================================== */}
      <Modal visible={activityModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Activity History</Text>
              <TouchableOpacity onPress={() => setActivityModalVisible(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              <View style={styles.activityCard}>
                <Ionicons name="trash-outline" size={22} color="#4CAF50" />
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <Text style={styles.activityTitle}>Waste Collected on Schedule</Text>
                  <Text style={styles.activitySub}>Driver completed collection at Barangay 123</Text>
                  <Text style={styles.activityDate}>Today, 08:30 AM</Text>
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setActivityModalVisible(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* BOTTOM NAVIGATION */}
      {role === "vendor" ? (
        <VendorHotbar activeTab="profile" />
      ) : (
        <ResidentHotbar activeTab="profile" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  header: {
    backgroundColor: "#FFFFFF",
    paddingTop: 50,
    paddingHorizontal: 18,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F4EF",
  },

  headerTitle: {
    color: "#1E331B",
    fontSize: 20,
    fontWeight: "800",
  },

  scrollContent: {
    paddingBottom: 110,
    flexGrow: 1,
  },

  profileCard: {
    backgroundColor: "#F7FAF6",
    margin: 16,
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5EFE2",
    elevation: 2,
    shadowColor: "#1A3816",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },

  avatarContainer: {
    position: "relative",
    marginBottom: 10,
  },

  avatarPhoto: {
    width: 86,
    height: 86,
    borderRadius: 43,
  },

  cameraBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#2E7D32",
    borderRadius: 14,
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },

  nameText: {
    fontSize: isSmall ? 20 : 24,
    fontWeight: "800",
    color: "#2E382D",
  },

  emailText: {
    fontSize: isSmall ? 13 : 15,
    color: "#666",
    marginTop: 2,
  },

  badgeRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },

  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E8F5E9",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },

  roleBadgeText: {
    color: "#2E7D32",
    fontSize: 13,
    fontWeight: "800",
  },

  idBadge: {
    backgroundColor: "#F0F4EF",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },

  idBadgeText: {
    color: "#555",
    fontSize: 13,
    fontWeight: "700",
  },

  statsContainer: {
    flexDirection: "row",
    width: "100%",
    justifyContent: "space-around",
    alignItems: "center",
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#EEF4EC",
  },

  statItem: {
    alignItems: "center",
    flex: 1,
  },

  statNumber: {
    fontSize: isSmall ? 22 : 26,
    fontWeight: "900",
    color: "#333",
  },

  statLabel: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
    fontWeight: "600",
  },

  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: "#E0E8DC",
  },

  menuCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    borderRadius: 20,
    paddingVertical: 8,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },

  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#F4F7F2",
  },

  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },

  menuTextBox: {
    flex: 1,
  },

  menuTitle: {
    fontSize: isSmall ? 16 : 18,
    fontWeight: "800",
    color: "#2E382D",
  },

  menuSub: {
    fontSize: isSmall ? 12 : 13,
    color: "#777",
    marginTop: 2,
  },

  bottomLogoutButton: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: "#FFEBEE",
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FFCDD2",
  },

  bottomLogoutText: {
    color: "#D32F2F",
    fontSize: 16,
    fontWeight: "800",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },

  modalContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    maxHeight: "85%",
  },

  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2E382D",
  },

  modalSectionHeader: {
    fontSize: 14,
    fontWeight: "700",
    color: "#4CAF50",
    marginTop: 14,
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  infoRow: {
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: "#F4F7F2",
  },

  infoLabel: {
    fontSize: 12,
    color: "#777",
    fontWeight: "500",
  },

  infoValue: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
    marginTop: 3,
  },

  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#555",
    marginTop: 12,
    marginBottom: 6,
  },

  modalInput: {
    backgroundColor: "#EDF6E8",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#333",
  },

  modalActionButton: {
    backgroundColor: "#4CAF50",
    borderRadius: 25,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 20,
    marginBottom: 10,
  },

  modalActionText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },

  modalCloseButton: {
    backgroundColor: "#EDF6E8",
    borderRadius: 25,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 18,
  },

  modalCloseText: {
    color: "#4CAF50",
    fontSize: 15,
    fontWeight: "700",
  },

  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F4F7F2",
  },

  toggleTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#333",
  },

  toggleSub: {
    fontSize: 12,
    color: "#777",
    marginTop: 2,
  },

  activityCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#F9FAF8",
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#EAEFE8",
  },

  activityTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#333",
  },

  activitySub: {
    fontSize: 12,
    color: "#666",
    marginTop: 3,
  },

  activityDate: {
    fontSize: 11,
    color: "#4CAF50",
    fontWeight: "600",
    marginTop: 4,
  },

  bottomNav: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 65,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#EEF5ED",
    paddingBottom: 4,
  },

  navItem: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    paddingVertical: 4,
  },

  navItemText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#7A8D78",
    marginTop: 2,
  },

  navItemTextActive: {
    color: "#2E7D32",
    fontWeight: "800",
  },
});
