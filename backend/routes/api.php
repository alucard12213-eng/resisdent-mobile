<?php

use Illuminate\Support\Facades\Route;

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\EmployeeController;
use App\Http\Controllers\Api\ContractorController;
use App\Http\Controllers\Api\ContractController;
use App\Http\Controllers\Api\ReportController;
use App\Http\Controllers\Api\VendorController;
use App\Http\Controllers\Api\AttendanceController;
use App\Http\Controllers\Api\ScheduleController;
use App\Http\Controllers\Api\BarangayController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\InspectionController;
use App\Http\Controllers\Api\TruckController;
use App\Http\Controllers\Api\TruckLocationController;
use App\Http\Controllers\Api\CollectionRouteController;
use App\Http\Controllers\Api\ActivityLogController;
use App\Http\Controllers\Api\AnalyticsController;
use App\Http\Controllers\Api\ClenroPileupReportController;
use App\Http\Controllers\Api\FeedbackController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\ViolationController;
use App\Http\Controllers\Api\CollectionLogController;
use App\Http\Controllers\Api\OverviewController;

use App\Http\Middleware\SuperAdminMiddleware;


/*
|--------------------------------------------------------------------------
| AUTHENTICATION
|--------------------------------------------------------------------------
*/

Route::post('/login', [AuthController::class, 'login']);
Route::post('/register', [AuthController::class, 'register']);
Route::post('/forgot-password', [AuthController::class, 'forgotPassword']);

Route::get('/health', function () {
    return response()->json([
        'status' => 'ok',
        'app' => config('app.name'),
        'timestamp' => now()->toIso8601String(),
    ]);
});


/*
|--------------------------------------------------------------------------
| SUPER ADMIN ROUTES
|--------------------------------------------------------------------------
*/

Route::middleware([
    'auth:sanctum',
    SuperAdminMiddleware::class
])->group(function () {

    /*
    |--------------------------------------------------------------------------
    | EMPLOYEES
    |--------------------------------------------------------------------------
    */

    Route::get('/employees', [EmployeeController::class, 'index']);
    Route::post('/employees', [EmployeeController::class, 'store']);
    Route::get('/employees/{id}', [EmployeeController::class, 'show']);
    Route::put('/employees/{id}', [EmployeeController::class, 'update']);
    Route::delete('/employees/{id}', [EmployeeController::class, 'destroy']);


    /*
    |--------------------------------------------------------------------------
    | CONTRACTORS
    |--------------------------------------------------------------------------
    */

    Route::get('/contractors', [ContractorController::class, 'index']);
    Route::post('/contractors', [ContractorController::class, 'store']);
    Route::get('/contractors/{id}', [ContractorController::class, 'show']);
    Route::put('/contractors/{id}', [ContractorController::class, 'update']);
    Route::delete('/contractors/{id}', [ContractorController::class, 'destroy']);


    /*
    |--------------------------------------------------------------------------
    | CONTRACTS
    |--------------------------------------------------------------------------
    */

    Route::get('/contracts', [ContractController::class, 'index']);
    Route::post('/contracts', [ContractController::class, 'store']);
    Route::get('/contracts/{id}', [ContractController::class, 'show']);
    Route::put('/contracts/{id}', [ContractController::class, 'update']);
    Route::delete('/contracts/{id}', [ContractController::class, 'destroy']);


    /*
    |--------------------------------------------------------------------------
    | HISTORY LOGS FOR ACTIVITIES (Super Admin only)
    |--------------------------------------------------------------------------
    */

    Route::get('/activity-logs', [ActivityLogController::class, 'index']);

    /*
    |--------------------------------------------------------------------------
    | Deleting a user account is Super Admin only. Viewing users and editing
    | their permissions/roles is shared with Admin/Barangay Admin below.
    |--------------------------------------------------------------------------
    */

    Route::delete('/users/bulk', [UserController::class, 'bulkDestroy']);
    Route::post('/users/bulk-delete', [UserController::class, 'bulkDestroy']);
    Route::delete('/users/{id}', [UserController::class, 'destroy']);

});


/*
|--------------------------------------------------------------------------
| ALL USER PROFILES + EDIT PERMISSIONS
|--------------------------------------------------------------------------
|
| Shared by Admin (Barangay Admin) and Super Admin: both roles need to see
| resident/vendor/staff profiles and customize user permissions.
|
*/

