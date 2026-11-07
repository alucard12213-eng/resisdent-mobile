import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { usePathname, useRouter } from "expo-router";

export type ResidentTabKey = "home" | "schedule" | "reports" | "profile";

interface ResidentHotbarProps {
  activeTab?: ResidentTabKey;
}

export default function ResidentHotbar({ activeTab }: ResidentHotbarProps) {
  const router = useRouter();
  const pathname = usePathname() || "";

  let currentTab: ResidentTabKey = "home";
  if (activeTab) {
    currentTab = activeTab;
  } else if (pathname.includes("/report")) {
    currentTab = "reports";
  } else if (pathname.includes("/schedule")) {
    currentTab = "schedule";
  } else if (pathname.includes("/profile")) {
    currentTab = "profile";
  } else {
    currentTab = "home";
  }

  const navigateTo = (tab: ResidentTabKey, route: string) => {
    if (currentTab === tab) {
      return;
    }
    if (tab === "home") {
      router.replace("/dashboard" as any);
    } else {
      router.push(route as any);
    }
  };

  return (
    <View style={styles.bottomNav}>
      {/* 1. HOME */}
      <TouchableOpacity
        style={styles.navItem}
        activeOpacity={0.8}
        onPress={() => navigateTo("home", "/dashboard")}
        accessibilityRole="button"
        accessibilityLabel="Navigate to Resident Home"
      >
        <MaterialCommunityIcons
          name={currentTab === "home" ? "home" : "home-outline"}
          size={23}
          color={currentTab === "home" ? "#2E7D32" : "#7A8D78"}
        />
        <Text
          style={[
            styles.navItemText,
            currentTab === "home" && styles.navItemTextActive,
          ]}
          numberOfLines={1}
        >
          Home
        </Text>
      </TouchableOpacity>

      {/* 2. SCHEDULE */}
      <TouchableOpacity
        style={styles.navItem}
        activeOpacity={0.8}
        onPress={() => navigateTo("schedule", "/schedule")}
        accessibilityRole="button"
        accessibilityLabel="Navigate to Collection Schedule"
      >
        <MaterialCommunityIcons
          name={currentTab === "schedule" ? "calendar-month" : "calendar-month-outline"}
          size={23}
          color={currentTab === "schedule" ? "#2E7D32" : "#7A8D78"}
        />
        <Text
          style={[
            styles.navItemText,
            currentTab === "schedule" && styles.navItemTextActive,
          ]}
          numberOfLines={1}
        >
          Schedule
        </Text>
      </TouchableOpacity>

      {/* 3. REPORTS */}
      <TouchableOpacity
        style={styles.navItem}
        activeOpacity={0.8}
        onPress={() => navigateTo("reports", "/report")}
        accessibilityRole="button"
        accessibilityLabel="Navigate to Community Reports"
      >
        <MaterialCommunityIcons
          name={currentTab === "reports" ? "file-document" : "file-document-outline"}
          size={23}
          color={currentTab === "reports" ? "#2E7D32" : "#7A8D78"}
        />
        <Text
          style={[
            styles.navItemText,
            currentTab === "reports" && styles.navItemTextActive,
          ]}
          numberOfLines={1}
        >
          Reports
        </Text>
      </TouchableOpacity>

      {/* 4. PROFILE */}
      <TouchableOpacity
        style={styles.navItem}
        activeOpacity={0.8}
        onPress={() => navigateTo("profile", "/profile")}
        accessibilityRole="button"
        accessibilityLabel="Navigate to Resident Profile"
      >
        <MaterialCommunityIcons
          name={currentTab === "profile" ? "account" : "account-outline"}
          size={23}
          color={currentTab === "profile" ? "#2E7D32" : "#7A8D78"}
        />
        <Text
          style={[
            styles.navItemText,
            currentTab === "profile" && styles.navItemTextActive,
          ]}
          numberOfLines={1}
        >
          Profile
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNav: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 64,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#EEF5ED",
    paddingBottom: 4,
    zIndex: 99,
  },
  navItem: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    paddingVertical: 4,
  },
  navItemText: {
    fontSize: 10.5,
    fontWeight: "600",
    color: "#7A8D78",
    marginTop: 2,
  },
  navItemTextActive: {
    color: "#2E7D32",
    fontWeight: "800",
  },
});

