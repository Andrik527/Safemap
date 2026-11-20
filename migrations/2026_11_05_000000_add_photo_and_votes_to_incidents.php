<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('incidents', function (Blueprint $table) {
            $table->string('photo_path')->nullable()->after('description');
            $table->unsignedInteger('confirmations_count')->default(0);   // "Sigue aquí"
            $table->unsignedInteger('resolve_votes_count')->default(0);   // "Ya no existe"
            $table->timestamp('last_confirmed_at')->nullable();
        });

        Schema::create('incident_votes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('incident_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('vote', 20);                    // VoteType: still_there | gone

            // Posición desde la que votó (para auditar la validación por proximidad)
            $table->decimal('lat', 10, 7);
            $table->decimal('lng', 10, 7);
            $table->unsignedInteger('distance_m');

            $table->timestamps();

            $table->unique(['incident_id', 'user_id']);    // un voto por usuario y reporte
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('incident_votes');

        Schema::table('incidents', function (Blueprint $table) {
            $table->dropColumn(['photo_path', 'confirmations_count', 'resolve_votes_count', 'last_confirmed_at']);
        });
    }
};
