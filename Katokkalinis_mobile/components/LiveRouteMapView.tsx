import React, { useEffect, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  addLocationListener,
  getLastRecordedLocation,
  isAutomaticRecordingActive,
  LiveLocationState,
} from "../services/locationService";

let NativeWebView: any = null;
if (Platform.OS !== "web") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    NativeWebView = require("react-native-webview").WebView;
  } catch {
    NativeWebView = null;
  }
}

export interface LiveRouteMapViewProps {
  height?: number;
  selectedRouteId?: number | "all";
  compact?: boolean;
  focusTruckPlate?: string;
  onExpandPress?: () => void;
}

const DEFAULT_MAPTILER_KEY = "get_your_own_OpIi9ZULNHzrESv6T2vL";

function buildLeafletHtml(initialLat: number, initialLng: number, initialRoute: number | "all", compact: boolean): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body, #map { width: 100%; height: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #e8f0e8; overflow: hidden; }
    .truck-pulse-marker {
      position: relative;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .truck-pulse-ring {
      position: absolute;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: rgba(22, 163, 74, 0.35);
      animation: pulseRing 1.8s infinite ease-out;
    }
    @keyframes pulseRing {
      0% { transform: scale(0.75); opacity: 0.95; }
      75% { transform: scale(2.1); opacity: 0; }
      100% { transform: scale(2.1); opacity: 0; }
    }
    .truck-core {
      position: relative;
      z-index: 2;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #15803d;
      border: 2.5px solid #ffffff;
      box-shadow: 0 2px 8px rgba(0,0,0,0.35);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 13px;
    }
    .truck-label-tag {
      position: absolute;
      top: -20px;
      white-space: nowrap;
      background: #0f172a;
      color: #ffffff;
      font-size: 9.5px;
      font-weight: 800;
      padding: 2px 6px;
      border-radius: 5px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.28);
      border: 1px solid rgba(255,255,255,0.25);
      z-index: 3;
    }
    .hud-overlay {
      position: absolute;
      top: 8px;
      left: 8px;
      z-index: 900;
      background: rgba(15, 23, 42, 0.86);
      backdrop-filter: blur(6px);
      color: #fff;
      padding: 6px 10px;
      border-radius: 8px;
      font-size: 10.5px;
      border: 1px solid rgba(134, 239, 172, 0.35);
      pointer-events: none;
      max-width: 72%;
    }
    .hud-title {
      font-weight: 800;
      color: #86efac;
      display: flex;
      align-items: center;
      gap: 5px;
      margin-bottom: 2px;
    }
    .hud-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #22c55e;
      display: inline-block;
      box-shadow: 0 0 6px #22c55e;
    }
    .hud-coords {
      font-family: monospace;
      font-size: 10px;
      color: #e2e8f0;
    }
    .layer-pill-bar {
      position: absolute;
      bottom: 8px;
      left: 8px;
      z-index: 900;
      display: ${compact ? "none" : "flex"};
      gap: 4px;
      background: rgba(255,255,255,0.92);
      padding: 3px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.18);
      border: 1px solid #cbd5e1;
    }
    .layer-btn {
      border: none;
      background: transparent;
      font-size: 10px;
      font-weight: 700;
      color: #334155;
      padding: 4px 7px;
      border-radius: 5px;
      cursor: pointer;
    }
    .layer-btn.active {
      background: #15803d;
      color: #ffffff;
    }
    .locate-fab {
      position: absolute;
      bottom: 8px;
      right: 8px;
      z-index: 900;
      background: #15803d;
      color: #fff;
      border: 1.5px solid #fff;
      border-radius: 8px;
      padding: 5px 9px;
      font-size: 10.5px;
      font-weight: 800;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.25);
    }
  </style>
