<?php

namespace Database\Seeders;

use App\Models\ActivityLog;
use App\Models\Barangay;
use App\Models\CollectionRoute;
use App\Models\CollectionSchedule;
use App\Models\Inspection;
use App\Models\Report;
use App\Models\Role;
use App\Models\Truck;
use App\Models\TruckLocation;
use App\Models\User;
use App\Models\Vendor;
use App\Models\Violation;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class OverviewDataSeeder extends Seeder
{
    public function run(): void
    {
        $today = Carbon::today();
        $todayStr = $today->toDateString();

        // 1. Roles
        $driverRole = Role::firstOrCreate(['name' => 'driver'], ['description' => 'Garbage truck driver']);
        $inspectorRole = Role::firstOrCreate(['name' => 'inspector'], ['description' => 'Sanitation inspector']);
        $residentRole = Role::firstOrCreate(['name' => 'resident'], ['description' => 'Resident user']);
        $vendorRole = Role::firstOrCreate(['name' => 'vendor'], ['description' => 'Public market vendor']);

        // 2. Personnel: Drivers & Inspectors
        $driver1 = $this->createOrGetUser('Juan Driver', 'juan.driver@katokkalinis.com', 'Driver@123', $driverRole->id);
        $driver2 = $this->createOrGetUser('Ramon Bautista', 'ramon.driver@katokkalinis.com', 'Driver@123', $driverRole->id);
        $driver3 = $this->createOrGetUser('Carlos Mendoza', 'carlos.driver@katokkalinis.com', 'Driver@123', $driverRole->id);

        $inspector1 = $this->createOrGetUser('Maria Inspector', 'maria.inspector@katokkalinis.com', 'Inspector@123', $inspectorRole->id);
        $inspector2 = $this->createOrGetUser('John Inspector', 'inspector@katokkalinis.com', 'Inspector@123', $inspectorRole->id);

        // 3. Trucks
        $truck1 = Truck::updateOrCreate(
            ['truck_number' => 'TRK-01'],
            [
                'plate_number' => 'KAL-101',
                'driver_id' => $driver1->id,
                'truck_type' => 'Compactor',
                'status' => 'available',
            ]
        );

        $truck2 = Truck::updateOrCreate(
            ['truck_number' => 'TRK-02'],
            [
                'plate_number' => 'KAL-102',
                'driver_id' => $driver2->id,
                'truck_type' => 'Dump Truck',
                'status' => 'on_route',
            ]
        );

        $truck3 = Truck::updateOrCreate(
            ['truck_number' => 'TRK-03'],
            [
                'plate_number' => 'KAL-103',
                'driver_id' => $driver1->id,
                'truck_type' => 'Compactor Truck',
                'status' => 'available',
            ]
        );

        $truck4 = Truck::updateOrCreate(
            ['truck_number' => 'TRK-04'],
            [
                'plate_number' => 'KAL-104',
                'driver_id' => $driver3->id,
                'truck_type' => 'Compactor Truck',
                'status' => 'on_route',
            ]
        );

        // Live GPS Locations for Fleet Trucks
        TruckLocation::updateOrCreate(
            ['truck_id' => $truck1->id],
            [
                'latitude' => 8.48220,
                'longitude' => 124.64720,
                'speed' => 14.2,
                'heading' => 85.0,
                'recorded_at' => now()->subMinutes(2),
            ]
        );

        TruckLocation::updateOrCreate(
            ['truck_id' => $truck2->id],
            [
                'latitude' => 8.47890,
                'longitude' => 124.64520,
                'speed' => 18.6,
                'heading' => 110.0,
                'recorded_at' => now()->subMinutes(1),
            ]
        );

        TruckLocation::updateOrCreate(
            ['truck_id' => $truck3->id],
            [
                'latitude' => 8.48100,
                'longitude' => 124.65500,
                'speed' => 0.0,
                'heading' => 0.0,
                'recorded_at' => now()->subMinutes(8),
            ]
        );

        TruckLocation::updateOrCreate(
            ['truck_id' => $truck4->id],
            [
                'latitude' => 8.47520,
                'longitude' => 124.65120,
                'speed' => 21.4,
                'heading' => 180.0,
                'recorded_at' => now()->subSeconds(30),
            ]
        );

        // 4. Barangays
        $brgy1 = Barangay::where('name', 'Barangay 1')->first() ?: Barangay::first();
        $brgy2 = Barangay::where('name', 'Barangay 2')->first() ?: $brgy1;
        $brgy3 = Barangay::where('name', 'Barangay 3')->first() ?: $brgy1;
        $brgy4 = Barangay::where('name', 'Barangay 4')->first() ?: $brgy1;
        $brgy12 = Barangay::where('name', 'Barangay 12')->first() ?: $brgy1;

        // 5. Residents
        $res1 = $this->createOrGetUser('Jane Doe', 'jane.doe@katokkalinis.com', 'Resident@123', $residentRole->id, '09171234561', $brgy1->name);
        $res2 = $this->createOrGetUser('Pedro Penduko', 'pedro.p@katokkalinis.com', 'Resident@123', $residentRole->id, '09181234562', $brgy2->name);
        $res3 = $this->createOrGetUser('Liza Soberano', 'liza.s@katokkalinis.com', 'Resident@123', $residentRole->id, '09191234563', $brgy3->name);
        $res4 = $this->createOrGetUser('Mark Santos', 'mark.s@katokkalinis.com', 'Resident@123', $residentRole->id, '09201234564', $brgy4->name);
        $res5 = $this->createOrGetUser('Elena Cruz', 'elena.c@katokkalinis.com', 'Resident@123', $residentRole->id, '09211234565', $brgy12->name);

        // 6. Vendors
        $vendorUser1 = $this->createOrGetUser('Juan Dela Cruz', 'vendor@katokkalinis.com', 'Vendor@123', $vendorRole->id, '09467802940', $brgy1->name);
        $vendorUser2 = $this->createOrGetUser('Aling Nena Store', 'aling.nena@katokkalinis.com', 'Vendor@123', $vendorRole->id, '09351234567', $brgy2->name);
        $vendorUser3 = $this->createOrGetUser('Mang Tomas Meat', 'mang.tomas@katokkalinis.com', 'Vendor@123', $vendorRole->id, '09471234568', $brgy3->name);
        $vendorUser4 = $this->createOrGetUser('Cogon Dry Goods', 'cogon.goods@katokkalinis.com', 'Vendor@123', $vendorRole->id, '09561234569', $brgy4->name);
        $vendorUser5 = $this->createOrGetUser('Carmen Fresh Veggies', 'carmen.veg@katokkalinis.com', 'Vendor@123', $vendorRole->id, '09661234570', $brgy12->name);

        $v1 = Vendor::updateOrCreate(
            ['vendor_code' => 'VND-COG-001'],
            [
                'user_id' => $vendorUser1->id,
                'barangay_id' => $brgy1->id,
                'business_name' => 'KatokKalimpyo Fruit Stall',
                'owner_name' => 'Juan Dela Cruz',
                'market' => 'Cogon Public Market',
                'stall_number' => 'Stall #12',
                'contact_number' => '09467802940',
                'address' => 'Barangay 1, Cogon',
                'qr_code' => 'KK-QR-COG-1-12-8f92b7c4e019a3d42e617b8c',
                'status' => 'active',
            ]
        );

        $v2 = Vendor::updateOrCreate(
            ['vendor_code' => 'VND-COG-002'],
            [
                'user_id' => $vendorUser2->id,
                'barangay_id' => $brgy2->id,
                'business_name' => 'Aling Nena Sari-Sari Store',
                'owner_name' => 'Nena Santos',
                'market' => 'Cogon Public Market',
                'stall_number' => 'Stall #45',
                'contact_number' => '09351234567',
                'address' => 'Barangay 2, Cogon',
                'qr_code' => 'KK-QR-COG-2-45-7e84b912c40a581e9d0b6f34',
                'status' => 'active',
            ]
        );

        $v3 = Vendor::updateOrCreate(
            ['vendor_code' => 'VND-CAR-001'],
            [
                'user_id' => $vendorUser3->id,
                'barangay_id' => $brgy3->id,
                'business_name' => 'Mang Tomas Fresh Meat Section',
                'owner_name' => 'Tomas Rodriguez',
                'market' => 'Carmen Public Market',
                'stall_number' => 'Wet Section #08',
                'contact_number' => '09471234568',
                'address' => 'Barangay 3, Carmen',
                'qr_code' => 'KK-QR-CAR-3-08-3a91e5d7c82b406f157a92de',
                'status' => 'active',
            ]
        );

        $v4 = Vendor::updateOrCreate(
            ['vendor_code' => 'VND-COG-003'],
            [
                'user_id' => $vendorUser4->id,
                'barangay_id' => $brgy4->id,
                'business_name' => 'Cogon Dry Goods & Apparel',
                'owner_name' => 'Clara Reyes',
                'market' => 'Cogon Public Market',
                'stall_number' => 'Stall #102',
                'contact_number' => '09561234569',
                'address' => 'Barangay 4, Cogon',
                'qr_code' => 'KK-QR-COG-4-102-6c28f149b037e951a4d80e72',
                'status' => 'active',
            ]
        );

        $v5 = Vendor::updateOrCreate(
            ['vendor_code' => 'VND-CAR-002'],
            [
                'user_id' => $vendorUser5->id,
                'barangay_id' => $brgy12->id,
                'business_name' => 'Carmen Fresh Vegetables Hub',
                'owner_name' => 'Ricardo Dalisay',
                'market' => 'Carmen Public Market',
                'stall_number' => 'Stall #15',
                'contact_number' => '09661234570',
                'address' => 'Barangay 12, Carmen',
                'qr_code' => 'KK-QR-CAR-5-15-9d41b638e072f51a3c89b047',
                'status' => 'active',
            ]
        );

        // 7. Vendor Inspections (Different score brackets for compliance summary)
        Inspection::updateOrCreate(
            ['vendor_id' => $v1->id, 'inspected_at' => $today->copy()->subDays(2)->toDateString()],
            [
                'inspector_id' => $inspector1->id,
                'hygiene_system' => 95,
                'condition_of_premises' => 90,
                'total_score' => 92, // Excellent (>= 80)
                'compliance_level' => 92,
                'notes' => 'Excellent segregation, covered bins with municipal color-coded liners.',
                'status' => 'completed',
                'decision' => 'accepted',
            ]
        );

        Inspection::updateOrCreate(
            ['vendor_id' => $v2->id, 'inspected_at' => $today->copy()->subDays(1)->toDateString()],
            [
                'inspector_id' => $inspector2->id,
                'hygiene_system' => 85,
                'condition_of_premises' => 80,
                'total_score' => 82, // Excellent (>= 80)
                'compliance_level' => 82,
                'notes' => 'Good sanitation and proper waste bin segregation.',
                'status' => 'completed',
                'decision' => 'accepted',
            ]
        );

        Inspection::updateOrCreate(
            ['vendor_id' => $v3->id, 'inspected_at' => $today->copy()->subDays(3)->toDateString()],
            [
                'inspector_id' => $inspector1->id,
                'hygiene_system' => 70,
                'condition_of_premises' => 65,
                'total_score' => 68, // Needs Attention (60-79)
                'compliance_level' => 68,
                'notes' => 'Minor grease trap overflow. Requires secondary inspection within 5 days.',
                'status' => 'completed',
                'decision' => 'accepted',
            ]
        );

        Inspection::updateOrCreate(
            ['vendor_id' => $v4->id, 'inspected_at' => $today->copy()->subDays(4)->toDateString()],
            [
                'inspector_id' => $inspector2->id,
                'hygiene_system' => 50,
                'condition_of_premises' => 45,
                'total_score' => 48, // Non-compliant (< 60)
                'compliance_level' => 48,
                'notes' => 'Unsegregated refuse piled outside stall. Sanitary violation notice issued.',
                'status' => 'completed',
                'decision' => 'rejected',
            ]
        );

        Inspection::updateOrCreate(
            ['vendor_id' => $v5->id, 'inspected_at' => $today->copy()->toDateString()],
            [
                'inspector_id' => $inspector1->id,
                'hygiene_system' => 88,
                'condition_of_premises' => 84,
                'total_score' => 86, // Excellent (>= 80)
                'compliance_level' => 86,
                'notes' => 'Vegetable trimming waste stored in compostable bins.',
                'status' => 'completed',
                'decision' => 'accepted',
            ]
        );

        // 7b. Permitted Violations Information in shared violations table
        $inspV3 = Inspection::where('vendor_id', $v3->id)->latest('inspected_at')->first();
        $inspV4 = Inspection::where('vendor_id', $v4->id)->latest('inspected_at')->first();

        Violation::updateOrCreate(
            ['vendor_id' => $v3->id, 'violation_type' => 'Secondary Drainage & Grease Trap Maintenance'],
            [
                'inspection_id' => $inspV3?->id,
                'description' => 'Scheduled grease trap desludging required within 5 days per City Market Sanitation Code.',
                'penalty' => 'Official Warning',
                'corrective_action' => 'Clean and desludge stall grease trap within 5 days.',
                'status' => 'pending',
            ]
        );

        Violation::updateOrCreate(
            ['vendor_id' => $v4->id, 'violation_type' => 'Improper Solid Waste Segregation'],
            [
                'inspection_id' => $inspV4?->id,
                'description' => 'Failure to separate biodegradable and residual packaging in color-coded liners.',
                'penalty' => 'Sanitary Citation Notice (₱500)',
                'corrective_action' => 'Provide covered color-coded biodegradable and residual bins immediately.',
                'status' => 'pending',
            ]
        );

        // 8. Collection Routes (Today's progress + Past week completed runs with times)
        // Past week runs
        CollectionRoute::updateOrCreate(
            ['truck_id' => $truck1->id, 'collection_date' => $today->copy()->subDays(3)->toDateString()],
            [
                'barangay_id' => $brgy1->id,
                'start_time' => '07:30',
                'end_time' => '09:45', // 2.25 hrs
                'status' => 'completed',
                'notes' => 'Full Poblacion route cleared.',
            ]
        );

        CollectionRoute::updateOrCreate(
            ['truck_id' => $truck2->id, 'collection_date' => $today->copy()->subDays(2)->toDateString()],
            [
                'barangay_id' => $brgy2->id,
                'start_time' => '08:00',
                'end_time' => '09:50', // 1.83 hrs
                'status' => 'completed',
                'notes' => 'Commercial sector emptied.',
            ]
        );

        CollectionRoute::updateOrCreate(
            ['truck_id' => $truck4->id, 'collection_date' => $today->copy()->subDays(1)->toDateString()],
            [
                'barangay_id' => $brgy3->id,
                'start_time' => '08:15',
                'end_time' => '10:00', // 1.75 hrs
                'status' => 'completed',
                'notes' => 'Wet market perimeter collection complete.',
            ]
        );

        // Today's runs (feeds Today's Collection Progress e.g. 3 of 5 stops completed)
        CollectionRoute::updateOrCreate(
            ['truck_id' => $truck1->id, 'collection_date' => $todayStr, 'start_time' => '07:00'],
            [
                'barangay_id' => $brgy1->id,
                'end_time' => '08:45',
                'status' => 'completed',
                'notes' => 'Stop 1 of 4: Barangay 1 Civic Center cleared.',
            ]
        );

        CollectionRoute::updateOrCreate(
            ['truck_id' => $truck4->id, 'collection_date' => $todayStr, 'start_time' => '08:50'],
            [
                'barangay_id' => $brgy2->id,
                'end_time' => '10:15',
                'status' => 'completed',
                'notes' => 'Stop 2 of 4: Barangay 2 Main Ave cleared.',
            ]
        );

        CollectionRoute::updateOrCreate(
            ['truck_id' => $truck2->id, 'collection_date' => $todayStr, 'start_time' => '10:30'],
            [
                'barangay_id' => $brgy3->id,
                'end_time' => '11:45',
                'status' => 'completed',
                'notes' => 'Stop 3 of 4: Barangay 3 Commercial hub cleared.',
            ]
        );

        CollectionRoute::updateOrCreate(
            ['truck_id' => $truck4->id, 'collection_date' => $todayStr, 'start_time' => '13:00'],
            [
                'barangay_id' => $brgy4->id,
                'end_time' => null,
                'status' => 'in_progress',
                'notes' => 'Stop 4 of 4: Active collection in Barangay 4.',
            ]
        );

        CollectionRoute::updateOrCreate(
            ['truck_id' => $truck2->id, 'collection_date' => $todayStr, 'start_time' => '08:00'],
            [
                'barangay_id' => $brgy12->id,
                'end_time' => '10:30',
                'status' => 'in_progress',
                'notes' => 'Route 2 Central Poblacion: Active residential & commercial collection in Barangay 12.',
            ]
        );

        // 9. Collection Schedules (Upcoming Runs)
        CollectionSchedule::updateOrCreate(
            ['barangay_id' => $brgy1->id, 'date' => $todayStr, 'pickup_time' => '07:00'],
            [
                'day' => $today->format('l'),
                'schedule_type' => 'Biodegradable & Commercial',
                'status' => 'completed',
                'active' => true,
            ]
        );

        CollectionSchedule::updateOrCreate(
            ['barangay_id' => $brgy2->id, 'date' => $todayStr, 'pickup_time' => '08:30'],
            [
                'day' => $today->format('l'),
                'schedule_type' => 'Residual & Residential',
                'status' => 'completed',
                'active' => true,
            ]
        );

        CollectionSchedule::updateOrCreate(
            ['barangay_id' => $brgy3->id, 'date' => $todayStr, 'pickup_time' => '10:30'],
            [
                'day' => $today->format('l'),
                'schedule_type' => 'Recyclable Packaging',
                'status' => 'completed',
                'active' => true,
            ]
        );

        CollectionSchedule::updateOrCreate(
            ['barangay_id' => $brgy4->id, 'date' => $todayStr, 'pickup_time' => '13:00'],
            [
                'day' => $today->format('l'),
                'schedule_type' => 'Market & Commercial',
                'status' => 'in_progress',
                'active' => true,
            ]
        );

        CollectionSchedule::updateOrCreate(
            ['barangay_id' => $brgy12->id, 'date' => $todayStr, 'pickup_time' => '08:00'],
            [
                'day' => $today->format('l'),
                'schedule_type' => 'Central Poblacion Residential & Commercial',
                'status' => 'in_progress',
                'active' => true,
            ]
        );

        // Future Upcoming Runs across Barangays 1-40 so every barangay has an active schedule
        $tomorrow = $today->copy()->addDay();
        $dayAfter = $today->copy()->addDays(2);

        CollectionSchedule::updateOrCreate(
            ['barangay_id' => $brgy1->id, 'date' => $tomorrow->toDateString(), 'pickup_time' => '08:00'],
            [
                'day' => $tomorrow->format('l'),
                'schedule_type' => 'Special Bulky Waste Pickup',
                'status' => 'scheduled',
                'active' => true,
            ]
        );

        CollectionSchedule::updateOrCreate(
            ['barangay_id' => $brgy2->id, 'date' => $dayAfter->toDateString(), 'pickup_time' => '08:30'],
            [
                'day' => $dayAfter->format('l'),
                'schedule_type' => 'Commercial Stalls & Yard Waste',
                'status' => 'scheduled',
                'active' => true,
            ]
        );

        CollectionSchedule::updateOrCreate(
            ['barangay_id' => $brgy12->id, 'date' => $tomorrow->toDateString(), 'pickup_time' => '08:00'],
            [
                'day' => $tomorrow->format('l'),
                'schedule_type' => 'Biodegradable & Residual Collection',
                'status' => 'scheduled',
                'active' => true,
            ]
        );

        CollectionSchedule::updateOrCreate(
            ['barangay_id' => $brgy12->id, 'date' => $dayAfter->toDateString(), 'pickup_time' => '13:30'],
            [
                'day' => $dayAfter->format('l'),
                'schedule_type' => 'Recyclable & Market Corridor Run',
                'status' => 'scheduled',
                'active' => true,
            ]
        );

        for ($num = 1; $num <= 40; $num++) {
            $b = Barangay::where('name', "Barangay {$num}")->first();
            if (!$b) {
                continue;
            }
            $sectorTruck = $num <= 10 ? $truck1 : ($num <= 20 ? $truck2 : ($num <= 30 ? $truck3 : $truck4));
            $offsetDays = ($num % 3);
            $schedDate = $today->copy()->addDays($offsetDays);
            $pickupTime = ($num % 2 === 0) ? '08:00' : '09:30';

            CollectionSchedule::firstOrCreate(
                ['barangay_id' => $b->id, 'date' => $schedDate->toDateString(), 'pickup_time' => $pickupTime],
                [
                    'day' => $schedDate->format('l'),
                    'schedule_type' => 'Scheduled Municipal Solid Waste Collection',
                    'status' => $offsetDays === 0 ? 'in_progress' : 'scheduled',
                    'active' => true,
                ]
            );

            CollectionRoute::firstOrCreate(
                ['truck_id' => $sectorTruck->id, 'barangay_id' => $b->id, 'collection_date' => $schedDate->toDateString()],
                [
                    'start_time' => $pickupTime,
                    'end_time' => ($num % 2 === 0) ? '10:30' : '12:00',
                    'status' => $offsetDays === 0 ? 'in_progress' : 'pending',
                    'notes' => "Assigned Route Corridor run for Barangay {$num}.",
                ]
            );
        }

        // 10. Reports (Active issues + Pending review)
        Report::updateOrCreate(
            ['title' => 'Uncollected commercial waste near fruit stalls'],
            [
                'user_id' => $res1->id,
                'barangay_id' => $brgy1->id,
                'description' => 'Commercial pile accumulating near north market entrance bay. Requires compactor truck clearing.',
                'location' => 'Barangay 1 Market Entrance Bay',
                'status' => 'pending',
                'image' => 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&w=600&q=80',
                'created_at' => now()->subHours(2),
            ]
        );

        Report::updateOrCreate(
            ['title' => 'Damaged segregated waste container'],
            [
                'user_id' => $res2->id,
                'barangay_id' => $brgy2->id,
                'description' => 'Municipal color-coded bin cracked at corner, municipal liner missing.',
                'location' => 'Barangay 2 Capistrano St.',
                'status' => 'pending',
                'image' => 'https://images.unsplash.com/photo-1605600659908-0ef719419d41?auto=format&fit=crop&w=600&q=80',
                'created_at' => now()->subHours(5),
            ]
        );

        Report::updateOrCreate(
            ['title' => 'Illegal roadside dumping along perimeter alley'],
            [
                'user_id' => $res3->id,
                'barangay_id' => $brgy3->id,
                'description' => 'Construction debris and discarded cardboard boxes left on sidewalk overnight.',
                'location' => 'Barangay 3 Velez Extension',
                'status' => 'reviewed',
                'created_at' => now()->subHours(8),
            ]
        );

        Report::updateOrCreate(
            ['title' => 'Missed morning pickup for residential block'],
            [
                'user_id' => $res4->id,
                'barangay_id' => $brgy4->id,
                'description' => 'Truck arrived earlier than 8:00 AM; three bins remained uncollected on Purok 3.',
                'location' => 'Barangay 4 Purok 3',
                'status' => 'reviewed',
                'created_at' => now()->subDay(),
            ]
        );

        Report::updateOrCreate(
            ['title' => 'Garbage pile-up cleared successfully'],
            [
                'user_id' => $res5->id,
                'barangay_id' => $brgy12->id,
                'description' => 'Resolved: CLENRO compactor unit arrived and fully cleared pile at 9:15 AM.',
                'location' => 'Barangay 12 Apolinar Velez St.',
                'status' => 'resolved',
                'created_at' => now()->subDays(2),
            ]
        );

        // 11. Activity Logs (Feeds Recent Activity Feed)
        ActivityLog::firstOrCreate(
            ['action' => 'collection_route.completed', 'description' => 'Driver Juan completed Barangay 1 civic center route.'],
            ['user_id' => $driver1->id, 'created_at' => now()->subMinutes(35)]
        );

        ActivityLog::firstOrCreate(
            ['action' => 'report.created', 'description' => 'New resident report submitted by Jane Doe for Barangay 1.'],
            ['user_id' => $res1->id, 'created_at' => now()->subHours(2)]
        );

        ActivityLog::firstOrCreate(
            ['action' => 'inspection.created', 'description' => 'Maria Inspector recorded inspection for KatokKalimpyo Fruit Stall (Score: 92%).'],
            ['user_id' => $inspector1->id, 'created_at' => now()->subHours(3)]
        );

        ActivityLog::firstOrCreate(
            ['action' => 'vendor.registered', 'description' => 'New vendor Aling Nena Sari-Sari Store registered in Cogon Market.'],
            ['user_id' => $vendorUser2->id, 'created_at' => now()->subHours(6)]
        );

        ActivityLog::firstOrCreate(
            ['action' => 'inspection.decision_updated', 'description' => 'Sanitary inspection approved for Carmen Fresh Vegetables Hub.'],
            ['user_id' => $inspector1->id, 'created_at' => now()->subHours(10)]
        );

        ActivityLog::firstOrCreate(
            ['action' => 'schedule.completed', 'description' => 'Completed scheduled morning route for Barangay 2.'],
            ['user_id' => $driver2->id, 'created_at' => now()->subHours(12)]
        );

        ActivityLog::firstOrCreate(
            ['action' => 'user.registered', 'description' => 'New resident registered: Elena Cruz (Barangay 12).'],
            ['user_id' => $res5->id, 'created_at' => now()->subDay()]
        );
    }

    private function createOrGetUser(
        string $name,
        string $email,
        string $password,
        int $roleId,
        ?string $phone = null,
        ?string $address = null
    ): User {
        $user = User::where('email', $email)->first();

        if (!$user) {
            $user = User::create([
                'name' => $name,
                'email' => $email,
                'password' => Hash::make($password),
                'phone' => $phone,
                'address' => $address,
                'joined_at' => now(),
            ]);
        } else {
            $user->update([
                'phone' => $phone ?? $user->phone,
                'address' => $address ?? $user->address,
            ]);
        }

        DB::table('user_roles')->updateOrInsert(
            [
                'user_id' => $user->id,
                'role_id' => $roleId,
            ],
            [
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        return $user;
    }
}
