<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Inspection;
use App\Models\Vendor;
use App\Models\Violation;
use App\Services\VendorComplianceService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;

class VendorController extends Controller
{
    /*
    |--------------------------------------------------------------------------
    | GET ALL VENDORS
    |--------------------------------------------------------------------------
    */

    public function index(Request $request)
    {
        $query = Vendor::with(['user', 'barangay']);

        /*
        |--------------------------------------------------------------------------
        | SEARCH
        |--------------------------------------------------------------------------
        */

        if ($request->filled('search')) {
            $search = $request->search;

            $query->where(function ($q) use ($search) {
                $q->where('vendor_code', 'like', "%{$search}%")
                    ->orWhere('business_name', 'like', "%{$search}%")
                    ->orWhere('owner_name', 'like', "%{$search}%")
                    ->orWhere('market', 'like', "%{$search}%")
                    ->orWhere('stall_number', 'like', "%{$search}%");
            });
        }

        /*
        |--------------------------------------------------------------------------
        | STATUS FILTER
        |--------------------------------------------------------------------------
        */

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        /*
        |--------------------------------------------------------------------------
        | BARANGAY FILTER
        |--------------------------------------------------------------------------
        */

        if ($request->filled('barangay_id')) {
            $query->where('barangay_id', $request->barangay_id);
        }

        $vendors = $query
            ->latest('id')
            ->get();

        return response()->json([
            'success' => true,
            'message' => 'Vendors retrieved successfully.',
            'count' => $vendors->count(),
            'vendors' => $vendors,
        ]);
    }


    /*
    |--------------------------------------------------------------------------
    | CREATE VENDOR
    |--------------------------------------------------------------------------
    */

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'user_id' => 'nullable|exists:users,id',
            'barangay_id' => 'nullable|exists:barangays,id',

            'vendor_code' => 'required|string|max:255|unique:vendors,vendor_code',

            'business_name' => 'required|string|max:255',
            'owner_name' => 'required|string|max:255',

            'market' => 'nullable|string|max:255',
            'stall_number' => 'nullable|string|max:255',

            'contact_number' => 'nullable|string|max:255',
            'address' => 'nullable|string',

            'qr_code' => 'nullable|string|max:255|unique:vendors,qr_code',

            'status' => 'nullable|in:active,inactive,suspended',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Please check the vendor information.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $vendor = Vendor::create([
            'user_id' => $request->user_id,
            'barangay_id' => $request->barangay_id,

            'vendor_code' => $request->vendor_code,
            'business_name' => $request->business_name,
            'owner_name' => $request->owner_name,

            'market' => $request->market,
            'stall_number' => $request->stall_number,

            'contact_number' => $request->contact_number,
            'address' => $request->address,

            'qr_code' => $request->qr_code,

            'status' => $request->status ?? 'active',
        ]);

        if (empty($vendor->qr_code)) {
            $vendor->qr_code = self::generateSecureQrToken($vendor);
            $vendor->save();
        }

        $vendor->load(['user', 'barangay']);

        ActivityLog::record(
            'vendor.created',
            "Added vendor {$vendor->business_name} ({$vendor->vendor_code}).",
            $vendor
        );

