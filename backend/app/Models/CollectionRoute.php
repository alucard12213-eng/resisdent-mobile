<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CollectionRoute extends Model
{
    use HasFactory;

    protected $fillable = [
        'route_name',
        'truck_id',
        'assigned_personnel_id',
        'barangay_id',
        'start_location',
        'end_location',
        'collection_stops',
        'distance_km',
        'stop_duration_minutes',
        'estimated_duration_minutes',
        'estimated_duration',
        'collection_date',
        'start_time',
        'end_time',
        'estimated_arrival_time',
        'status',
        'notes',
    ];

    protected $casts = [
        'collection_date' => 'date:Y-m-d',
        'collection_stops' => 'array',
        'distance_km' => 'float',
        'stop_duration_minutes' => 'integer',
        'estimated_duration_minutes' => 'integer',
    ];

    public function truck(): BelongsTo
    {
        return $this->belongsTo(Truck::class);
    }

    public function assignedPersonnel(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_personnel_id');
    }

    public function barangay(): BelongsTo
    {
        return $this->belongsTo(Barangay::class);
    }

    public function stops(): HasMany
    {
        return $this->hasMany(CollectionRouteStop::class, 'collection_route_id')
            ->orderBy('stop_order');
    }
}
