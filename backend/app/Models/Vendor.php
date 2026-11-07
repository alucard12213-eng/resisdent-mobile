<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Vendor extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'barangay_id',
        'vendor_code',
        'business_name',
        'owner_name',
        'market',
        'stall_number',
        'contact_number',
        'address',
        'qr_code',
        'status',
        'sanitation_score',
        'compliance_score',
        'compliance_grade',
        'violations_count',
        'last_inspected_at',
    ];

    protected $casts = [
        'sanitation_score' => 'float',
        'compliance_score' => 'integer',
        'violations_count' => 'integer',
        'last_inspected_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function barangay(): BelongsTo
    {
        return $this->belongsTo(Barangay::class);
    }

    public function inspections(): HasMany
    {
        return $this->hasMany(Inspection::class);
    }

    public function violations(): HasMany
    {
        return $this->hasMany(Violation::class);
    }
}