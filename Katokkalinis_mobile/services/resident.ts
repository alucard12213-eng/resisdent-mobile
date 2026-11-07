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

