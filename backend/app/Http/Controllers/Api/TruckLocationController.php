<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Barangay;
use App\Models\CollectionLog;
use App\Models\CollectionRoute;
use App\Models\Truck;
use App\Models\TruckLocation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class TruckLocationController extends Controller
{
    /*
    |--------------------------------------------------------------------------
    | CDO POBLACION ROUTE MASTER DEFINITIONS (Sectors 1 to 4)
    |--------------------------------------------------------------------------
    */
    public static function getRouteDefinitions(): array
    {
        return [
            [
                'route_number' => 1,
                'name' => 'Route 1: North Poblacion',
                'description' => 'City Health, Fernandez, Burgos, Port Access, Gaabucayan',
                'truck_number' => 'TRK-01',
                'plate_number' => 'KAL-101',
                'color' => '#16a34a', // Emerald Green
                'barangays' => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
                'waypoints' => [
                    [8.4822, 124.6472], // Brgy 1
                    [8.4835, 124.6480], // Brgy 2
                    [8.4842, 124.6495], // Brgy 3
                    [8.4850, 124.6470], // Brgy 8
                    [8.4865, 124.6485], // Brgy 9
                    [8.4875, 124.6500], // Brgy 10
                    [8.4815, 124.6455], // Brgy 4
                    [8.4800, 124.6440], // Brgy 5
                    [8.4785, 124.6460], // Brgy 6
                    [8.4795, 124.6490], // Brgy 7
                ]
            ],
            [
                'route_number' => 2,
                'name' => 'Route 2: Central Poblacion',
                'description' => 'Tirso Neri Heritage, JR Borja, Cogon Market Periphery, Limketkai',
                'truck_number' => 'TRK-02',
                'plate_number' => 'KAL-102',
                'color' => '#2563eb', // Royal Blue
                'barangays' => [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
                'waypoints' => [
                    [8.4770, 124.6450], // Brgy 11
                    [8.4760, 124.6470], // Brgy 12
                    [8.4740, 124.6465], // Brgy 14
                    [8.4730, 124.6480], // Brgy 15
                    [8.4755, 124.6495], // Brgy 13
                    [8.4725, 124.6510], // Brgy 16
                    [8.4745, 124.6525], // Brgy 17
                    [8.4760, 124.6540], // Brgy 18
                    [8.4775, 124.6520], // Brgy 19
                    [8.4790, 124.6535], // Brgy 20
                ]
            ],
            [
                'route_number' => 3,
                'name' => 'Route 3: East Poblacion',
                'description' => 'Agora Terminal, Provincial Capitol, Velez Central, Daumar St',
                'truck_number' => 'TRK-03',
                'plate_number' => 'KAL-103',
                'color' => '#d97706', // Amber / Orange
                'barangays' => [21, 22, 23, 24, 25, 26, 27, 28, 29, 30],
                'waypoints' => [
                    [8.4810, 124.6550], // Brgy 21
                    [8.4825, 124.6565], // Brgy 22
                    [8.4840, 124.6550], // Brgy 23
                    [8.4855, 124.6530], // Brgy 24
                    [8.4830, 124.6515], // Brgy 25
                    [8.4815, 124.6500], // Brgy 26
                    [8.4800, 124.6510], // Brgy 27
                    [8.4780, 124.6505], // Brgy 28
                    [8.4765, 124.6515], // Brgy 29
                    [8.4750, 124.6530], // Brgy 30
                ]
            ],
            [
                'route_number' => 4,
                'name' => 'Route 4: South Poblacion',
                'description' => 'Cogon Market, Gaston Park, Carmen Bridge, Victoria, Macabalan',
                'truck_number' => 'TRK-04',
                'plate_number' => 'KAL-104',
                'color' => '#9333ea', // Purple
                'barangays' => [31, 32, 33, 34, 35, 36, 37, 38, 39, 40],
                'waypoints' => [
                    [8.4735, 124.6545], // Brgy 31
                    [8.4720, 124.6535], // Brgy 32
                    [8.4710, 124.6520], // Brgy 33
                    [8.4705, 124.6500], // Brgy 34
                    [8.4695, 124.6485], // Brgy 35
                    [8.4715, 124.6470], // Brgy 36
                    [8.4730, 124.6455], // Brgy 37
                    [8.4745, 124.6440], // Brgy 38
                    [8.4760, 124.6425], // Brgy 39
                    [8.4780, 124.6410], // Brgy 40
                ]
            ]
        ];
    }

    /*
    |--------------------------------------------------------------------------
    | GET LOCATION HISTORY FOR A TRUCK
    |--------------------------------------------------------------------------
    */
    public function index(Request $request, $truckId)
    {
        $truck = Truck::find($truckId);

        if (!$truck) {
            $truck = Truck::where('plate_number', $truckId)->first();
        }

        if (!$truck) {
            return response()->json([
                'success' => false,
                'message' => 'Truck not found.',
            ], 404);
        }

        $limit = $request->integer('limit', 50);
        $locations = $truck->locations()
            ->latest('recorded_at')
            ->limit($limit)
            ->get();

        return response()->json([
            'success' => true,
            'message' => 'Truck locations retrieved successfully.',
            'truck' => [
                'id' => $truck->id,
                'truck_number' => $truck->truck_number,
                'plate_number' => $truck->plate_number,
                'status' => $truck->status,
            ],
            'locations' => $locations,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | RECORD A NEW LOCATION PING FOR A SPECIFIC TRUCK ID
    |--------------------------------------------------------------------------
    */
    public function store(Request $request, $truckId)
    {
        $truck = Truck::find($truckId);

        if (!$truck) {
            $truck = Truck::where('plate_number', $truckId)->first();
        }

        if (!$truck) {
            return response()->json([
                'success' => false,
                'message' => 'Truck not found.',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'latitude' => 'required|numeric|between:-90,90',
            'longitude' => 'required|numeric|between:-180,180',
            'speed' => 'nullable|numeric|min:0',
            'heading' => 'nullable|numeric|min:0|max:360',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Please provide a valid location.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $recordedAt = now();
        $location = TruckLocation::create([
            'truck_id' => $truck->id,
            'latitude' => $request->latitude,
            'longitude' => $request->longitude,
            'speed' => $request->speed ?? 0,
            'heading' => $request->heading ?? 0,
            'recorded_at' => $recordedAt,
        ]);

        // When truck begins recording location, ensure status is 'on_route'
        if ($truck->status !== 'on_route') {
            $truck->status = 'on_route';
            $truck->save();
        }

        return response()->json([
            'success' => true,
            'message' => 'Truck location recorded successfully.',
            'location' => $location,
            'truck' => [
                'id' => $truck->id,
                'truck_number' => $truck->truck_number,
                'plate_number' => $truck->plate_number,
                'status' => $truck->status,
            ],
        ], 201);
    }

    /*
    |--------------------------------------------------------------------------
    | RECORD DRIVER LOCATION PING (Automatic recording from mobile app)
    |--------------------------------------------------------------------------
    | Triggered automatically when driver starts route or moves along the route.
    | Handles truck lookup, location persist, status auto-sync, route start time,
    | and telemetry tracking.
    */
    public function recordDriverLocation(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'latitude' => 'required|numeric|between:-90,90',
            'longitude' => 'required|numeric|between:-180,180',
            'speed' => 'nullable|numeric|min:0',
            'heading' => 'nullable|numeric|min:0|max:360',
            'plate_number' => 'nullable|string',
            'truck_id' => 'nullable|integer',
            'status' => 'nullable|in:available,on_route,maintenance,inactive',
            'notes' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid location coordinates.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $user = $request->user();
        $truckId = $request->input('truck_id');
        $plate = $request->input('plate_number');

        $truck = null;
        if ($truckId) {
            $truck = Truck::find($truckId);
        }
        if (!$truck && $plate) {
            $truck = Truck::where('plate_number', $plate)->first();
        }
        if (!$truck && $user) {
            $truck = Truck::where('driver_id', $user->id)->first();
        }
        if (!$truck) {
            // Default to TRK-04 KAL-104 (standard driver truck in CDO)
            $truck = Truck::where('plate_number', 'KAL-104')->first() ?: Truck::first();
        }

        if (!$truck) {
            // Create fallback truck if database is empty
            $truck = Truck::create([
                'truck_number' => 'TRK-04',
                'plate_number' => 'KAL-104',
                'truck_type' => 'Compactor Truck',
                'status' => 'on_route',
            ]);
        }

        $now = now();
        $location = TruckLocation::create([
            'truck_id' => $truck->id,
            'latitude' => $request->latitude,
            'longitude' => $request->longitude,
            'speed' => $request->speed ?? 0,
            'heading' => $request->heading ?? 0,
            'recorded_at' => $now,
        ]);

        $statusToSet = $request->input('status', 'on_route');
        if ($truck->status !== $statusToSet) {
            $truck->status = $statusToSet;
            $truck->save();
        }

        // Synchronize driver model status
        $driverUserId = $truck->driver_id ?: ($user?->id ?? null);
        if ($driverUserId) {
            try {
                \App\Models\Driver::where('user_id', $driverUserId)->update([
                    'status' => $statusToSet === 'on_route' ? 'on_route' : 'available',
                    'status_updated_at' => $now,
                ]);
            } catch (\Throwable) {}
        }

        // Synchronize today's Collection Route
        try {
            $todayDate = $now->toDateString();
            $route = CollectionRoute::where('truck_id', $truck->id)
                ->whereDate('collection_date', $todayDate)
                ->latest()
                ->first();

            if (!$route && $statusToSet === 'on_route') {
                // Auto-create active route for today
                $brgyId = 34; // Default CDO sector stop
                $brgy = Barangay::where('name', 'like', '%Barangay 34%')->first() ?: Barangay::first();
                if ($brgy) $brgyId = $brgy->id;

                $route = CollectionRoute::create([
                    'truck_id' => $truck->id,
                    'barangay_id' => $brgyId,
                    'collection_date' => $todayDate,
                    'start_time' => $now->format('H:i:s'),
                    'status' => 'in_progress',
                    'notes' => 'Mobile route collection recording started.',
                ]);
            } elseif ($route) {
                if ($statusToSet === 'on_route' && $route->status !== 'in_progress') {
                    $route->status = 'in_progress';
                    if (!$route->start_time) {
                        $route->start_time = $now->format('H:i:s');
                    }
                    $route->save();
                }
            }
        } catch (\Throwable) {}

        return response()->json([
            'success' => true,
            'message' => 'Live truck route ping recorded successfully.',
            'location' => $location,
            'truck' => [
                'id' => $truck->id,
                'truck_number' => $truck->truck_number,
                'plate_number' => $truck->plate_number,
                'status' => $truck->status,
                'driver_name' => $truck->driver?->name ?? ($user?->name ?? 'John Driver'),
            ],
            'recorded_at' => $now->toIso8601String(),
        ], 201);
    }

    /*
    |--------------------------------------------------------------------------
    | LIVE TRACKING FEED FOR SUPERADMIN DASHBOARD
    |--------------------------------------------------------------------------
    | Returns all trucks with latest GPS coordinates, active route, driver,
    | recent breadcrumbs polyline trail, today's weight, and fleet summary.
    */
    public function liveTracking(Request $request)
    {
        $routeDefs = self::getRouteDefinitions();
        $routesByPlate = [];
        $routesByNum = [];
        foreach ($routeDefs as $def) {
            $routesByPlate[$def['plate_number']] = $def;
            $routesByNum[$def['truck_number']] = $def;
        }

        $trucks = Truck::with([
            'driver:id,name,email',
            'contractor:id,company_name',
        ])
        ->orderBy('truck_number')
        ->get();

        // Default seed trucks if none in database
        if ($trucks->isEmpty()) {
            $mockPlates = [
                ['TRK-01', 'KAL-101', 'available', 'Compactor'],
                ['TRK-02', 'KAL-102', 'available', 'Dump Truck'],
                ['TRK-03', 'KAL-103', 'available', 'Mini Compactor'],
                ['TRK-04', 'KAL-104', 'on_route', 'Compactor Truck'],
            ];
            foreach ($mockPlates as $m) {
                Truck::firstOrCreate(
                    ['truck_number' => $m[0]],
                    ['plate_number' => $m[1], 'status' => $m[2], 'truck_type' => $m[3]]
                );
            }
            $trucks = Truck::with(['driver:id,name,email'])->orderBy('truck_number')->get();
        }

        $now = now();
        $todayDate = $now->toDateString();
        $activeCount = 0;

        $enrichedTrucks = $trucks->map(function ($truck) use ($routesByPlate, $routesByNum, $todayDate, $now, &$activeCount) {
            $plate = $truck->plate_number;
            $trkNum = $truck->truck_number;
            $routeDef = $routesByPlate[$plate] ?? ($routesByNum[$trkNum] ?? null);

            // Fetch latest location
            $latestLoc = $truck->locations()->latest('recorded_at')->first();

            // Fetch recent path breadcrumbs (last 40 points in chronological order)
            $recentLocations = $truck->locations()
                ->latest('recorded_at')
                ->limit(40)
                ->get()
                ->reverse()
                ->values()
                ->map(function ($loc) {
                    return [
                        'latitude' => (float) $loc->latitude,
                        'longitude' => (float) $loc->longitude,
                        'speed' => (float) ($loc->speed ?? 0),
                        'heading' => (float) ($loc->heading ?? 0),
                        'recorded_at' => $loc->recorded_at ? $loc->recorded_at->toIso8601String() : null,
                    ];
                });

            // Default baseline coordinate if no location ping has been recorded yet
            $baselineCoord = $routeDef['waypoints'][0] ?? [8.4822, 124.6472];
            $currentLat = $latestLoc ? (float) $latestLoc->latitude : (float) $baselineCoord[0];
            $currentLng = $latestLoc ? (float) $latestLoc->longitude : (float) $baselineCoord[1];
            $currentSpeed = $latestLoc ? (float) ($latestLoc->speed ?? 0) : ($truck->status === 'on_route' ? 18.5 : 0);
            $currentHeading = $latestLoc ? (float) ($latestLoc->heading ?? 0) : 90;
            $lastRecordedAt = $latestLoc ? $latestLoc->recorded_at : null;

            // Compute time ago in minutes / seconds
            $timeAgoText = 'Depot Standby';
            $isLivePing = false;
            if ($lastRecordedAt) {
                $diffSec = $now->diffInSeconds($lastRecordedAt);
                if ($diffSec < 60) {
                    $timeAgoText = "{$diffSec}s ago";
                    $isLivePing = true;
                } elseif ($diffSec < 3600) {
                    $timeAgoText = round($diffSec / 60) . "m ago";
                    $isLivePing = $diffSec < 900; // <15 min
                } else {
                    $timeAgoText = round($diffSec / 3600) . "h ago";
                }
            }

            $isOnRoute = $truck->status === 'on_route';
            if ($isOnRoute) {
                $activeCount++;
            }

            // Today's total weight collected
            $todayTons = (float) CollectionLog::where('truck_id', $truck->id)
                ->whereDate('created_at', $todayDate)
                ->sum('amount_collected');

            // Today's Collection Route status
            $todayRoute = CollectionRoute::where('truck_id', $truck->id)
                ->whereDate('collection_date', $todayDate)
                ->latest()
                ->first();

            return [
                'id' => $truck->id,
                'truck_number' => $truck->truck_number,
                'plate_number' => $truck->plate_number,
                'truck_type' => $truck->truck_type ?? 'Compactor',
                'status' => $truck->status,
                'is_on_route' => $isOnRoute,
                'is_live' => $isLivePing || $isOnRoute,
                'driver_name' => $truck->driver?->name ?? 'John Driver (Assigned)',
                'driver_email' => $truck->driver?->email ?? null,
                'current_location' => [
                    'latitude' => $currentLat,
                    'longitude' => $currentLng,
                    'speed' => $currentSpeed,
                    'heading' => $currentHeading,
                    'recorded_at' => $lastRecordedAt ? $lastRecordedAt->toIso8601String() : null,
                    'time_ago' => $timeAgoText,
                ],
                'breadcrumbs' => $recentLocations,
                'route_info' => $routeDef ? [
                    'route_number' => $routeDef['route_number'],
                    'name' => $routeDef['name'],
                    'description' => $routeDef['description'],
                    'color' => $routeDef['color'],
                    'barangays' => $routeDef['barangays'],
                    'designated_waypoints' => $routeDef['waypoints'],
                ] : null,
                'today_weight_tons' => round($todayTons, 2),
                'route_status' => $todayRoute ? $todayRoute->status : ($isOnRoute ? 'in_progress' : 'standby'),
                'start_time' => $todayRoute && $todayRoute->getRawOriginal('start_time')
                    ? substr((string) $todayRoute->getRawOriginal('start_time'), 0, 5)
                    : ($isOnRoute ? '08:00' : null),
                'end_time' => $todayRoute && $todayRoute->getRawOriginal('end_time')
                    ? substr((string) $todayRoute->getRawOriginal('end_time'), 0, 5)
                    : ($isOnRoute ? '10:00' : null),
            ];
        });

        return response()->json([
            'success' => true,
            'timestamp' => $now->toIso8601String(),
            'active_on_route' => $activeCount,
            'total_trucks' => $trucks->count(),
            'trucks' => $enrichedTrucks,
            'routes' => $routeDefs,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | CDO ROUTE CORRIDORS & BARANGAYS MAP DATA
    |--------------------------------------------------------------------------
    */
    public function routesMap(Request $request)
    {
        $routes = self::getRouteDefinitions();
        $barangays = Barangay::select(['id', 'name', 'code', 'latitude', 'longitude'])
            ->get();

        return response()->json([
            'success' => true,
            'routes' => $routes,
            'barangays' => $barangays,
        ]);
    }
}