        return response()->json([
            'success' => true,
            'message' => 'Vendor created successfully.',
            'vendor' => $vendor,
        ], 201);
    }


    /*
    |--------------------------------------------------------------------------
    | GET SINGLE VENDOR
    |--------------------------------------------------------------------------
    */

    public function show($id)
    {
        $vendor = Vendor::with([
            'user',
            'barangay',
            'inspections',
        ])->find($id);

        if (!$vendor) {
            return response()->json([
                'success' => false,
                'message' => 'Vendor not found.',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'message' => 'Vendor retrieved successfully.',
            'vendor' => $vendor,
        ]);
    }


    /*
    |--------------------------------------------------------------------------
    | UPDATE VENDOR
    |--------------------------------------------------------------------------
    */

    public function update(Request $request, $id)
    {
        $vendor = Vendor::find($id);

        if (!$vendor) {
            return response()->json([
                'success' => false,
                'message' => 'Vendor not found.',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'user_id' => 'nullable|exists:users,id',
            'barangay_id' => 'nullable|exists:barangays,id',

            'vendor_code' => 'sometimes|required|string|max:255|unique:vendors,vendor_code,' . $id,

            'business_name' => 'sometimes|required|string|max:255',
            'owner_name' => 'sometimes|required|string|max:255',

            'market' => 'nullable|string|max:255',
            'stall_number' => 'nullable|string|max:255',

            'contact_number' => 'nullable|string|max:255',
            'address' => 'nullable|string',

            'qr_code' => 'nullable|string|max:255|unique:vendors,qr_code,' . $id,

            'status' => 'sometimes|required|in:active,inactive,suspended',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Please check the vendor information.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $vendor->update($request->only([
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
        ]));

        $vendor->load(['user', 'barangay']);

        ActivityLog::record(
            'vendor.updated',
            "Updated vendor {$vendor->business_name} ({$vendor->vendor_code}).",
            $vendor
        );

        return response()->json([
            'success' => true,
            'message' => 'Vendor updated successfully.',
            'vendor' => $vendor,
        ]);
    }


    /*
    |--------------------------------------------------------------------------
    | UPDATE VENDOR STATUS
    |--------------------------------------------------------------------------
    */

    public function updateStatus(Request $request, $id)
    {
        $vendor = Vendor::find($id);

        if (!$vendor) {
            return response()->json([
                'success' => false,
                'message' => 'Vendor not found.',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'status' => 'required|in:active,inactive,suspended',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid vendor status.',
                'errors' => $validator->errors(),
            ], 422);
        }

        $vendor->status = $request->status;
        $vendor->save();

        ActivityLog::record(
            'vendor.status_updated',
            "Set vendor {$vendor->business_name} status to {$vendor->status}.",
            $vendor
        );

        return response()->json([
            'success' => true,
            'message' => 'Vendor status updated successfully.',
            'vendor' => $vendor,
        ]);
    }


    /*
    |--------------------------------------------------------------------------
    | DELETE VENDOR
    |--------------------------------------------------------------------------
    */

    public function destroy($id)
    {
        $vendor = Vendor::find($id);

        if (!$vendor) {
            return response()->json([
                'success' => false,
                'message' => 'Vendor not found.',
            ], 404);
        }

        $name = $vendor->business_name;
        $vendor->delete();

        ActivityLog::record(
            'vendor.deleted',
            "Deleted vendor {$name}."
        );

        return response()->json([
            'success' => true,
            'message' => 'Vendor deleted successfully.',
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | GENERATE SECURE QR TOKEN
    |--------------------------------------------------------------------------
    */
    public static function generateSecureQrToken(Vendor $vendor): string
    {
        $marketCode = 'MKT';
        if ($vendor->market) {
            if (stripos($vendor->market, 'cogon') !== false) {
                $marketCode = 'COG';
            } elseif (stripos($vendor->market, 'carmen') !== false) {
                $marketCode = 'CAR';
            }
        }
        $stallClean = preg_replace('/[^0-9A-Za-z]/', '', $vendor->stall_number ?? '0');
        $randomHex = bin2hex(random_bytes(12));
        return "KK-QR-{$marketCode}-{$vendor->id}-{$stallClean}-{$randomHex}";
    }

    /*
    |--------------------------------------------------------------------------
    | REGENERATE SECURE QR CODE (Super Admin only)
    |--------------------------------------------------------------------------
    */
    public function regenerateQr(Request $request, $id)
    {
        $user = $request->user();
        if (!$user || !$user->roles()->where('name', 'super_admin')->exists()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized. Only CLENRO Super Admin can regenerate vendor QR tokens.',
            ], 403);
        }

        $vendor = Vendor::find($id);
        if (!$vendor) {
            return response()->json([
                'success' => false,
                'message' => 'Vendor not found.',
            ], 404);
        }

        $newToken = self::generateSecureQrToken($vendor);
        $vendor->qr_code = $newToken;
        $vendor->save();

        ActivityLog::record(
            'vendor.qr_regenerated',
            "Super Admin {$user->name} regenerated secure QR token for vendor {$vendor->business_name} (#{$vendor->id}).",
            $vendor
        );

        return response()->json([
            'success' => true,
            'message' => 'Secure QR token generated successfully.',
            'vendor' => $vendor,
            'qr_code' => $newToken,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | RESIDENT PUBLIC VENDOR DIRECTORY (Browse & Search Public Vendors)
    |--------------------------------------------------------------------------
    | Uses the same existing `vendors`, `inspections`, and `violations` tables.
    | Strictly strips confidential inspector remarks and vendor account details.
    */
    public function residentIndex(Request $request)
    {
        $query = Vendor::with([
            'barangay:id,name',
            'inspections' => function ($q) {
                $q->where(function ($sub) {
                    $sub->where('decision', 'accepted')->orWhereNull('decision');
                })->orderByDesc('inspected_at')->orderByDesc('id');
            },
        ]);

        // Default to active public vendors unless explicitly filtered
        if ($request->filled('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        } else {
            $query->where('status', 'active');
        }

        if ($request->filled('market') && strtolower($request->market) !== 'all') {
            $marketFilter = trim($request->market);
            $query->where('market', 'like', "%{$marketFilter}%");
        }

        if ($request->filled('barangay_id')) {
            $query->where('barangay_id', $request->barangay_id);
        }

        if ($request->filled('search')) {
            $search = trim($request->search);
            $query->where(function ($q) use ($search) {
                $q->where('business_name', 'like', "%{$search}%")
                    ->orWhere('stall_number', 'like', "%{$search}%")
                    ->orWhere('market', 'like', "%{$search}%")
                    ->orWhere('vendor_code', 'like', "%{$search}%")
                    ->orWhere('qr_code', 'like', "%{$search}%");
            });
        }

        $vendors = $query->orderBy('business_name')->get();

        $formatted = $vendors->map(function (Vendor $vendor) {
            return $this->formatPublicVendorForResident($vendor, false);
        });

        if ($request->filled('grade') && strtoupper($request->grade) !== 'ALL') {
            $targetGrade = strtoupper(trim($request->grade));
            $formatted = $formatted->filter(function ($item) use ($targetGrade) {
                return strtoupper($item['sanitation_grade']) === $targetGrade;
            })->values();
        }

        return response()->json([
            'success' => true,
            'message' => 'Public market vendors retrieved successfully.',
            'count' => $formatted->count(),
            'vendors' => $formatted,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | RESIDENT PUBLIC VENDOR DETAIL (By ID, Vendor Code, or QR Token)
    |--------------------------------------------------------------------------
    */
    public function residentShow(Request $request, $idOrCode)
    {
        $vendor = $this->resolveVendorByCodeOrId((string) $idOrCode);

        if (!$vendor) {
            return response()->json([
                'success' => false,
                'error_type' => 'NOT_REGISTERED',
                'message' => 'Vendor not found. No registered public market vendor matches that identifier.',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'message' => 'Public vendor information retrieved successfully.',
            'vendor' => $this->formatPublicVendorForResident($vendor, true),
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | RESIDENT QR BADGE SCANNER LOOKUP
    |--------------------------------------------------------------------------
    */
    public function residentScanQr(Request $request)
    {
        $rawCode = trim((string) ($request->input('qr_code') ?? $request->input('code') ?? ''));

        if ($rawCode === '') {
            return response()->json([
                'success' => false,
                'message' => 'Please scan or enter a valid vendor QR code.',
            ], 422);
        }

        $vendor = $this->resolveVendorByCodeOrId($rawCode);

        if (!$vendor) {
            return response()->json([
                'success' => false,
                'error_type' => 'NOT_REGISTERED',
                'message' => 'Unrecognized QR badge. This QR code does not match any registered public market vendor.',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'message' => 'Official vendor QR badge verified.',
            'vendor' => $this->formatPublicVendorForResident($vendor, true),
        ]);
    }

    /**
     * Resolves a Vendor model from a raw QR payload, UID prefix, vendor_code, qr_code, or numeric ID.
     */
    protected function resolveVendorByCodeOrId(string $rawInput): ?Vendor
    {
        $code = trim($rawInput);

        // Strip optional "UID:" prefix if scanned/copied from badge label
        if (stripos($code, 'UID:') === 0) {
            $code = trim(substr($code, 4));
        }

        // Parse JSON QR payloads if applicable
        if (str_starts_with($code, '{') && str_ends_with($code, '}')) {
            $parsed = json_decode($code, true);
            if (is_array($parsed)) {
                $code = trim((string) ($parsed['qr_token'] ?? $parsed['qr_code'] ?? $parsed['vendor_code'] ?? $parsed['code'] ?? $parsed['id'] ?? $code));
            }
        }

        if ($code === '') {
            return null;
        }

        $query = Vendor::with([
            'barangay:id,name',
            'inspections' => function ($q) {
                $q->where(function ($sub) {
                    $sub->where('decision', 'accepted')->orWhereNull('decision');
                })->orderByDesc('inspected_at')->orderByDesc('id');
            },
        ]);

        $vendor = (clone $query)
            ->where('qr_code', $code)
            ->orWhere('vendor_code', $code)
            ->first();

        if (!$vendor && is_numeric($code)) {
            $vendor = (clone $query)->where('id', (int) $code)->first();
        }

        // Also support matching the generated 2026 + 6-digit padded user/vendor ID format used on QR badges
        if (!$vendor && preg_match('/^20260*(\d+)$/', $code, $matches)) {
            $numericId = (int) $matches[1];
            $vendor = (clone $query)
                ->where('id', $numericId)
                ->orWhere('user_id', $numericId)
                ->first();
        }

        return $vendor;
    }

    /**
     * Formats a Vendor record for Resident viewing.
     * Excludes confidential inspector remarks (`notes`, `pending_notes`, `rejection_reason`)
     * and confidential vendor account details (`user`, `email`, `contact_number`, `address`).
     */
    protected function formatPublicVendorForResident(Vendor $vendor, bool $includeDetailedViolations = false): array
    {
        // Ensure QR token exists on the vendor record
        if (empty($vendor->qr_code)) {
            $vendor->qr_code = self::generateSecureQrToken($vendor);
            $vendor->save();
        }

        $latestInspection = $vendor->relationLoaded('inspections')
            ? $vendor->inspections->first()
            : Inspection::where('vendor_id', $vendor->id)
                ->where(function ($q) {
                    $q->where('decision', 'accepted')->orWhereNull('decision');
                })
                ->orderByDesc('inspected_at')
                ->orderByDesc('id')
                ->first();

        $quarter = 'Q' . ceil(date('n') / 3) . ' ' . date('Y');

        if ($latestInspection) {
            $hygieneScore = (int) ($latestInspection->hygiene_system ?? 0);
            $premisesScore = (int) ($latestInspection->condition_of_premises ?? 0);
            $totalScore = (int) ($latestInspection->total_score ?? intdiv($hygieneScore + $premisesScore, 2));
            $pestControlScore = intdiv($hygieneScore + $premisesScore, 2);
            $gradeLetter = VendorComplianceService::calculateGradeLetter($totalScore);
            $inspectedDateObj = $latestInspection->inspected_at ?? $latestInspection->created_at;
            $inspectedAtFormatted = $inspectedDateObj ? $inspectedDateObj->format('F j, Y') : 'Recently Audited';
            $inspectedAtIso = $inspectedDateObj ? $inspectedDateObj->toIso8601String() : null;
            $standingSummary = $totalScore >= 85
                ? 'Certified Compliant — Meets municipal market hygiene, waste segregation, and stall cleanliness standards.'
                : ($totalScore >= 70
                    ? 'Conditionally Compliant — Meets baseline sanitation standards with routine monitoring.'
                    : 'Remedial Compliance Required — Subject to follow-up sanitation verification.');
        } else {
            $totalScore = (int) ($vendor->compliance_score ?? 0);
            $hygieneScore = $totalScore;
            $premisesScore = $totalScore;
            $pestControlScore = $totalScore;
            $gradeLetter = ($vendor->compliance_grade && $vendor->compliance_grade !== 'N/A')
                ? $vendor->compliance_grade
                : ($totalScore > 0 ? VendorComplianceService::calculateGradeLetter($totalScore) : 'A');
            if ($totalScore === 0 && $gradeLetter === 'A') {
                $totalScore = 100;
                $hygieneScore = 100;
                $premisesScore = 100;
                $pestControlScore = 100;
            }
            $inspectedAtFormatted = $vendor->last_inspected_at
                ? $vendor->last_inspected_at->format('F j, Y')
                : 'Certified Stall';
            $inspectedAtIso = $vendor->last_inspected_at ? $vendor->last_inspected_at->toIso8601String() : null;
            $standingSummary = 'Certified Compliant — Registered public market stall meeting municipal sanitation standards.';
        }

        $gradeLabel = VendorComplianceService::getGradeLabel($gradeLetter);

        // Query permitted public violations info from shared `violations` table
        $activeViolationsCount = (int) ($vendor->violations_count ?? 0);
        $resolvedViolationsCount = 0;
        $permittedViolationsList = [];

        if (Schema::hasTable('violations')) {
            $violationsQuery = Violation::where('vendor_id', $vendor->id)->latest();
            $allViolations = $violationsQuery->limit(15)->get();
            $activeViolationsCount = $allViolations->where('status', '!=', 'resolved')->count();
            $resolvedViolationsCount = $allViolations->where('status', 'resolved')->count();

            if ($includeDetailedViolations) {
                $permittedViolationsList = $allViolations->map(function (Violation $v) {
                    return [
                        'id' => $v->id,
                        'violation_type' => $v->violation_type,
                        'penalty' => $v->penalty ?: 'Official Warning',
                        'status' => $v->status ?: 'pending',
                        'status_label' => ucfirst($v->status ?: 'pending'),
                        'recorded_date' => $v->created_at ? $v->created_at->format('M j, Y') : 'Recorded',
                    ];
                })->values()->toArray();
            }
        }

        return [
            'id' => $vendor->id,
            'vendor_code' => $vendor->vendor_code,
            'qr_code' => $vendor->qr_code,
            'business_name' => $vendor->business_name,
            'stall_number' => $vendor->stall_number ?: ('Stall #' . $vendor->id),
            'market' => $vendor->market ?: 'Public Market',
            'barangay_name' => $vendor->barangay?->name ?? 'Cagayan de Oro City',
            'status' => $vendor->status ?: 'active',
            'sanitation_grade' => $gradeLetter,
            'grade_label' => $gradeLabel,
            'compliance_score' => $totalScore,
            'sanitation_score' => round($totalScore / 10, 1),
            'public_inspection_summary' => [
                'has_inspection' => (bool) $latestInspection,
                'grade' => $gradeLetter,
                'grade_label' => $gradeLabel,
                'total_score' => $totalScore,
                'waste_segregation_score' => $hygieneScore,
                'waste_segregation_rating' => round(($hygieneScore / 100) * 5, 1),
                'stall_cleanliness_score' => $premisesScore,
                'stall_cleanliness_rating' => round(($premisesScore / 100) * 5, 1),
                'pest_control_score' => $pestControlScore,
                'pest_control_rating' => round(($pestControlScore / 100) * 5, 1),
                'standing_summary' => $standingSummary,
                'inspected_at' => $inspectedAtIso,
                'inspected_at_formatted' => $inspectedAtFormatted,
                'valid_through' => $quarter,
            ],
            'permitted_violations' => [
                'active_count' => $activeViolationsCount,
                'resolved_count' => $resolvedViolationsCount,
                'total_count' => $activeViolationsCount + $resolvedViolationsCount,
                'standing_text' => $activeViolationsCount === 0
                    ? 'No active sanitation violations on record'
                    : "{$activeViolationsCount} active municipal sanitation citation(s)",
                'items' => $permittedViolationsList,
            ],
        ];
    }
}