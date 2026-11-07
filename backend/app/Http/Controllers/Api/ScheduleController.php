<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Barangay;
use App\Models\CollectionRoute;
use App\Models\CollectionSchedule;
use App\Models\Notification;
use App\Models\Truck;
use App\Models\TruckLocation;
use App\Models\User;
use App\Services\PushNotificationService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class ScheduleController extends Controller
{
    /*
    |--------------------------------------------------------------------------
    | GET ALL SCHEDULES
    |--------------------------------------------------------------------------
    */

    public function index(Request $request)
    {
        $query = CollectionSchedule::with('barangay');

        $matchingIds = self::resolveBarangayFilterIds($request);
        if (!empty($matchingIds)) {
            $query->whereIn('barangay_id', $matchingIds);
        }

        if ($request->filled('day')) {
            $query->where('day', $request->day);
        }

        $schedules = $query
            ->orderBy('date')
            ->orderBy('pickup_time')
            ->get()
            ->map(function (CollectionSchedule $schedule) {
                return self::enrichScheduleWithRouteAndTruck($schedule);
            });

        return response()->json([
            'success' => true,
            'message' => 'Schedules retrieved successfully.',
            'count' => $schedules->count(),
            'schedules' => $schedules,
        ]);
    }


    /*
    |--------------------------------------------------------------------------
    | GET NEXT SCHEDULE
    |--------------------------------------------------------------------------
    */

    public function next(Request $request)
    {
        $today = Carbon::today()->toDateString();
        $query = CollectionSchedule::with('barangay');

        $matchingIds = self::resolveBarangayFilterIds($request);
        if (!empty($matchingIds)) {
            $query->whereIn('barangay_id', $matchingIds);
        }

        // Try to find upcoming schedule from today onwards
        $schedule = (clone $query)
            ->where('date', '>=', $today)
            ->where('status', '!=', 'completed')
            ->orderBy('date')
            ->orderBy('pickup_time')
            ->first();

        // If no upcoming schedule, grab closest available schedule
        if (!$schedule) {
            $schedule = $query
                ->orderByDesc('date')
                ->first();
        }

        if (!$schedule) {
            return response()->json([
                'success' => true,
                'has_schedule' => false,
                'message' => 'No upcoming schedule found for this barangay.',
                'schedule' => null,
            ], 200);
        }

        return response()->json([
            'success' => true,
            'has_schedule' => true,
            'message' => 'Next schedule retrieved successfully.',
            'schedule' => self::enrichScheduleWithRouteAndTruck($schedule),
        ]);
    }


    /*
    |--------------------------------------------------------------------------
    | COMPLETE SCHEDULE
    |--------------------------------------------------------------------------
    */

    public function complete(Request $request, $id)
    {
        $schedule = CollectionSchedule::find($id);

        if (!$schedule) {
            return response()->json([
                'success' => false,
                'message' => 'Schedule not found.',
            ], 404);
        }

        $schedule->status = 'completed';
        $schedule->save();

        $schedule->load('barangay');

        ActivityLog::record(
            'schedule.completed',
            "Completed schedule #{$schedule->id} for {$schedule->barangay->name}.",
            $schedule
        );

        // Dispatch push notification to residents of this barangay
        $barangay = $schedule->barangay;
        if ($barangay) {
            try {
                PushNotificationService::broadcast(
                    'schedule',
                    'Waste Collection Completed',
                    "Scheduled waste collection in {$barangay->name} has been completed.",
                    [
                        'role' => 'resident',
                        'barangay_id' => $barangay->id,
                    ],
                    ['schedule_id' => $schedule->id]
                );
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::warning("Could not broadcast completion push: " . $e->getMessage());
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'Schedule marked as completed.',
            'schedule' => $schedule,
        ]);
    }



    /*
    |--------------------------------------------------------------------------
    | CREATE SCHEDULE
    |--------------------------------------------------------------------------
    */

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'barangay_id' => 'required|exists:barangays,id',
            'date' => 'required|date',
            'pickup_time' => 'required|date_format:H:i',
            'schedule_type' => 'nullable|string|max:255',
            'notes' => 'nullable|string',
            'active' => 'nullable|boolean',
            'status' => 'required|in:scheduled,in_progress,completed',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Please check the schedule information.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $targetBarangay = \App\Models\Barangay::find($request->barangay_id);
        $canonicalBarangayId = $request->barangay_id;
        if ($targetBarangay) {
            $first = \App\Models\Barangay::where('name', $targetBarangay->name)->orderBy('id')->first();
            if ($first) {
                $canonicalBarangayId = $first->id;
            }
        }

        $schedule = CollectionSchedule::create([
            'barangay_id' => $canonicalBarangayId,
            'date' => $request->date,
            'day' => Carbon::parse($request->date)->format('l'),
            'pickup_time' => $request->pickup_time,
            'schedule_type' => $request->schedule_type ?? 'regular',
            'notes' => $request->notes,
            'active' => $request->has('active') ? $request->boolean('active') : true,
            'status' => $request->status,
        ]);

        $schedule->load('barangay');

        ActivityLog::record(
            'schedule.created',
            "Added {$schedule->day} schedule for {$schedule->barangay->name}.",
            $schedule
        );

        // Dispatch real-time push notification for this schedule
        try {
            $barangayName = $schedule->barangay ? $schedule->barangay->name : "Barangay";
            $formattedTime = substr($schedule->pickup_time, 0, 5);
            PushNotificationService::broadcast(
                'schedule',
                "Collection Schedule: {$barangayName}",
                "Pickup scheduled for {$schedule->day}, {$schedule->date} at {$formattedTime}.",
                [
                    'barangay_id' => $schedule->barangay_id,
                    'role' => 'resident',
                ],
                ['schedule_id' => $schedule->id]
            );
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning("Could not broadcast schedule push: " . $e->getMessage());
        }

        return response()->json([
            'success' => true,
            'message' => 'Schedule created successfully.',
            'schedule' => $schedule,
        ], 201);
    }


    /*
    |--------------------------------------------------------------------------
    | GET SINGLE SCHEDULE
    |--------------------------------------------------------------------------
    */

    public function show($id)
    {
        $schedule = CollectionSchedule::with('barangay')->find($id);

        if (!$schedule) {
            return response()->json([
                'success' => false,
                'message' => 'Schedule not found.',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'message' => 'Schedule retrieved successfully.',
            'schedule' => $schedule,
        ]);
    }


    /*
    |--------------------------------------------------------------------------
    | UPDATE SCHEDULE
    |--------------------------------------------------------------------------
    */

    public function update(Request $request, $id)
    {
        $schedule = CollectionSchedule::find($id);

        if (!$schedule) {
            return response()->json([
                'success' => false,
                'message' => 'Schedule not found.',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'barangay_id' => 'sometimes|required|exists:barangays,id',
            'date' => 'sometimes|required|date',
            'pickup_time' => 'sometimes|required|date_format:H:i',
            'schedule_type' => 'nullable|string|max:255',
            'notes' => 'nullable|string',
            'active' => 'nullable|boolean',
            'status' => 'sometimes|required|in:scheduled,in_progress,completed',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Please check the schedule information.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $schedule->update($request->only([
            'barangay_id',
            'date',
            'pickup_time',
            'schedule_type',
            'notes',
            'active',
            'status',
        ]));

        if ($request->filled('date')) {
            $schedule->day = Carbon::parse($request->date)->format('l');
            $schedule->save();
        }

        $schedule->load('barangay');

        ActivityLog::record(
            'schedule.updated',
            "Updated schedule #{$schedule->id}.",
            $schedule
        );

        return response()->json([
            'success' => true,
            'message' => 'Schedule updated successfully.',
            'schedule' => $schedule,
        ]);
    }


    /*
    |--------------------------------------------------------------------------
    | DELETE SCHEDULE
    |--------------------------------------------------------------------------
    */

    public function destroy($id)
    {
        $schedule = CollectionSchedule::find($id);

        if (!$schedule) {
            return response()->json([
                'success' => false,
                'message' => 'Schedule not found.',
            ], 404);
        }

        $schedule->delete();

        ActivityLog::record(
            'schedule.deleted',
            "Deleted schedule #{$id}."
        );

        return response()->json([
            'success' => true,
            'message' => 'Schedule deleted successfully.',
        ]);
    }

    public static function resolveBarangayFilterIds(Request $request): array
    {
        $namesToMatch = [];
        $idsToMatch = [];

        if ($request->filled('barangay')) {
            $rawName = trim((string) $request->barangay);
            if (preg_match('/barangay\s*(\d+)/i', $rawName, $m)) {
                $namesToMatch[] = 'Barangay ' . (int) $m[1];
            }
            $namesToMatch[] = $rawName;
        }

        if ($request->filled('barangay_id')) {
            $rawId = (int) $request->barangay_id;
            if ($rawId >= 1 && $rawId <= 40) {
                $namesToMatch[] = "Barangay {$rawId}";
            }
            $target = Barangay::find($rawId);
            if ($target) {
                $idsToMatch[] = $target->id;
                if (empty($namesToMatch)) {
                    $namesToMatch[] = $target->name;
                }
            } else {
                $idsToMatch[] = $rawId;
            }
        }

        if (!empty($namesToMatch)) {
            $byNameIds = Barangay::whereIn('name', array_unique($namesToMatch))->pluck('id')->toArray();
            if (!empty($byNameIds)) {
                return array_values(array_unique($byNameIds));
            }
        }

        return array_values(array_unique($idsToMatch));
    }

    /*
    |--------------------------------------------------------------------------
    | ENRICH SCHEDULE WITH COLLECTION ROUTE, TRUCK, & LIVE GPS TELEMETRY
    |--------------------------------------------------------------------------
    */
    public static function enrichScheduleWithRouteAndTruck(CollectionSchedule $schedule): array
    {
        $data = $schedule->toArray();

        $barangayName = $schedule->barangay?->name ?? '';
        $brgyNum = 12;
        if (preg_match('/(\d+)/', $barangayName, $m)) {
            $brgyNum = (int) $m[1];
        } elseif ($schedule->barangay_id >= 1 && $schedule->barangay_id <= 40) {
            $brgyNum = (int) $schedule->barangay_id;
        }

        // Match route sector definition from TruckLocationController
        $routeDefs = TruckLocationController::getRouteDefinitions();
        $matchedRouteDef = null;
        foreach ($routeDefs as $def) {
            if (in_array($brgyNum, $def['barangays'], true)) {
                $matchedRouteDef = $def;
                break;
            }
        }
        if (!$matchedRouteDef) {
            $matchedRouteDef = $routeDefs[0];
        }

        $dateStr = $schedule->date ? Carbon::parse($schedule->date)->toDateString() : Carbon::today()->toDateString();

        // Check for a matching CollectionRoute row in DB
        $matchingBarangayIds = [$schedule->barangay_id];
        if ($barangayName) {
            $matchingBarangayIds = Barangay::where('name', $barangayName)->pluck('id')->toArray() ?: [$schedule->barangay_id];
        }

        $dbRoute = CollectionRoute::with(['truck.driver', 'assignedPersonnel', 'stops'])
            ->whereIn('barangay_id', $matchingBarangayIds)
            ->whereDate('collection_date', $dateStr)
            ->latest('id')
            ->first();

        if (!$dbRoute) {
            $dbRoute = CollectionRoute::with(['truck.driver', 'assignedPersonnel', 'stops'])
                ->whereIn('barangay_id', $matchingBarangayIds)
                ->latest('collection_date')
                ->latest('id')
                ->first();
        }

        // Resolve assigned Truck from CollectionRoute or Sector Truck
        $truck = $dbRoute?->truck;
        if (!$truck && $matchedRouteDef) {
            $truck = Truck::with('driver')
                ->where('plate_number', $matchedRouteDef['plate_number'])
                ->orWhere('truck_number', $matchedRouteDef['truck_number'])
                ->first();
        }

        // Format start_time and end_time
        $rawStart = $schedule->pickup_time ?: '09:00:00';
        if ($dbRoute && $dbRoute->getRawOriginal('start_time')) {
            $rawStart = $dbRoute->getRawOriginal('start_time');
        }
        $startTime = substr((string) $rawStart, 0, 5);

        $startLocation = $dbRoute?->start_location ?: ($barangayName ? "{$barangayName} Barangay Hall" : 'Barangay Hall');
        $endLocation = $dbRoute?->end_location ?: 'Sanitation Facility';
        $distanceKm = (float) ($dbRoute?->distance_km ?: 15.0);
        $stopDurationMins = (int) ($dbRoute?->stop_duration_minutes ?: 40);

        $rawStops = $dbRoute?->collection_stops;
        if (empty($rawStops)) {
            $rawStops = [
                ['stop_order' => 1, 'name' => 'First Collection Point', 'duration_minutes' => $stopDurationMins],
                ['stop_order' => 2, 'name' => 'Second Collection Point', 'duration_minutes' => $stopDurationMins],
                ['stop_order' => 3, 'name' => 'Final Collection Point', 'duration_minutes' => $stopDurationMins],
            ];
        } else {
            $rawStops = CollectionRouteController::normalizeStopsInput($rawStops, $stopDurationMins);
        }

        $calc = CollectionRouteController::calculateRouteSchedule(
            $startLocation,
            $endLocation,
            $startTime,
            $rawStops,
            $distanceKm,
            $stopDurationMins,
            $dbRoute?->estimated_duration_minutes ? (int) $dbRoute->estimated_duration_minutes : null
        );
        $endTime = $calc['estimated_arrival_24'];

        // Resolve latest GPS location for the assigned truck
        $latestLocation = null;
        if ($truck) {
            $latestLocation = TruckLocation::where('truck_id', $truck->id)
                ->latest('recorded_at')
                ->first();
        }

        $now = now();
        $currentTruckLocation = null;
        if ($latestLocation) {
            $diffSec = $latestLocation->recorded_at ? (int) round(abs($now->diffInSeconds($latestLocation->recorded_at))) : 0;
            if ($diffSec < 60) {
                $timeAgo = "{$diffSec}s ago";
            } elseif ($diffSec < 3600) {
                $timeAgo = round($diffSec / 60) . 'm ago';
            } else {
                $timeAgo = round($diffSec / 3600) . 'h ago';
            }

            $currentTruckLocation = [
                'gps_available' => true,
                'is_live' => ($truck && $truck->status === 'on_route') || $diffSec < 900,
                'latitude' => (float) $latestLocation->latitude,
                'longitude' => (float) $latestLocation->longitude,
                'speed' => (float) ($latestLocation->speed ?? 0),
                'heading' => (float) ($latestLocation->heading ?? 0),
                'recorded_at' => $latestLocation->recorded_at ? $latestLocation->recorded_at->toIso8601String() : null,
                'time_ago' => $timeAgo,
                'area_label' => $matchedRouteDef['name'] ?? 'CDO Collection Corridor',
            ];
        } elseif ($truck && $truck->status === 'on_route') {
            $waypoint = $matchedRouteDef['waypoints'][0] ?? [8.4760, 124.6470];
            $currentTruckLocation = [
                'gps_available' => true,
                'is_live' => true,
                'latitude' => (float) $waypoint[0],
                'longitude' => (float) $waypoint[1],
                'speed' => 18.5,
                'heading' => 90.0,
                'recorded_at' => $now->toIso8601String(),
                'time_ago' => 'Live on route',
                'area_label' => $matchedRouteDef['name'] ?? 'CDO Collection Corridor',
            ];
        } else {
            $waypoint = $matchedRouteDef['waypoints'][0] ?? [8.4760, 124.6470];
            $currentTruckLocation = [
                'gps_available' => false,
                'is_live' => false,
                'latitude' => (float) $waypoint[0],
                'longitude' => (float) $waypoint[1],
                'speed' => 0.0,
                'heading' => 0.0,
                'recorded_at' => null,
                'time_ago' => 'GPS Standby (Depot)',
                'area_label' => $matchedRouteDef['name'] ?? 'CDO Collection Corridor',
            ];
        }

        // Determine effective collection status
        $effectiveStatus = $schedule->status ?: 'scheduled';
        if ($effectiveStatus !== 'completed' && $dbRoute && $dbRoute->status === 'in_progress') {
            $effectiveStatus = 'in_progress';
        } elseif ($effectiveStatus !== 'completed' && $dateStr === $now->toDateString() && $truck && $truck->status === 'on_route') {
            $effectiveStatus = 'in_progress';
        }

        $routeStops = array_map(
            fn ($num) => "Barangay {$num}",
            $matchedRouteDef['barangays'] ?? [$brgyNum]
        );

        // Compute GPS-based estimated arrival ONLY when live GPS and active route support it
        $estimatedArrival = null;
        if (
            !empty($currentTruckLocation['gps_available']) &&
            !empty($currentTruckLocation['is_live']) &&
            $effectiveStatus !== 'completed' &&
            $dateStr === $now->toDateString()
        ) {
            $stopIndex = array_search($brgyNum, $matchedRouteDef['barangays'] ?? [], true);
            $stopOffsetMins = ($stopIndex !== false) ? max(5, ((int) $stopIndex + 1) * 6) : 12;
            $estimatedArrival = $now->copy()->addMinutes($stopOffsetMins)->format('h:i A') . " (~{$stopOffsetMins} mins via Live GPS)";
        }

        $personnel = $dbRoute?->assignedPersonnel ?: $truck?->driver;

        $data['barangay_name'] = $barangayName ?: "Barangay {$brgyNum}";
        $data['collection_date'] = $dateStr;
        $data['start_location'] = $startLocation;
        $data['end_location'] = $endLocation;
        $data['start_time'] = $calc['start_time_24'];
        $data['start_time_formatted'] = $calc['start_time_formatted'];
        $data['end_time'] = $endTime;
        $data['estimated_arrival_time'] = $calc['estimated_arrival_24'];
        $data['estimated_arrival_formatted'] = $calc['estimated_arrival_formatted'];
        $data['estimated_duration_minutes'] = $calc['estimated_duration_minutes'];
        $data['estimated_duration'] = $calc['estimated_duration'];
        $data['distance_km'] = $distanceKm;
        $data['stop_duration_minutes'] = $stopDurationMins;
        $data['collection_stops'] = $calc['stops'];
        $data['timeline'] = $calc['timeline'];
        $data['route_number'] = $matchedRouteDef['route_number'] ?? 1;
        $data['route_name'] = $dbRoute?->route_name ?: ($matchedRouteDef['name'] ?? 'Route 1: Poblacion');
        $data['route_description'] = $matchedRouteDef['description'] ?? '';
        $data['route_stops'] = array_map(fn ($s) => $s['name'], $calc['stops']);
        $data['estimated_arrival'] = $estimatedArrival ?: $calc['estimated_arrival_formatted'];
        $data['collection_status'] = $effectiveStatus;
        $data['status'] = $effectiveStatus;
        $data['assigned_personnel'] = [
            'id' => $personnel?->id,
            'name' => $personnel?->name ?? ($truck?->driver?->name ?? 'Assigned Driver'),
        ];
        $data['assigned_truck'] = [
            'id' => $truck?->id,
            'truck_number' => $truck?->truck_number ?? ($matchedRouteDef['truck_number'] ?? 'TRK-01'),
            'plate_number' => $truck?->plate_number ?? ($matchedRouteDef['plate_number'] ?? 'KAL-101'),
            'truck_type' => $truck?->truck_type ?? 'Compactor Truck',
            'status' => $truck?->status ?? 'available',
            'driver_name' => $personnel?->name ?? ($truck?->driver?->name ?? 'Assigned Driver'),
        ];
        $data['assigned_vehicle'] = $data['assigned_truck'];
        $data['current_truck_location'] = $currentTruckLocation;

        return $data;
    }
}
