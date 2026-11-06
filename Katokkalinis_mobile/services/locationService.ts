import AsyncStorage from "@react-native-async-storage/async-storage";
import { recordTruckLocation, TruckLocationPingPayload } from "./driver";

/**
 * Designated collection route waypoints for Route 4 (South Poblacion, CDO)
 * Used for automatic tracking simulation when GPS satellite fix is unavailable.
 */
const CDO_ROUTE_4_WAYPOINTS = [
  { lat: 8.4735, lng: 124.6545, name: "Barangay 31 - Cogon Market Central Bay" },
  { lat: 8.4728, lng: 124.6540, name: "Barangay 31 - Yacapin St Corridor" },
  { lat: 8.4720, lng: 124.6535, name: "Barangay 32 - San Agustin Cathedral" },
  { lat: 8.4715, lng: 124.6528, name: "Barangay 32 - Hayes St Corner" },
  { lat: 8.4710, lng: 124.6520, name: "Barangay 33 - Burgos St Riverfront" },
  { lat: 8.4705, lng: 124.6500, name: "Barangay 34 - City Hall & Gaston Park" },
  { lat: 8.4695, lng: 124.6485, name: "Barangay 35 - Carmen Bridge Approach" },
  { lat: 8.4715, lng: 124.6470, name: "Barangay 36 - Victoria St Riverside" },
  { lat: 8.4730, lng: 124.6455, name: "Barangay 37 - CDO Riverbank West" },
  { lat: 8.4745, lng: 124.6440, name: "Barangay 38 - Consolacion Perimeter" },
  { lat: 8.4760, lng: 124.6425, name: "Barangay 39 - Puntod Port Access" },
  { lat: 8.4780, lng: 124.6410, name: "Barangay 40 - Macabalan Coastal" },
];

export interface LiveLocationState {
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  timestamp: string;
  pingsCount: number;
  currentSectorName?: string;
  isSimulated?: boolean;
}

let trackingTimer: any = null;
let currentWaypointIndex = 0;
let recordedPingsTotal = 0;
let lastLocationState: LiveLocationState | null = null;
const listeners = new Set<(state: LiveLocationState) => void>();

/**
 * Register a listener for real-time location ping updates
 */
export function addLocationListener(callback: (state: LiveLocationState) => void): () => void {
  listeners.add(callback);
  if (lastLocationState) {
    callback(lastLocationState);
  }
  return () => {
    listeners.delete(callback);
  };
}

/**
 * Query current device GPS position or calculate next route progression
 */
async function getCurrentOrNextLocation(isFirstPing: boolean = false): Promise<{
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  sectorName: string;
  isSimulated: boolean;
}> {
  // Check if browser/device geolocation API is available
  if (typeof navigator !== "undefined" && navigator.geolocation && typeof navigator.geolocation.getCurrentPosition === "function") {
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 4000,
          maximumAge: 3000,
        });
      });

      if (pos?.coords) {
        return {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          speed: pos.coords.speed ? Math.round(pos.coords.speed * 3.6 * 10) / 10 : 20.5,
          heading: pos.coords.heading ?? 90,
          sectorName: "CDO Urban Core GPS",
          isSimulated: false,
        };
      }
    } catch {
      // Fallback to route waypoint sequence
    }
  }

  // Simulated progression along CDO Route 4 waypoints
  if (!isFirstPing) {
    currentWaypointIndex = (currentWaypointIndex + 1) % CDO_ROUTE_4_WAYPOINTS.length;
  }

  const wp = CDO_ROUTE_4_WAYPOINTS[currentWaypointIndex];
  // Add small micro-jitter for realistic movement between pings (within 5-10 meters)
  const jitterLat = (Math.random() - 0.5) * 0.0003;
  const jitterLng = (Math.random() - 0.5) * 0.0003;
  const simulatedSpeed = Math.round((16 + Math.random() * 9) * 10) / 10; // 16 - 25 km/h
  const nextWp = CDO_ROUTE_4_WAYPOINTS[(currentWaypointIndex + 1) % CDO_ROUTE_4_WAYPOINTS.length];
  const simulatedHeading = Math.round(
    ((Math.atan2(nextWp.lng - wp.lng, nextWp.lat - wp.lat) * 180) / Math.PI + 360) % 360
  );

  return {
    latitude: Math.round((wp.lat + jitterLat) * 1000000) / 1000000,
    longitude: Math.round((wp.lng + jitterLng) * 1000000) / 1000000,
    speed: simulatedSpeed,
    heading: simulatedHeading,
    sectorName: wp.name,
    isSimulated: true,
  };
}

