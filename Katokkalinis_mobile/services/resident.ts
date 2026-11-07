import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiRequest } from "./api";

const OFFLINE_REPORTS_QUEUE_KEY = "@offline_reports_queue";

export interface ReportPayload {
  title: string;
  description: string;
  location: string;
  latitude?: number;
  longitude?: number;
  barangay_id: number;
  image_url?: string;
  queued_at?: string;
}

export async function getOfflineReportsQueue(): Promise<ReportPayload[]> {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_REPORTS_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function queueOfflineReport(data: ReportPayload): Promise<void> {
  try {
    const queue = await getOfflineReportsQueue();
    queue.push({
      ...data,
      queued_at: new Date().toISOString(),
    });
    await AsyncStorage.setItem(OFFLINE_REPORTS_QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.warn("Failed to queue report offline:", err);
  }
}

export async function flushOfflineReportsQueue(): Promise<{ sent: number; failed: number }> {
  try {
    const queue = await getOfflineReportsQueue();
    if (!queue || queue.length === 0) return { sent: 0, failed: 0 };

    const remaining: ReportPayload[] = [];
    let sentCount = 0;

    for (const report of queue) {
      try {
        const res = await apiRequest("/reports", {
          method: "POST",
          body: JSON.stringify(report),
        });
        if (res && res.success) {
          sentCount++;
        } else {
          remaining.push(report);
        }
      } catch {
        remaining.push(report);
      }
    }

    await AsyncStorage.setItem(OFFLINE_REPORTS_QUEUE_KEY, JSON.stringify(remaining));
    return { sent: sentCount, failed: remaining.length };
  } catch (e) {
    console.warn("Flush offline queue error:", e);
    return { sent: 0, failed: 0 };
  }
}

export async function fetchBarangays() {
  return apiRequest("/barangays", { method: "GET" });
}

export async function fetchSchedules(barangayId?: number | string, barangayName?: string) {
  let url = "/schedules";
  const params: string[] = [];
  if (barangayId) params.push(`barangay_id=${barangayId}`);
  if (barangayName) params.push(`barangay=${encodeURIComponent(barangayName)}`);
  if (params.length > 0) {
    url += `?${params.join("&")}`;
  }
  return apiRequest(url, { method: "GET" });
}

export async function fetchNextSchedule(barangayId?: number | string, barangayName?: string) {
  let url = "/schedules/next";
  const params: string[] = [];
  if (barangayId) params.push(`barangay_id=${barangayId}`);
  if (barangayName) params.push(`barangay=${encodeURIComponent(barangayName)}`);
  if (params.length > 0) {
    url += `?${params.join("&")}`;
  }
  return apiRequest(url, { method: "GET" });
}

export async function completeSchedule(scheduleId: number) {
  return apiRequest(`/schedules/${scheduleId}/complete`, { method: "POST" });
}

export async function fetchReports(params?: { status?: string; search?: string; myReports?: boolean }) {
  let url = "/reports";
  const queryParts: string[] = [];
  if (params?.status && params.status !== "all") {
    queryParts.push(`status=${encodeURIComponent(params.status)}`);
  }
  if (params?.search) {
    queryParts.push(`search=${encodeURIComponent(params.search)}`);
  }
  if (params?.myReports) {
    queryParts.push(`my_reports=1`);
  }
  if (queryParts.length > 0) {
    url += `?${queryParts.join("&")}`;
  }
  return apiRequest(url, { method: "GET" });
}

export async function fetchMyReportsCount(userId?: number | string): Promise<number> {
  try {
    const res = await apiRequest("/reports?my_reports=1", { method: "GET" });
    if (res && res.success && Array.isArray(res.reports)) {
      return res.reports.length;
    }
    if (res && Array.isArray(res.reports)) {
      if (userId) {
        return res.reports.filter((r: any) => String(r.user_id) === String(userId)).length;
      }
      return res.reports.length;
    }
    return 0;
  } catch (e) {
    console.warn("Could not fetch my reports count from API:", e);
    return 0;
  }
}

export async function submitReport(data: ReportPayload) {
  try {
    const res = await apiRequest("/reports", {
      method: "POST",
      body: JSON.stringify(data),
    });
    if (res && res.success) {
      // Auto-flush any previously queued reports now that connection is active
      flushOfflineReportsQueue().catch(() => {});
      return res;
    }
    // If not successful due to network/server issue, save to queue
    await queueOfflineReport(data);
    return {
      success: true,
      is_queued_offline: true,
      message: "Report saved locally and queued. It will automatically upload once network connection is stable.",
    };
  } catch (err) {
    await queueOfflineReport(data);
    return {
      success: true,
      is_queued_offline: true,
      message: "Network offline. Report saved locally and queued for automatic upload.",
    };
  }
}

export async function fetchFeedback() {
  return apiRequest("/feedback", { method: "GET" });
}

export async function submitFeedback(content: string) {
  return apiRequest("/feedback", {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export async function fetchNotifications() {
  return apiRequest("/notifications", { method: "GET" });
}

export async function markNotificationAsRead(id: number) {
  return apiRequest(`/notifications/${id}/read`, { method: "PUT" });
}

/*
|--------------------------------------------------------------------------
| COLLECTION ROUTES & LIVE TRUCK GPS TRACKING (Resident Schedule & Route View)
|--------------------------------------------------------------------------
*/
export interface RouteStopInput {
  stop_order?: number;
  name: string;
  duration_minutes?: number;
  travel_minutes?: number;
  arrival_time?: string;
  estimated_time?: string;
  crosses_midnight?: boolean;
}

export interface RouteTimelineStep {
  step: number;
  type: "start" | "stop" | "end";
  stop_order?: number;
  time: string;
  time_24: string;
  label: string;
  location: string;
  duration_minutes?: number;
  display_text: string;
  crosses_midnight: boolean;
}

export interface CollectionRoutePayload {
  route_name?: string;
  truck_id: number;
  assigned_personnel_id?: number | null;
  barangay_id: number;
  start_location: string;
  end_location: string;
  collection_stops: (RouteStopInput | string)[];
  distance_km?: number;
  stop_duration_minutes?: number;
  estimated_duration_minutes?: number;
  collection_date: string;
  start_time: string;
  status?: "scheduled" | "ongoing" | "completed" | "delayed";
  notes?: string;
}

export function parseTimeInputTo24(raw: string): string | null {
  if (!raw) return null;
  const str = String(raw).trim();
  const m12 = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (m12) {
    let h = parseInt(m12[1], 10);
    const min = parseInt(m12[2], 10);
    const mer = m12[3].toUpperCase();
    if (h < 1 || h > 12 || min < 0 || min > 59) return null;
    if (mer === "AM") {
      h = h === 12 ? 0 : h;
    } else {
      h = h === 12 ? 12 : h + 12;
    }
    return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  }

  const m24 = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (m24) {
    const h = parseInt(m24[1], 10);
    const min = parseInt(m24[2], 10);
    if (h < 0 || h > 23 || min < 0 || min > 59) return null;
    return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  }
  return null;
}

export function formatMinutesTo12h(totalMins: number, showNextDay = false): string {
  const wrapped = ((totalMins % 1440) + 1440) % 1440;
  const h24 = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 || 12;
  const base = `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
  if (showNextDay && totalMins >= 1440) {
    return `${base} (+1 day)`;
  }
  return base;
}

export function formatMinutesTo24h(totalMins: number): string {
  const wrapped = ((totalMins % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatDurationString(totalMinutes: number): string {
  const minsVal = Math.max(1, Math.round(totalMinutes));
  const hours = Math.floor(minsVal / 60);
  const mins = minsVal % 60;
  if (hours > 0 && mins > 0) {
    const hStr = hours === 1 ? "1 hour" : `${hours} hours`;
    const mStr = mins === 1 ? "1 minute" : `${mins} minutes`;
    return `${hStr} and ${mStr}`;
  }
  if (hours > 0) {
    return hours === 1 ? "1 hour" : `${hours} hours`;
  }
  return mins === 1 ? "1 minute" : `${mins} minutes`;
}

export function calculateRouteScheduleClient(params: {
  startLocation: string;
  endLocation: string;
  startTime: string;
  stops: (RouteStopInput | string)[];
  distanceKm?: number;
  defaultStopDurationMinutes?: number;
  explicitTotalMinutes?: number | null;
}) {
  const startLoc = (params.startLocation || "Barangay Hall").trim();
  const endLoc = (params.endLocation || "Sanitation Facility").trim();
  const clean24 = parseTimeInputTo24(params.startTime) || "09:00";
  const [startHour, startMin] = clean24.split(":").map((n) => parseInt(n, 10) || 0);
  const startTotalMins = startHour * 60 + startMin;

  const distanceKm = Math.max(0.5, Number(params.distanceKm) || 15);
  const defaultStopMins = Math.max(5, Number(params.defaultStopDurationMinutes) || 40);

  const normalizedStops = (Array.isArray(params.stops) ? params.stops : [])
    .map((s, idx) => {
      if (typeof s === "string") {
        return {
          stop_order: idx + 1,
          name: s.trim(),
          duration_minutes: defaultStopMins,
        };
      }
      return {
        stop_order: idx + 1,
        name: String(s?.name || "").trim(),
        duration_minutes:
          Number(s?.duration_minutes) > 0 ? Number(s.duration_minutes) : defaultStopMins,
      };
    })
    .filter((s) => s.name.length > 0);

  const stopCount = normalizedStops.length;
  const travelDriveMins = Math.max(10, Math.round(distanceKm * 4));
  const stopsTotalMins = normalizedStops.reduce((acc, s) => acc + s.duration_minutes, 0);

  const totalDurationMinutes =
    params.explicitTotalMinutes && params.explicitTotalMinutes > 0
      ? Math.round(params.explicitTotalMinutes)
      : Math.max(15, travelDriveMins + stopsTotalMins);

  const stopOffsets: number[] = [];
  if (stopCount === 1) {
    stopOffsets[0] = Math.round(totalDurationMinutes / 2);
  } else if (stopCount >= 2) {
    const firstLeg = Math.min(
      Math.round(totalDurationMinutes / (stopCount + 1)),
      Math.max(15, Math.round(travelDriveMins / 2))
    );
    const lastLeg = Math.max(
      15,
      Math.min(Math.round(totalDurationMinutes / (stopCount + 1)), travelDriveMins - firstLeg)
    );
    const middleSpan = Math.max(0, totalDurationMinutes - firstLeg - lastLeg);

    let interStopWeightTotal = 0;
    for (let i = 0; i < stopCount - 1; i++) {
      interStopWeightTotal += Math.max(1, normalizedStops[i].duration_minutes);
    }

    stopOffsets[0] = firstLeg;
    let runningWeight = 0;
    for (let i = 1; i < stopCount; i++) {
      runningWeight += Math.max(1, normalizedStops[i - 1].duration_minutes);
      const fraction =
        interStopWeightTotal > 0 ? runningWeight / interStopWeightTotal : i / (stopCount - 1);
      stopOffsets[i] = firstLeg + Math.round(middleSpan * fraction);
    }
  }

  const timeline: RouteTimelineStep[] = [
    {
      step: 0,
      type: "start",
      time: formatMinutesTo12h(startTotalMins, false),
      time_24: formatMinutesTo24h(startTotalMins),
      label: "Collection Starts",
      location: startLoc,
      display_text: `${formatMinutesTo12h(startTotalMins, false)} — Collection Starts (${startLoc})`,
      crosses_midnight: false,
    },
  ];

  let prevOffset = 0;
  const enrichedStops = normalizedStops.map((s, idx) => {
    const offsetMins = stopOffsets[idx] ?? (idx + 1) * 30;
    const absMins = startTotalMins + offsetMins;
    const crossesMidnight = absMins >= 1440;
    const time12 = formatMinutesTo12h(absMins, crossesMidnight);
    const time24 = formatMinutesTo24h(absMins);
    const legTravelMins = Math.max(5, offsetMins - prevOffset);
    prevOffset = offsetMins;

    timeline.push({
      step: idx + 1,
      type: "stop",
      stop_order: idx + 1,
      time: time12,
      time_24: time24,
      label: s.name,
      location: s.name,
      duration_minutes: s.duration_minutes,
      display_text: `${time12} — ${s.name}`,
      crosses_midnight: crossesMidnight,
    });

    return {
      stop_order: idx + 1,
      name: s.name,
      location_name: s.name,
      duration_minutes: s.duration_minutes,
      travel_minutes: legTravelMins,
      offset_minutes: offsetMins,
      estimated_time: time24,
      arrival_time: time12,
      crosses_midnight: crossesMidnight,
    };
  });

  const arrivalAbsMins = startTotalMins + totalDurationMinutes;
  const arrivalCrossesMidnight = arrivalAbsMins >= 1440;
  const arrival12 = formatMinutesTo12h(arrivalAbsMins, arrivalCrossesMidnight);
  const arrival24 = formatMinutesTo24h(arrivalAbsMins);

  timeline.push({
    step: stopCount + 1,
    type: "end",
    time: arrival12,
    time_24: arrival24,
    label: "Estimated Arrival at Destination",
    location: endLoc,
    display_text: `${arrival12} — Estimated Arrival at Destination (${endLoc})`,
    crosses_midnight: arrivalCrossesMidnight,
  });

  return {
    start_time_24: clean24,
    start_time_formatted: formatMinutesTo12h(startTotalMins, false),
    estimated_duration_minutes: totalDurationMinutes,
    estimated_duration: formatDurationString(totalDurationMinutes),
    estimated_arrival_24: arrival24,
    estimated_arrival_formatted: arrival12,
    crosses_midnight: arrivalCrossesMidnight,
    stops: enrichedStops,
    timeline,
  };
}

export async function fetchCollectionRouteOptions() {
  try {
    const res = await apiRequest("/collection-routes/options", { method: "GET" });
    if (res && res.success) return res;
  } catch {}

  try {
    return await apiRequest("/public/collection-routes/options", { method: "GET" });
  } catch (err: any) {
    return {
      success: false,
      vehicles: [],
      personnel: [],
      barangays: [],
      message: err?.message || "Unable to fetch route options.",
    };
  }
}

export async function fetchCollectionRoutes(params?: {
  barangayId?: number | string;
  barangayName?: string;
  status?: string;
}) {
  const queryParts: string[] = [];
  if (params?.barangayId) queryParts.push(`barangay_id=${encodeURIComponent(String(params.barangayId))}`);
  if (params?.barangayName) queryParts.push(`barangay=${encodeURIComponent(params.barangayName)}`);
  if (params?.status) queryParts.push(`status=${encodeURIComponent(params.status)}`);
  const qs = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";

  try {
    const res = await apiRequest(`/collection-routes${qs}`, { method: "GET" });
    if (res && res.success) return res;
  } catch {}

  try {
    return await apiRequest(`/public/collection-routes${qs}`, { method: "GET" });
  } catch (err: any) {
    return {
      success: false,
      routes: [],
      message: err?.message || "Unable to fetch collection routes.",
    };
  }
}

export async function createCollectionRoute(payload: CollectionRoutePayload) {
  try {
    const res = await apiRequest("/collection-routes", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (res && res.success) return res;
  } catch {}

  return apiRequest("/public/collection-routes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateCollectionRoute(
  routeId: number | string,
  payload: Partial<CollectionRoutePayload>
) {
  try {
    const res = await apiRequest(`/collection-routes/${routeId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    if (res && res.success) return res;
  } catch {}

  return apiRequest(`/public/collection-routes/${routeId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteCollectionRoute(routeId: number | string) {
  try {
    const res = await apiRequest(`/collection-routes/${routeId}`, {
      method: "DELETE",
    });
    if (res && res.success) return res;
  } catch {}

  return apiRequest(`/public/collection-routes/${routeId}`, {
    method: "DELETE",
  });
}

export async function fetchLiveTrucksTracking() {
  try {
    const res = await apiRequest("/public/trucks/live-tracking", { method: "GET" });
    if (res && res.success) return res;
  } catch {}

  try {
    return await apiRequest("/trucks/live-tracking", { method: "GET" });
  } catch (err: any) {
    return {
      success: false,
      trucks: [],
      routes: [],
      message: err?.message || "Unable to fetch live truck tracking.",
    };
  }
}

/*
|--------------------------------------------------------------------------
| RESIDENT PUBLIC VENDOR INFORMATION & QR SCANNER (Read-Only, Shared DB)
|--------------------------------------------------------------------------
*/
export interface PublicVendorInspectionSummary {
  has_inspection: boolean;
  grade: string;
  grade_label: string;
  total_score: number;
  waste_segregation_score: number;
  waste_segregation_rating: number;
  stall_cleanliness_score: number;
  stall_cleanliness_rating: number;
  pest_control_score: number;
  pest_control_rating: number;
  standing_summary: string;
  inspected_at: string | null;
  inspected_at_formatted: string;
  valid_through: string;
}

export interface PublicVendorViolationItem {
  id: number;
  violation_type: string;
  penalty: string;
  status: string;
  status_label: string;
  recorded_date: string;
}

export interface PublicVendorItem {
  id: number;
  vendor_code: string;
  qr_code: string;
  business_name: string;
  stall_number: string;
  market: string;
  barangay_name: string;
  status: string;
  sanitation_grade: string;
  grade_label: string;
  compliance_score: number;
  sanitation_score: number;
  public_inspection_summary: PublicVendorInspectionSummary;
  permitted_violations: {
    active_count: number;
    resolved_count: number;
    total_count: number;
    standing_text: string;
    items?: PublicVendorViolationItem[];
  };
}

export async function fetchPublicVendors(params?: {
  search?: string;
  market?: string;
  grade?: string;
}): Promise<{
  success: boolean;
  count?: number;
  vendors: PublicVendorItem[];
  message?: string;
}> {
  const queryParts: string[] = [];
  if (params?.search && params.search.trim()) {
    queryParts.push(`search=${encodeURIComponent(params.search.trim())}`);
  }
  if (params?.market && params.market !== "all") {
    queryParts.push(`market=${encodeURIComponent(params.market)}`);
  }
  if (params?.grade && params.grade !== "all") {
    queryParts.push(`grade=${encodeURIComponent(params.grade)}`);
  }
  const qs = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";

  try {
    const res = await apiRequest(`/resident/vendors${qs}`, { method: "GET" });
    if (res && res.success && Array.isArray(res.vendors)) {
      return res;
    }
  } catch {}

  try {
    const pubRes = await apiRequest(`/public/resident/vendors${qs}`, { method: "GET" });
    if (pubRes && pubRes.success && Array.isArray(pubRes.vendors)) {
      return pubRes;
    }
  } catch (err: any) {
    return {
      success: false,
      vendors: [],
      message: err?.message || "Unable to fetch public market vendors.",
    };
  }

  return {
    success: false,
    vendors: [],
    message: "Unable to fetch public market vendors.",
  };
}

export async function fetchPublicVendorDetail(idOrCode: string | number): Promise<{
  success: boolean;
  vendor?: PublicVendorItem;
  error_type?: string;
  message?: string;
}> {
  const encoded = encodeURIComponent(String(idOrCode).trim());
  try {
    const res = await apiRequest(`/resident/vendors/${encoded}`, { method: "GET" });
    if (res && res.success && res.vendor) {
      return res;
    }
    if (res && !res.success) return res;
  } catch {}

  try {
    const pubRes = await apiRequest(`/public/resident/vendors/${encoded}`, { method: "GET" });
    if (pubRes && pubRes.success && pubRes.vendor) {
      return pubRes;
    }
    return pubRes;
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || "Vendor not found.",
    };
  }
}

export async function scanPublicVendorQr(qrCode: string): Promise<{
  success: boolean;
  vendor?: PublicVendorItem;
  error_type?: string;
  message?: string;
}> {
  const payload = JSON.stringify({ qr_code: qrCode.trim() });
  try {
    const res = await apiRequest("/resident/vendors/scan-qr", {
      method: "POST",
      body: payload,
    });
    if (res) return res;
  } catch {}

  try {
    return await apiRequest("/public/resident/vendors/scan-qr", {
      method: "POST",
      body: payload,
    });
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || "Failed to verify vendor QR code.",
    };
  }
}