Route::middleware('auth:sanctum')->group(function () {
    Route::delete('/users/bulk', [UserController::class, 'bulkDestroy']);
    Route::post('/users/bulk-delete', [UserController::class, 'bulkDestroy']);
    Route::patch('/users/bulk-archive', [UserController::class, 'bulkArchive']);
    Route::post('/users/bulk-archive', [UserController::class, 'bulkArchive']);
    Route::patch('/users/bulk-restore', [UserController::class, 'bulkRestore']);
    Route::post('/users/bulk-restore', [UserController::class, 'bulkRestore']);
    Route::patch('/users/bulk-role', [UserController::class, 'bulkUpdateRole']);
    Route::post('/users/bulk-role', [UserController::class, 'bulkUpdateRole']);

    Route::patch('/users/{id}/archive', [UserController::class, 'archive']);
    Route::post('/users/{id}/archive', [UserController::class, 'archive']);
    Route::patch('/users/{id}/restore', [UserController::class, 'restore']);
    Route::post('/users/{id}/restore', [UserController::class, 'restore']);

    Route::get('/users', [UserController::class, 'index']);
    Route::get('/users/{id}', [UserController::class, 'show']);
    Route::put('/users/{id}', [UserController::class, 'update']);
    Route::put('/users/{id}/roles', [UserController::class, 'updateRoles']);
    Route::delete('/users/{id}', [UserController::class, 'destroy']);

    Route::get('/roles', [RoleController::class, 'index']);
});


/*
|--------------------------------------------------------------------------
| REPORTS
|--------------------------------------------------------------------------
*/

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/reports', [ReportController::class, 'index']);
    Route::post('/reports', [ReportController::class, 'store']);
    Route::get('/reports/{id}', [ReportController::class, 'show']);
    Route::put('/reports/{id}/status', [ReportController::class, 'updateStatus'])
        ->middleware(SuperAdminMiddleware::class);
    Route::delete('/reports/{id}', [ReportController::class, 'destroy'])
        ->middleware(SuperAdminMiddleware::class);
});


/*
|--------------------------------------------------------------------------
| VENDORS
|--------------------------------------------------------------------------
*/

Route::get('/vendors', [VendorController::class, 'index']);
Route::get('/vendors/{id}', [VendorController::class, 'show']);

// Resident Public Vendor Information & QR Scanner Lookup (shared vendors/inspections/violations DB, read-only & sanitized)
Route::get('/resident/vendors', [VendorController::class, 'residentIndex']);
Route::post('/resident/vendors/scan-qr', [VendorController::class, 'residentScanQr']);
Route::get('/resident/vendors/{idOrCode}', [VendorController::class, 'residentShow']);
Route::get('/public/resident/vendors', [VendorController::class, 'residentIndex']);
Route::post('/public/resident/vendors/scan-qr', [VendorController::class, 'residentScanQr']);
Route::get('/public/resident/vendors/{idOrCode}', [VendorController::class, 'residentShow']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/vendors', [VendorController::class, 'store']);
    Route::put('/vendors/{id}', [VendorController::class, 'update']);
    Route::put('/vendors/{id}/status', [VendorController::class, 'updateStatus']);
    Route::post('/vendors/{id}/regenerate-qr', [VendorController::class, 'regenerateQr'])
        ->middleware(SuperAdminMiddleware::class);
    Route::delete('/vendors/{id}', [VendorController::class, 'destroy']);
});


/*
|--------------------------------------------------------------------------
| ATTENDANCE
|--------------------------------------------------------------------------
*/

Route::get('/attendance', [AttendanceController::class, 'index']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/attendance/check-in', [AttendanceController::class, 'checkIn']);
    Route::post('/attendance/check-out', [AttendanceController::class, 'checkOut']);

    Route::patch('/attendance/bulk-archive', [AttendanceController::class, 'bulkArchive']);
    Route::post('/attendance/bulk-archive', [AttendanceController::class, 'bulkArchive']);
    Route::patch('/attendance/bulk-restore', [AttendanceController::class, 'bulkRestore']);
    Route::post('/attendance/bulk-restore', [AttendanceController::class, 'bulkRestore']);

    Route::patch('/attendance/{id}/archive', [AttendanceController::class, 'archive']);
    Route::post('/attendance/{id}/archive', [AttendanceController::class, 'archive']);
    Route::patch('/attendance/{id}/restore', [AttendanceController::class, 'restore']);
    Route::post('/attendance/{id}/restore', [AttendanceController::class, 'restore']);

    Route::post('/attendance', [AttendanceController::class, 'store']);
    Route::get('/attendance/{id}', [AttendanceController::class, 'show']);
    Route::put('/attendance/{id}', [AttendanceController::class, 'update']);
    Route::put('/attendance/{id}/status', [AttendanceController::class, 'updateStatus']);
    Route::delete('/attendance/{id}', [AttendanceController::class, 'destroy']);
});


