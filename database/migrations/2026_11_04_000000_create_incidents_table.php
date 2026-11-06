<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('incidents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();

            $table->string('type', 20);                 // IncidentType: fire, landslide, flood...
            $table->string('title', 120);
            $table->text('description');

            // ~1 cm de precisión; funciona igual en SQLite, MySQL y PostgreSQL
            $table->decimal('lat', 10, 7);
            $table->decimal('lng', 10, 7);

            $table->string('status', 20)->default('active'); // IncidentStatus: active, resolved
            $table->timestamp('resolved_at')->nullable();

            $table->timestamps();

            $table->index(['status', 'created_at']);    // listado de activos, más recientes primero
            $table->index(['lat', 'lng']);              // filtro por bounding box
            $table->index('type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('incidents');
    }
};