/**
 * Automatically record a location ping and broadcast to server
 */
async function recordSinglePing(plateNumber: string, isFirstPing: boolean = false) {
  try {
    const loc = await getCurrentOrNextLocation(isFirstPing);
    recordedPingsTotal++;

    const payload: TruckLocationPingPayload = {
      plate_number: plateNumber,
      latitude: loc.latitude,
      longitude: loc.longitude,
      speed: loc.speed,
      heading: loc.heading,
      status: "on_route",
      notes: loc.sectorName,
    };

    // Send to central backend
    await recordTruckLocation(payload);

    lastLocationState = {
      latitude: loc.latitude,
      longitude: loc.longitude,
      speed: loc.speed,
      heading: loc.heading,
      timestamp: new Date().toLocaleTimeString(),
      pingsCount: recordedPingsTotal,
      currentSectorName: loc.sectorName,
      isSimulated: loc.isSimulated,
    };

    // Store in AsyncStorage for fast recovery
    await AsyncStorage.setItem("last_truck_location_ping", JSON.stringify(lastLocationState));
    await AsyncStorage.setItem("recorded_pings_total", String(recordedPingsTotal));

    // Notify UI listeners
    listeners.forEach((fn) => fn(lastLocationState!));
  } catch (err) {
    console.warn("Location ping broadcast warning:", err);
  }
}

/**
 * Start automatic periodic truck location recording when the truck starts its route.
 * Broadcasts GPS coordinates every 5 seconds to the Superadmin Dashboard live.
 */
export async function startAutomaticLocationRecording(options: {
  plateNumber?: string;
  intervalMs?: number;
  onPing?: (state: LiveLocationState) => void;
}): Promise<void> {
  const plate = options.plateNumber || "KAL-104";
  const interval = options.intervalMs || 5000;

  if (options.onPing) {
    addLocationListener(options.onPing);
  }

  // If already tracking, don't duplicate timers
  if (trackingTimer) {
    return;
  }

  // Record initial start ping immediately
  await recordSinglePing(plate, true);

  // Set interval to record continuously while route is active
  trackingTimer = setInterval(async () => {
    await recordSinglePing(plate, false);
  }, interval);
}

/**
 * Stop automatic location recording when truck route is completed or ended.
 */
export async function stopAutomaticLocationRecording(plateNumber: string = "KAL-104"): Promise<void> {
  if (trackingTimer) {
    clearInterval(trackingTimer);
    trackingTimer = null;
  }

  // Send final available status ping to server
  try {
    const loc = await getCurrentOrNextLocation(false);
    await recordTruckLocation({
      plate_number: plateNumber,
      latitude: loc.latitude,
      longitude: loc.longitude,
      speed: 0,
      heading: 0,
      status: "available",
      notes: "Depot return • Route completed",
    });
  } catch (e) {
    console.warn("Failed to record final route stop ping:", e);
  }

  await AsyncStorage.removeItem("last_truck_location_ping");
}

/**
 * Check if the truck is currently recording location
 */
export function isAutomaticRecordingActive(): boolean {
  return trackingTimer !== null;
}

/**
 * Get the most recent location state
 */
export function getLastRecordedLocation(): LiveLocationState | null {
  return lastLocationState;
}

/**
 * Total pings recorded during this session
 */
export function getTotalPingsCount(): number {
  return recordedPingsTotal;
}