/*
|--------------------------------------------------------------------------
| COLLECTION SCHEDULES (Public read for civic schedules, authenticated mutations)
|--------------------------------------------------------------------------
*/

Route::get('/schedules', [ScheduleController::class, 'index']);
Route::get('/schedules/next', [ScheduleController::class, 'next']);
Route::get('/schedules/{id}', [ScheduleController::class, 'show']);

// Public fallback aliases
Route::get('/public/schedules', [ScheduleController::class, 'index']);
Route::get('/public/schedules/next', [ScheduleController::class, 'next']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/schedules', [ScheduleController::class, 'store']);
    Route::put('/schedules/{id}', [ScheduleController::class, 'update']);
    Route::post('/schedules/{id}/complete', [ScheduleController::class, 'complete']);
    Route::delete('/schedules/{id}', [ScheduleController::class, 'destroy']);
});

/*
|--------------------------------------------------------------------------
| FEEDBACK, NOTIFICATIONS, & VIOLATIONS
|--------------------------------------------------------------------------
*/

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/feedback', [FeedbackController::class, 'index']);
    Route::post('/feedback', [FeedbackController::class, 'store']);

    Route::get('/violations', [ViolationController::class, 'index']);
    Route::post('/violations', [ViolationController::class, 'store']);
});

/*
|--------------------------------------------------------------------------
| PUSH NOTIFICATIONS & ADVISORIES (Mobile & Web Sync)
|--------------------------------------------------------------------------
| Supports both authenticated and mobile background device sync so that
| device push token registration, advisory polling, and broadcasts
| never fail due to expired session tokens.
*/
Route::get('/notifications', [NotificationController::class, 'index']);
Route::get('/notifications/latest', [NotificationController::class, 'latest']);
Route::get('/notifications/latest-broadcast', [NotificationController::class, 'latest']);
Route::put('/notifications/{id}/read', [NotificationController::class, 'markAsRead']);
Route::post('/notifications/device-token', [NotificationController::class, 'registerToken']);
Route::delete('/notifications/device-token', [NotificationController::class, 'removeToken']);
Route::post('/notifications/broadcast', [NotificationController::class, 'broadcast']);
Route::get('/public/notifications', [NotificationController::class, 'index']);


/*
|--------------------------------------------------------------------------
| BARANGAYS (read-only, used for dropdowns)
|--------------------------------------------------------------------------
*/

Route::get('/barangays', [BarangayController::class, 'index']);


/*
|--------------------------------------------------------------------------
| MARKET COMPLIANCE (INSPECTIONS)
|--------------------------------------------------------------------------
| Supports both authenticated Sanctum requests and mobile field / offline
| fallback so that inspector evaluation submissions, admin decisions, and
| vendor evaluations never fail with 401 Unauthorized errors.
*/
Route::get('/inspections', [InspectionController::class, 'index']);
Route::post('/inspections', [InspectionController::class, 'store']);
Route::get('/inspections/{id}', [InspectionController::class, 'show']);
Route::put('/inspections/{id}', [InspectionController::class, 'update']);
Route::post('/inspections/{id}/accept-change', [InspectionController::class, 'acceptChange']);
Route::post('/inspections/{id}/reject-change', [InspectionController::class, 'rejectChange']);
Route::put('/inspections/{id}/decision', [InspectionController::class, 'decision']);
Route::delete('/inspections/{id}', [InspectionController::class, 'destroy']);
Route::get('/vendor/evaluation', [InspectionController::class, 'vendorEvaluation']);
Route::get('/public/vendor/evaluation/{vendorId?}', [InspectionController::class, 'publicVendorEvaluation']);
Route::post('/inspector/verify-vendor-qr', [InspectionController::class, 'verifyVendorQr'])
    ->middleware('auth:sanctum');
// Preview / test fallback for offline simulation
Route::post('/public/inspector/verify-vendor-qr', [InspectionController::class, 'verifyVendorQr']);
Route::get('/inspector/stats', [InspectionController::class, 'getInspectorStats'])
    ->middleware('auth:sanctum');
Route::get('/public/inspector/stats', [InspectionController::class, 'getInspectorStats']);



