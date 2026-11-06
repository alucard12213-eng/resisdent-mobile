import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

let NativeWebView: any = null;
if (Platform.OS !== "web") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    NativeWebView = require("react-native-webview").WebView;
  } catch {
    NativeWebView = null;
  }
}

const DRIVER_MAP_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html, body, #map { width: 100%; height: 100%; margin: 0; padding: 0; font-family: sans-serif; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const map = L.map('map').setView([8.4735, 124.6488], 15);
    L.tileLayer('https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=get_your_own_OpIi9ZULNHzrESv6T2vL', {
      maxZoom: 20
    }).on('tileerror', function() {
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 20 }).addTo(map);
    }).addTo(map);

    const routeCoords = [
      [8.4752, 124.6512],
      [8.4744, 124.6500],
      [8.4735, 124.6488],
      [8.4728, 124.6476],
      [8.4720, 124.6464],
      [8.4712, 124.6452],
      [8.4705, 124.6442],
      [8.4698, 124.6432],
      [8.4692, 124.6422],
      [8.4685, 124.6414]
    ];
    L.polyline(routeCoords, { color: '#16a34a', weight: 5 }).addTo(map);
    L.marker([8.4698, 124.6432]).addTo(map).bindPopup('<b>Truck KAL-104</b><br/>Barangay 38 • In Progress').openPopup();
  </script>
</body>
</html>`;

export default function DriverMap() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Live Route Map</Text>
      </View>

      {/* INTERACTIVE LIVE MAP AREA */}
      <View style={styles.map}>
        {Platform.OS === "web" ? (
          <iframe
            srcDoc={DRIVER_MAP_HTML}
            title="Driver Live Route Map"
            style={{ width: "100%", height: "100%", border: "none" }}
          />
        ) : NativeWebView ? (
          <NativeWebView
            originWhitelist={["*"]}
            source={{ html: DRIVER_MAP_HTML }}
            style={{ flex: 1, width: "100%" }}
          />
        ) : (
          <>
            <MaterialCommunityIcons
              name="map-marker"
              size={55}
              color="#F44336"
            />
            <Text style={styles.location}>Current Route: Barangay 38–40</Text>
          </>
        )}
      </View>

      {/* LOCATIONS */}
      <View style={styles.locations}>
        <View style={styles.locationRow}>
          <MaterialCommunityIcons
            name="map-marker"
            size={25}
            color="#4CAF50"
          />
          <Text style={styles.barangay}>Barangay 38</Text>
          <Text style={styles.progress}>In Progress</Text>
        </View>

        <View style={styles.locationRow}>
          <MaterialCommunityIcons
            name="map-marker"
            size={25}
            color="#4CAF50"
          />
          <Text style={styles.barangay}>Barangay 39</Text>
          <Text style={styles.completed}>Completed</Text>
        </View>

        <View style={styles.locationRow}>
          <MaterialCommunityIcons
            name="map-marker"
            size={25}
            color="#4CAF50"
          />
          <Text style={styles.barangay}>Barangay 40</Text>
          <Text style={styles.pending}>Pending</Text>
        </View>
      </View>

      <View style={styles.bottomNav}>
        <Text style={styles.navText}>Home</Text>
        <Text style={styles.navText}>Collection</Text>
        <Text style={styles.navText}>Map</Text>
        <Text style={styles.navText}>Profile</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#EDF6E8",
  },
  header: {
    backgroundColor: "#7ED957",
    paddingTop: 55,
    paddingHorizontal: 18,
    paddingBottom: 15,
    flexDirection: "row",
    alignItems: "center",
  },
  title: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    marginLeft: 15,
  },
  map: {
    height: "55%",
    backgroundColor: "#DCE8D8",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  location: {
    color: "#777",
    marginTop: 5,
  },
  locations: {
    backgroundColor: "#fff",
    margin: 12,
    borderRadius: 15,
    padding: 10,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  barangay: {
    flex: 1,
    marginLeft: 8,
    fontSize: 12,
    fontWeight: "600",
  },
  progress: {
    color: "#D6A900",
    fontSize: 9,
  },
  completed: {
    color: "#4CAF50",
    fontSize: 9,
  },
  pending: {
    color: "#D9534F",
    fontSize: 9,
  },
  bottomNav: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: "#7ED957",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  navText: {
    color: "#fff",
    fontSize: 9,
  },
});