</head>
<body>
  <div id="map"></div>

  <div class="hud-overlay">
    <div class="hud-title">
      <span class="hud-dot"></span>
      <span id="hud-status">KAL-104 • LIVE GPS ROUTE #04</span>
    </div>
    <div class="hud-coords" id="hud-coords">${initialLat.toFixed(5)}, ${initialLng.toFixed(5)} • 18.5 km/h</div>
  </div>

  <div class="layer-pill-bar">
    <button class="layer-btn active" id="btn-streets" onclick="setLayer('streets')">Streets</button>
    <button class="layer-btn" id="btn-sat" onclick="setLayer('satellite')">Satellite</button>
    <button class="layer-btn" id="btn-osm" onclick="setLayer('osm')">OSM</button>
  </div>

  <button class="locate-fab" onclick="centerOnDriverTruck()">🎯 Locate KAL-104</button>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const ROUTES = [
      {
        id: 1,
        name: "Route 1: North Poblacion",
        truck: "KAL-101",
        color: "#16a34a",
        defaultPos: [8.4822, 124.6472],
        waypoints: [
          { name: "Barangay 1", lat: 8.4762, lng: 124.6418 },
          { name: "Barangay 2", lat: 8.4775, lng: 124.6429 },
          { name: "Barangay 3", lat: 8.4788, lng: 124.6435 },
          { name: "Barangay 4", lat: 8.4801, lng: 124.6442 },
          { name: "Barangay 5", lat: 8.4814, lng: 124.6451 },
          { name: "Barangay 6", lat: 8.4822, lng: 124.6472 },
          { name: "Barangay 7", lat: 8.4835, lng: 124.6480 },
          { name: "Barangay 8", lat: 8.4841, lng: 124.6492 },
          { name: "Barangay 9", lat: 8.4850, lng: 124.6501 },
          { name: "Barangay 10", lat: 8.4860, lng: 124.6512 }
        ]
      },
      {
        id: 2,
        name: "Route 2: Central Poblacion",
        truck: "KAL-102",
        color: "#2563eb",
        defaultPos: [8.4785, 124.6458],
        waypoints: [
          { name: "Barangay 11", lat: 8.4795, lng: 124.6440 },
          { name: "Barangay 12", lat: 8.4789, lng: 124.6452 },
          { name: "Barangay 13", lat: 8.4782, lng: 124.6461 },
          { name: "Barangay 14", lat: 8.4774, lng: 124.6470 },
          { name: "Barangay 15", lat: 8.4768, lng: 124.6479 },
          { name: "Barangay 16", lat: 8.4761, lng: 124.6488 },
          { name: "Barangay 17", lat: 8.4755, lng: 124.6497 },
          { name: "Barangay 18", lat: 8.4749, lng: 124.6508 },
          { name: "Barangay 19", lat: 8.4742, lng: 124.6518 },
          { name: "Barangay 20", lat: 8.4736, lng: 124.6528 }
        ]
      },
      {
        id: 3,
        name: "Route 3: East Poblacion",
        truck: "KAL-103",
        color: "#d97706",
        defaultPos: [8.4810, 124.6550],
        waypoints: [
          { name: "Barangay 21", lat: 8.4848, lng: 124.6525 },
          { name: "Barangay 22", lat: 8.4840, lng: 124.6538 },
          { name: "Barangay 23", lat: 8.4832, lng: 124.6549 },
          { name: "Barangay 24", lat: 8.4820, lng: 124.6562 },
          { name: "Barangay 25", lat: 8.4808, lng: 124.6570 },
          { name: "Barangay 26", lat: 8.4795, lng: 124.6565 },
          { name: "Barangay 27", lat: 8.4784, lng: 124.6555 },
          { name: "Barangay 28", lat: 8.4772, lng: 124.6545 },
          { name: "Barangay 29", lat: 8.4765, lng: 124.6535 },
          { name: "Barangay 30", lat: 8.4758, lng: 124.6525 }
        ]
      },
      {
        id: 4,
        name: "Route 4: South Poblacion",
        truck: "KAL-104",
        color: "#9333ea",
        defaultPos: [${initialLat}, ${initialLng}],
        waypoints: [
          { name: "Barangay 31 (Cogon Hub)", lat: 8.4752, lng: 124.6512 },
          { name: "Barangay 32 (JR Borja)", lat: 8.4744, lng: 124.6500 },
          { name: "Barangay 33 (Cogon South)", lat: 8.4735, lng: 124.6488 },
          { name: "Barangay 34 (Hayes Corridor)", lat: 8.4728, lng: 124.6476 },
          { name: "Barangay 35 (Velez South)", lat: 8.4720, lng: 124.6464 },
          { name: "Barangay 36 (Pabayo South)", lat: 8.4712, lng: 124.6452 },
          { name: "Barangay 37 (Tiano South)", lat: 8.4705, lng: 124.6442 },
          { name: "Barangay 38 (Capistrano)", lat: 8.4698, lng: 124.6432 },
          { name: "Barangay 39 (Burgos South)", lat: 8.4692, lng: 124.6422 },
          { name: "Barangay 40 (Gaston Park / City Hall)", lat: 8.4685, lng: 124.6414 }
        ]
      }
    ];

    const map = L.map('map', {
      center: [${initialLat}, ${initialLng}],
      zoom: ${compact ? 15 : 14},
      zoomControl: ${!compact},
      attributionControl: false
    });

    let currentTileLayer = null;
    function setLayer(mode) {
      if (currentTileLayer) map.removeLayer(currentTileLayer);
      document.querySelectorAll('.layer-btn').forEach(b => b.classList.remove('active'));
      if (mode === 'satellite') {
        const b = document.getElementById('btn-sat');
        if (b) b.classList.add('active');
        currentTileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 });
      } else if (mode === 'osm') {
        const b = document.getElementById('btn-osm');
        if (b) b.classList.add('active');
        currentTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 });
      } else {
        const b = document.getElementById('btn-streets');
        if (b) b.classList.add('active');
        currentTileLayer = L.tileLayer('https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${DEFAULT_MAPTILER_KEY}', { maxZoom: 20 });
        currentTileLayer.on('tileerror', function() {
          if (mode === 'streets') {
            map.removeLayer(currentTileLayer);
            currentTileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 20 }).addTo(map);
          }
        });
      }
      currentTileLayer.addTo(map);
    }
    setLayer('streets');

    const routeLayers = {};
    const fleetMarkers = {};
    let driverTrailCoords = [[${initialLat}, ${initialLng}]];
    let driverBreadcrumbLine = null;

    function createTruckIcon(plate, color, isPrimary) {
      return L.divIcon({
        className: '',
        html: '<div class="truck-pulse-marker">' +
          '<div class="truck-label-tag" style="background:' + (isPrimary ? '#15803d' : '#1e293b') + ';">' + plate + '</div>' +
          '<div class="truck-pulse-ring" style="background:' + (isPrimary ? 'rgba(22,163,74,0.42)' : 'rgba(37,99,235,0.28)') + ';"></div>' +
          '<div class="truck-core" style="background:' + color + ';">🚛</div>' +
        '</div>',
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });
    }

    ROUTES.forEach(r => {
      const group = L.layerGroup();
      const latlngs = r.waypoints.map(w => [w.lat, w.lng]);
      L.polyline(latlngs, {
        color: r.color,
        weight: r.id === 4 ? 5 : 3.5,
        opacity: r.id === 4 ? 0.9 : 0.65,
        dashArray: r.id === 4 ? null : '6, 6'
      }).addTo(group);

      r.waypoints.forEach((w, idx) => {
        L.circleMarker([w.lat, w.lng], {
          radius: r.id === 4 ? 5.5 : 4,
          fillColor: '#ffffff',
          color: r.color,
          weight: 2.5,
          fillOpacity: 1
        }).bindPopup('<b>' + w.name + '</b><br/>' + r.name + ' (' + r.truck + ') • Stop #' + (idx + 1)).addTo(group);
      });

      routeLayers[r.id] = group;
      if ('${initialRoute}' === 'all' || Number('${initialRoute}') === r.id) {
        group.addTo(map);
      }

      const isDriverTruck = r.truck === 'KAL-104';
      const marker = L.marker(r.defaultPos, {
        icon: createTruckIcon(r.truck, isDriverTruck ? '#15803d' : r.color, isDriverTruck),
        zIndexOffset: isDriverTruck ? 1000 : 200
      }).bindPopup('<b>Truck ' + r.truck + '</b><br/>' + r.name + '<br/>Status: Active On Route');

      if ('${initialRoute}' === 'all' || Number('${initialRoute}') === r.id || isDriverTruck) {
        marker.addTo(map);
      }
      fleetMarkers[r.truck] = marker;
    });

    driverBreadcrumbLine = L.polyline(driverTrailCoords, {
      color: '#16a34a',
      weight: 4,
      opacity: 0.9
    }).addTo(map);

    window.filterRouteOnMap = function(routeFilter) {
      Object.keys(routeLayers).forEach(idStr => {
        const id = Number(idStr);
        if (routeFilter === 'all' || Number(routeFilter) === id) {
          if (!map.hasLayer(routeLayers[id])) map.addLayer(routeLayers[id]);
        } else {
          if (map.hasLayer(routeLayers[id])) map.removeLayer(routeLayers[id]);
        }
      });
      if (routeFilter !== 'all') {
        const target = ROUTES.find(r => r.id === Number(routeFilter));
        if (target && target.waypoints.length) {
          map.fitBounds(target.waypoints.map(w => [w.lat, w.lng]), { padding: [28, 28] });
        }
      } else {
        map.setView([8.4775, 124.6485], 14);
      }
    };

    window.updateLiveTruck = function(payload) {
      if (!payload || !payload.latitude || !payload.longitude) return;
      const lat = Number(payload.latitude);
      const lng = Number(payload.longitude);
      const speed = payload.speed || 18.5;
      const sector = payload.sectorName || 'Route #04 South Poblacion';
      const marker = fleetMarkers['KAL-104'];
      if (marker) {
        marker.setLatLng([lat, lng]);
        marker.setPopupContent('<b>Truck KAL-104 (Your Unit)</b><br/>Sector: ' + sector + '<br/>Speed: ' + speed + ' km/h<br/>GPS: ' + lat.toFixed(5) + ', ' + lng.toFixed(5));
      }
      driverTrailCoords.push([lat, lng]);
      if (driverTrailCoords.length > 40) driverTrailCoords.shift();
      if (driverBreadcrumbLine) driverBreadcrumbLine.setLatLngs(driverTrailCoords);

      const coordsEl = document.getElementById('hud-coords');
      if (coordsEl) {
        coordsEl.textContent = lat.toFixed(5) + ', ' + lng.toFixed(5) + ' • ' + speed + ' km/h';
      }
      const statusEl = document.getElementById('hud-status');
      if (statusEl) {
        statusEl.textContent = 'KAL-104 • ' + sector.toUpperCase();
      }
    };

    window.centerOnDriverTruck = function() {
      const marker = fleetMarkers['KAL-104'];
      if (marker) {
        map.flyTo(marker.getLatLng(), 16, { duration: 0.6 });
        marker.openPopup();
      }
    };

    function handleIncomingMessage(event) {
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (!data) return;
        if (data.type === 'UPDATE_TRUCK') {
          window.updateLiveTruck(data);
        } else if (data.type === 'FILTER_ROUTE') {
          window.filterRouteOnMap(data.routeId);
        } else if (data.type === 'CENTER_TRUCK') {
          window.centerOnDriverTruck();
        }
      } catch (e) {}
    }

    window.addEventListener('message', handleIncomingMessage);
    document.addEventListener('message', handleIncomingMessage);
  </script>