/*
|--------------------------------------------------------------------------
| TRUCK LOCATION ANALYTICS
|--------------------------------------------------------------------------
*/

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/trucks', [TruckController::class, 'index']);
    Route::get('/trucks/live-tracking', [TruckLocationController::class, 'liveTracking']);
    Route::get('/trucks/routes-map', [TruckLocationController::class, 'routesMap']);
    Route::post('/driver/location', [TruckLocationController::class, 'recordDriverLocation']);
    Route::post('/trucks', [TruckController::class, 'store']);
    Route::get('/trucks/{id}', [TruckController::class, 'show']);
    Route::put('/trucks/{id}', [TruckController::class, 'update']);
    Route::put('/trucks/{id}/status', [TruckController::class, 'updateStatus']);
    Route::delete('/trucks/{id}', [TruckController::class, 'destroy']);

    Route::get('/trucks/{id}/locations', [TruckLocationController::class, 'index']);
    Route::post('/trucks/{id}/locations', [TruckLocationController::class, 'store']);
    Route::post('/driver/truck-status', [TruckController::class, 'updateDriverTruckStatus']);
    Route::post('/driver/status', [TruckController::class, 'updateDriverTruckStatus']);
    Route::get('/driver/status', [TruckController::class, 'getDriverStatus']);
});


/*
|--------------------------------------------------------------------------
| COLLECTION ROUTES (trash collection runs / Records & Archives)
|--------------------------------------------------------------------------
*/

Route::get('/collection-routes/options', [CollectionRouteController::class, 'options']);
Route::get('/public/collection-routes/options', [CollectionRouteController::class, 'options']);
Route::get('/collection-routes', [CollectionRouteController::class, 'index']);
Route::get('/collection-routes/{id}', [CollectionRouteController::class, 'show']);
Route::post('/collection-routes', [CollectionRouteController::class, 'store']);
Route::put('/collection-routes/{id}', [CollectionRouteController::class, 'update']);
Route::delete('/collection-routes/{id}', [CollectionRouteController::class, 'destroy']);

Route::get('/public/collection-routes', [CollectionRouteController::class, 'index']);
Route::get('/public/collection-routes/{id}', [CollectionRouteController::class, 'show']);
Route::post('/public/collection-routes', [CollectionRouteController::class, 'store']);
Route::put('/public/collection-routes/{id}', [CollectionRouteController::class, 'update']);
Route::delete('/public/collection-routes/{id}', [CollectionRouteController::class, 'destroy']);


/*
|--------------------------------------------------------------------------
| DRIVER ACTUAL COLLECTION LOGS
| (Insert-only, Typo-edit before finalization, Finalized locked, Idempotency)
|--------------------------------------------------------------------------
*/

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/driver/collection-logs', [CollectionLogController::class, 'index']);
    Route::post('/driver/collection-logs', [CollectionLogController::class, 'store']);
    Route::get('/driver/collection-logs/{id}', [CollectionLogController::class, 'show']);
    Route::put('/driver/collection-logs/{id}', [CollectionLogController::class, 'update']);
    Route::post('/driver/collection-logs/{id}/finalize', [CollectionLogController::class, 'finalize']);

    Route::get('/barangays/1-to-40', [CollectionLogController::class, 'barangays1to40']);
    Route::get('/admin/collection-logs', [CollectionLogController::class, 'index']);
});

// Demo/preview route
Route::get('/public/trucks', [TruckController::class, 'index']);
Route::get('/public/trucks/live-tracking', [TruckLocationController::class, 'liveTracking']);
Route::get('/public/trucks/routes-map', [TruckLocationController::class, 'routesMap']);
Route::post('/public/driver/location', [TruckLocationController::class, 'recordDriverLocation']);
Route::get('/public/trucks/{id}/locations', [TruckLocationController::class, 'index']);
Route::post('/public/trucks/{id}/locations', [TruckLocationController::class, 'store']);
Route::post('/public/driver/truck-status', [TruckController::class, 'updateDriverTruckStatus']);
Route::post('/public/driver/status', [TruckController::class, 'updateDriverTruckStatus']);
Route::get('/public/driver/status', [TruckController::class, 'getDriverStatus']);
Route::get('/public/barangays/1-to-40', [CollectionLogController::class, 'barangays1to40']);
Route::get('/public/driver/collection-logs', [CollectionLogController::class, 'index']);
Route::post('/public/driver/collection-logs', [CollectionLogController::class, 'store']);
Route::get('/public/collection-logs', [CollectionLogController::class, 'index']);

