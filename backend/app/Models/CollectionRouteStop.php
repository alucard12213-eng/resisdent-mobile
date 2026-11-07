<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CollectionRouteStop extends Model
{
    use HasFactory;

    protected $fillable = [
        'collection_route_id',
        'stop_order',
        'location_name',
        'duration_minutes',
        'travel_minutes',
        'estimated_time',
    ];

    protected $casts = [
        'stop_order' => 'integer',
        'duration_minutes' => 'integer',
        'travel_minutes' => 'integer',
    ];

    public function route(): BelongsTo
    {
        return $this->belongsTo(CollectionRoute::class, 'collection_route_id');
    }
}

