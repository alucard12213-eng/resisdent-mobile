<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('collection_routes', function (Blueprint $table) {
            if (!Schema::hasColumn('collection_routes', 'route_name')) {
                $table->string('route_name')->nullable()->after('id');
            }

            if (!Schema::hasColumn('collection_routes', 'assigned_personnel_id')) {
                $table->foreignId('assigned_personnel_id')
                    ->nullable()
                    ->after('truck_id')
                    ->constrained('users')
                    ->nullOnDelete();
            }

            if (!Schema::hasColumn('collection_routes', 'start_location')) {
                $table->string('start_location')->nullable()->after('barangay_id');
            }

            if (!Schema::hasColumn('collection_routes', 'end_location')) {
                $table->string('end_location')->nullable()->after('start_location');
            }

            if (!Schema::hasColumn('collection_routes', 'collection_stops')) {
                $table->json('collection_stops')->nullable()->after('end_location');
            }

            if (!Schema::hasColumn('collection_routes', 'distance_km')) {
                $table->decimal('distance_km', 8, 2)->default(15.00)->after('collection_stops');
            }

            if (!Schema::hasColumn('collection_routes', 'stop_duration_minutes')) {
                $table->unsignedInteger('stop_duration_minutes')->default(40)->after('distance_km');
            }

            if (!Schema::hasColumn('collection_routes', 'estimated_duration_minutes')) {
                $table->unsignedInteger('estimated_duration_minutes')->default(180)->after('stop_duration_minutes');
            }

            if (!Schema::hasColumn('collection_routes', 'estimated_duration')) {
                $table->string('estimated_duration', 100)->nullable()->after('estimated_duration_minutes');
            }

            if (!Schema::hasColumn('collection_routes', 'estimated_arrival_time')) {
                $table->time('estimated_arrival_time')->nullable()->after('end_time');
            }
        });

        // Expand status column so 'scheduled', 'ongoing', 'completed', 'delayed' and legacy values are all valid
        DB::statement("ALTER TABLE collection_routes MODIFY COLUMN status VARCHAR(40) NOT NULL DEFAULT 'scheduled'");

        if (!Schema::hasTable('collection_route_stops')) {
            Schema::create('collection_route_stops', function (Blueprint $table) {
                $table->id();
                $table->foreignId('collection_route_id')
                    ->constrained('collection_routes')
                    ->cascadeOnDelete();
                $table->unsignedInteger('stop_order')->default(1);
                $table->string('location_name');
                $table->unsignedInteger('duration_minutes')->default(40);
                $table->unsignedInteger('travel_minutes')->default(20);
                $table->time('estimated_time')->nullable();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('collection_route_stops');

        Schema::table('collection_routes', function (Blueprint $table) {
            if (Schema::hasColumn('collection_routes', 'assigned_personnel_id')) {
                $table->dropForeign(['assigned_personnel_id']);
                $table->dropColumn('assigned_personnel_id');
            }

            $cols = [
                'route_name',
                'start_location',
                'end_location',
                'collection_stops',
                'distance_km',
                'stop_duration_minutes',
                'estimated_duration_minutes',
                'estimated_duration',
                'estimated_arrival_time',
            ];

            foreach ($cols as $col) {
                if (Schema::hasColumn('collection_routes', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};