</body>
</html>`;
}

export default function LiveRouteMapView({
  height = 300,
  selectedRouteId = "all",
  compact = false,
  onExpandPress,
}: LiveRouteMapViewProps) {
  const iframeRef = useRef<any>(null);
  const webViewRef = useRef<any>(null);

  const initialLoc = getLastRecordedLocation();
  const [liveState, setLiveState] = useState<LiveLocationState | null>(initialLoc);

  const initialLat = initialLoc?.latitude || 8.4752;
  const initialLng = initialLoc?.longitude || 124.6512;

  const mapHtml = useMemo(
    () => buildLeafletHtml(initialLat, initialLng, selectedRouteId, compact),
    // Memoize once so the WebView/iframe never reloads on GPS tick
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [compact]
  );

  const sendToMap = (messageObj: Record<string, any>) => {
    const json = JSON.stringify(messageObj);
    if (Platform.OS === "web") {
      try {
        if (iframeRef.current && iframeRef.current.contentWindow) {
          iframeRef.current.contentWindow.postMessage(json, "*");
        }
      } catch {}
    } else if (webViewRef.current) {
      try {
        webViewRef.current.postMessage(json);
      } catch {}
    }
  };

  useEffect(() => {
    const unsubscribe = addLocationListener((state) => {
      setLiveState(state);
      sendToMap({
        type: "UPDATE_TRUCK",
        latitude: state.latitude,
        longitude: state.longitude,
        speed: state.speed,
        sectorName: state.currentSectorName,
      });
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    sendToMap({
      type: "FILTER_ROUTE",
      routeId: selectedRouteId,
    });
  }, [selectedRouteId]);

  const activeRecording = isAutomaticRecordingActive() || Boolean(liveState?.isRecording);

  return (
    <View style={[styles.wrapper, { height }]}>
      {Platform.OS === "web" ? (
        <iframe
          ref={iframeRef}
          srcDoc={mapHtml}
          title="KatokKalinis Live Route & Truck GPS Map"
          style={{
            width: "100%",
            height: "100%",
            border: "none",
            borderRadius: 12,
          }}
        />
      ) : NativeWebView ? (
        <NativeWebView
          ref={webViewRef}
          originWhitelist={["*"]}
          source={{ html: mapHtml }}
          style={styles.webview}
          javaScriptEnabled
          domStorageEnabled
          scrollEnabled={false}
        />
      ) : (
        <View style={styles.fallbackBox}>
          <MaterialCommunityIcons name="map-marker-radius" size={32} color="#2E7D32" />
          <Text style={styles.fallbackTitle}>Live GPS Route Map Active</Text>
          <Text style={styles.fallbackSub}>
            {liveState
              ? `${liveState.latitude.toFixed(5)}, ${liveState.longitude.toFixed(5)} • ${liveState.currentSectorName}`
              : "8.47520, 124.65120 • Route #04 South Poblacion"}
          </Text>
        </View>
      )}

      {/* Top-Right Status / Expand Pill */}
      <View style={styles.topRightBar}>
        <View
          style={[
            styles.syncBadge,
            activeRecording ? styles.syncBadgeActive : styles.syncBadgeStandby,
          ]}
        >
          <View
            style={[
              styles.syncDot,
              { backgroundColor: activeRecording ? "#22C55E" : "#F59E0B" },
            ]}
          />
          <Text style={styles.syncBadgeText}>
            {activeRecording ? "LIVE GPS SYNCED" : "GPS STANDBY"}
          </Text>
        </View>

        {onExpandPress && (
          <TouchableOpacity
            style={styles.expandBtn}
            onPress={onExpandPress}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="arrow-expand-all" size={14} color="#FFFFFF" />
            <Text style={styles.expandBtnText}>Full Map</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#E8F0E8",
    borderWidth: 1,
    borderColor: "#C5EBD2",
    position: "relative",
  },
  webview: {
    flex: 1,
    backgroundColor: "transparent",
  },
  topRightBar: {
    position: "absolute",
    top: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    zIndex: 20,
  },
  syncBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    gap: 5,
    borderWidth: 1,
  },
  syncBadgeActive: {
    backgroundColor: "rgba(21, 128, 61, 0.92)",
    borderColor: "#86EFAC",
  },
  syncBadgeStandby: {
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    borderColor: "#FDE68A",
  },
  syncDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  syncBadgeText: {
    color: "#FFFFFF",
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  expandBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#0F172A",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  expandBtnText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  fallbackBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  fallbackTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1E331B",
    marginTop: 6,
  },
  fallbackSub: {
    fontSize: 11,
    color: "#4A6148",
    marginTop: 2,
  },
});