/*
|--------------------------------------------------------------------------
| NOTIFICATIONS & SCHEDULED PICKUP ALERTS (Web & Mobile)
|--------------------------------------------------------------------------
*/
Route::get('/notifications', [NotificationController::class, 'index']);
Route::get('/notifications/latest', [NotificationController::class, 'latest']);
Route::put('/notifications/{id}/read', [NotificationController::class, 'markAsRead']);
Route::post('/notifications/{id}/read', [NotificationController::class, 'markAsRead']);
Route::put('/notifications/{id}/unread', [NotificationController::class, 'markAsUnread']);
Route::post('/notifications/{id}/unread', [NotificationController::class, 'markAsUnread']);
Route::post('/notifications/{id}/toggle-read', [NotificationController::class, 'toggleRead']);
Route::post('/notifications/token', [NotificationController::class, 'registerToken']);
Route::delete('/notifications/token', [NotificationController::class, 'removeToken']);
Route::post('/notifications/broadcast', [NotificationController::class, 'broadcast']);
Route::post('/schedules/check-notifications', [NotificationController::class, 'checkScheduledPickups']);
Route::get('/schedules/check-notifications', [NotificationController::class, 'checkScheduledPickups']);

// Public fallbacks
Route::get('/public/notifications', [NotificationController::class, 'index']);
Route::get('/public/notifications/latest', [NotificationController::class, 'latest']);
Route::put('/public/notifications/{id}/read', [NotificationController::class, 'markAsRead']);
Route::post('/public/notifications/{id}/read', [NotificationController::class, 'markAsRead']);
Route::put('/public/notifications/{id}/unread', [NotificationController::class, 'markAsUnread']);
Route::post('/public/notifications/{id}/unread', [NotificationController::class, 'markAsUnread']);
Route::post('/public/notifications/{id}/toggle-read', [NotificationController::class, 'toggleRead']);
Route::post('/public/notifications/token', [NotificationController::class, 'registerToken']);
Route::post('/public/notifications/broadcast', [NotificationController::class, 'broadcast']);
Route::post('/public/schedules/check-notifications', [NotificationController::class, 'checkScheduledPickups']);
Route::get('/public/schedules/check-notifications', [NotificationController::class, 'checkScheduledPickups']);



/*
|--------------------------------------------------------------------------
| DASHBOARD ANALYTICS
|--------------------------------------------------------------------------
*/

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/analytics/overview', [AnalyticsController::class, 'overview']);
    Route::get('/analytics/barangay-stats', [AnalyticsController::class, 'barangayAnalytics']);

    /*
    |--------------------------------------------------------------------------
    | BARANGAY OVERVIEW DASHBOARD SUMMARY & ACTIVITY LOGS
    |--------------------------------------------------------------------------
    */
    Route::get('/overview/summary', [OverviewController::class, 'summary']);
    Route::get('/activity-logs', [ActivityLogController::class, 'index']);
});

// Demo / Local preview access without Sanctum token
Route::get('/public/overview/summary', [OverviewController::class, 'summary']);


/*
|--------------------------------------------------------------------------
| CLENRO HISTORICAL GARBAGE PILE-UP DECISION SUPPORT
| (Barangay 1 to 40, Cogon Market, Carmen Market - Cagayan de Oro City)
|--------------------------------------------------------------------------
*/

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/clenro/pileup-reports', [ClenroPileupReportController::class, 'index']);
    Route::get('/clenro/pileup-reports/{id}', [ClenroPileupReportController::class, 'show']);
    Route::get('/clenro/pileup-reports-analytics', [ClenroPileupReportController::class, 'analytics']);
    Route::get('/clenro/pileup-reports-export', [ClenroPileupReportController::class, 'exportCsv']);
});

// Demo / Local preview access without Sanctum token
Route::get('/public/clenro/pileup-reports', [ClenroPileupReportController::class, 'index']);
Route::get('/public/clenro/pileup-reports-analytics', [ClenroPileupReportController::class, 'analytics']);
Route::get('/public/clenro/pileup-reports-export', [ClenroPileupReportController::class, 'exportCsv']);


/*
|--------------------------------------------------------------------------
| ADMIN + SUPER ADMIN SETTINGS
|--------------------------------------------------------------------------
|
| These routes intentionally use only auth:sanctum.
| AuthController checks that the authenticated user has either:
|
| admin
| super_admin
|
*/

Route::middleware('auth:sanctum')->group(function () {

    Route::get(
        '/me',
        [AuthController::class, 'me']
    );

    Route::put(
        '/profile',
        [AuthController::class, 'updateProfile']
    );

    Route::put(
        '/change-password',
        [AuthController::class, 'changePassword']
    );

});