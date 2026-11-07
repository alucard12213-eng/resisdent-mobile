<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Barangay;
use App\Models\CollectionRoute;
use App\Models\TruckLocation;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class CollectionRouteController extends Controller
{
    /*
    |--------------------------------------------------------------------------
    | GET COLLECTION ROUTES (used live and for the Archives view)
    |--------------------------------------------------------------------------
    */

    public function index(Request $request)
    {
        $query = CollectionRoute::with([
            'truck:id,truck_number,plate_number,truck_type,status,driver_id',
            'truck.driver:id,name',
            'barangay:id,name',
        ]);

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $matchingIds = ScheduleController::resolveBarangayFilterIds($request);
        if (!empty($matchingIds)) {
            $query->whereIn('barangay_id', $matchingIds);
        }

        if ($request->filled('date_from')) {
            $query->whereDate('collection_date', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $query->whereDate('collection_date', '<=', $request->date_to);
        }

        $routes = $query
            ->latest('collection_date')
            ->get()
            ->map(function (CollectionRoute $route) {
                return self::enrichRouteItem($route);
            });

        return response()->json([
            'success' => true,
            'message' => 'Collection routes retrieved successfully.',
            'count' => $routes->count(),
            'routes' => $routes,
        ]);
    }


    /*
    |--------------------------------------------------------------------------
    | CREATE COLLECTION ROUTE
    |--------------------------------------------------------------------------
    */

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'truck_id' => 'required|exists:trucks,id',
            'barangay_id' => 'required|exists:barangays,id',
            'collection_date' => 'required|date',
            'start_time' => 'nullable|date_format:H:i',
            'end_time' => 'nullable|date_format:H:i',
            'status' => 'nullable|in:pending,in_progress,completed,cancelled',
            'notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Please check the collection route information.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $route = CollectionRoute::create([
            'truck_id' => $request->truck_id,
            'barangay_id' => $request->barangay_id,
            'collection_date' => $request->collection_date,
            'start_time' => $request->start_time,
            'end_time' => $request->end_time,
            'status' => $request->status ?? 'pending',
            'notes' => $request->notes,
        ]);

        $route->load(['truck:id,truck_number,plate_number,driver_id', 'truck.driver:id,name', 'barangay:id,name']);

        ActivityLog::record(
            'collection_route.created',
            "Scheduled collection route for {$route->collection_date} (truck #{$route->truck_id}).",
            $route
        );

        return response()->json([
            'success' => true,
            'message' => 'Collection route created successfully.',
            'route' => $route,
        ], 201);
    }


    /*
    |--------------------------------------------------------------------------
    | GET SINGLE COLLECTION ROUTE
    |--------------------------------------------------------------------------
    */

    public function show($id)
    {
        $route = CollectionRoute::with([
            'truck:id,truck_number,plate_number,driver_id',
            'truck.driver:id,name',
            'barangay:id,name',
        ])->find($id);

        if (!$route) {
            return response()->json([
                'success' => false,
                'message' => 'Collection route not found.',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'route' => $route,
        ]);
    }


    /*
    |--------------------------------------------------------------------------
    | UPDATE COLLECTION ROUTE
    |--------------------------------------------------------------------------
    */

    public function update(Request $request, $id)
    {
        $route = CollectionRoute::find($id);

        if (!$route) {
            return response()->json([
                'success' => false,
                'message' => 'Collection route not found.',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'truck_id' => 'sometimes|required|exists:trucks,id',
            'barangay_id' => 'sometimes|required|exists:barangays,id',
            'collection_date' => 'sometimes|required|date',
            'start_time' => 'nullable|date_format:H:i',
            'end_time' => 'nullable|date_format:H:i',
            'status' => 'sometimes|required|in:pending,in_progress,completed,cancelled',
            'notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Please check the collection route information.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $route->update($request->only([
            'truck_id',
            'barangay_id',
            'collection_date',
            'start_time',
            'end_time',
            'status',
            'notes',
        ]));

        $route->load(['truck:id,truck_number,plate_number', 'barangay:id,name']);

        ActivityLog::record(
            'collection_route.updated',
            "Updated collection route #{$route->id}.",
            $route
        );

        return response()->json([
            'success' => true,
            'message' => 'Collection route updated successfully.',
            'route' => $route,
        ]);
    }


    /*
    |--------------------------------------------------------------------------
    | DELETE COLLECTION ROUTE
    |--------------------------------------------------------------------------
    */

    public function destroy($id)
    {
        $route = CollectionRoute::find($id);

        if (!$route) {
            return response()->json([
                'success' => false,
                'message' => 'Collection route not found.',
            ], 404);
        }

        $route->delete();

        ActivityLog::record(
            'collection_route.deleted',
            "Deleted collection route #{$id}."
        );

        return response()->json([
            'success' => true,
            'message' => 'Collection route deleted successfully.',
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | ENRICH COLLECTION ROUTE WITH ROUTE NAME, TRUCK, & LIVE GPS TELEMETRY
    |--------------------------------------------------------------------------
    */
    public static function enrichRouteItem(CollectionRoute $route): array
    {
        $data = $route->toArray();

        $barangayName = $route->barangay?->name ?? '';
        $brgyNum = 12;
        if (preg_match('/(\d+)/', $barangayName, $m)) {
            $brgyNum = (int) $m[1];
        } elseif ($route->barangay_id >= 1 && $route->barangay_id <= 40) {
            $brgyNum = (int) $route->barangay_id;
        }

        $routeDefs = TruckLocationController::getRouteDefinitions();
        $matchedRouteDef = null;
        foreach ($routeDefs as $def) {
            if (in_array($brgyNum, $def['barangays'], true)) {
                $matchedRouteDef = $def;
                break;
            }
        }
        if (!$matchedRouteDef && $route->truck) {
            foreach ($routeDefs as $def) {
                if (
                    $def['plate_number'] === $route->truck->plate_number ||
                    $def['truck_number'] === $route->truck->truck_number
                ) {
                    $matchedRouteDef = $def;
                    break;
                }
            }
        }
        if (!$matchedRouteDef) {
            $matchedRouteDef = $routeDefs[0];
        }

        $rawStart = $route->getRawOriginal('start_time') ?: '08:00:00';
        $startTime = substr((string) $rawStart, 0, 5);

        $rawEnd = $route->getRawOriginal('end_time');
        if ($rawEnd) {
            $endTime = substr((string) $rawEnd, 0, 5);
        } else {
            try {
                $endTime = Carbon::createFromFormat('H:i', $startTime)->addHours(2)->format('H:i');
            } catch (\Throwable) {
                $endTime = '10:00';
            }
        }

        $truck = $route->truck;
        $latestLocation = null;
        if ($truck) {
            $latestLocation = TruckLocation::where('truck_id', $truck->id)
                ->latest('recorded_at')
                ->first();
        }

        $now = now();
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

        $dateStr = $route->collection_date ? Carbon::parse($route->collection_date)->toDateString() : $now->toDateString();
        $effectiveStatus = $route->status ?: 'pending';
        $routeStops = array_map(
            fn ($num) => "Barangay {$num}",
            $matchedRouteDef['barangays'] ?? [$brgyNum]
        );

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

        $data['barangay_name'] = $barangayName ?: "Barangay {$brgyNum}";
        $data['collection_date'] = $dateStr;
        $data['start_time'] = $startTime;
        $data['end_time'] = $endTime;
        $data['route_number'] = $matchedRouteDef['route_number'] ?? 1;
        $data['route_name'] = $matchedRouteDef['name'] ?? 'Route 1: Poblacion';
        $data['route_description'] = $matchedRouteDef['description'] ?? '';
        $data['route_stops'] = $routeStops;
        $data['estimated_arrival'] = $estimatedArrival;
        $data['collection_status'] = $effectiveStatus;
        $data['assigned_truck'] = [
            'id' => $truck?->id,
            'truck_number' => $truck?->truck_number ?? ($matchedRouteDef['truck_number'] ?? 'TRK-01'),
            'plate_number' => $truck?->plate_number ?? ($matchedRouteDef['plate_number'] ?? 'KAL-101'),
            'truck_type' => $truck?->truck_type ?? 'Compactor Truck',
            'status' => $truck?->status ?? 'available',
            'driver_name' => $truck?->driver?->name ?? 'Assigned Driver',
        ];
        $data['current_truck_location'] = $currentTruckLocation;

        return $data;
    }
}
