<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('violations')) {
            Schema::create('violations', function (Blueprint $table) {
                $table->id();
                $table->foreignId('vendor_id')->constrained('vendors')->cascadeOnDelete();
                $table->foreignId('inspection_id')->nullable()->constrained('inspections')->nullOnDelete();
                $table->string('violation_type');
                $table->text('description')->nullable();
                $table->string('penalty')->default('Official Warning');
                $table->text('corrective_action')->nullable();
                $table->enum('status', ['pending', 'resolved', 'appealed'])->default('pending');
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('violations');
    }
};

