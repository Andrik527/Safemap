<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // --- Ciclo de vida del reporte ------------------------------------
        Schema::table('incidents', function (Blueprint $table) {
            $table->timestamp('verified_at')->nullable();           // cuando llegó a N confirmaciones
            $table->timestamp('expires_at')->nullable()->index();   // después de esto se oculta
        });

        // Reportes que ya existían: les damos una ventana nueva para conseguir confirmaciones
        DB::table('incidents')->whereNull('expires_at')->update([
            'expires_at' => now()->addMinutes((int) config('safemap.unverified_ttl_minutes', 180)),
        ]);

        // --- Reputación del usuario ---------------------------------------
        Schema::table('users', function (Blueprint $table) {
            $table->integer('reputation_points')->default(0);
            $table->unsignedInteger('verified_streak')->default(0);          // racha actual
            $table->unsignedInteger('reports_verified_count')->default(0);
            $table->unsignedInteger('reports_rejected_count')->default(0);
        });

        // Libro de movimientos de puntos (auditable; evita dar puntos dos veces)
        Schema::create('reputation_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('incident_id')->nullable()->constrained()->nullOnDelete();
            $table->smallInteger('points');
            $table->string('reason', 30);       // report_verified | report_rejected | vote_cast
            $table->timestamps();

            $table->unique(['user_id', 'incident_id', 'reason']);
            $table->index(['user_id', 'reason', 'created_at']);
        });

        Schema::create('user_badges', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('badge', 40);
            $table->timestamp('awarded_at');
            $table->timestamp('notified_at')->nullable();   // null = el usuario aún no vio el aviso
            $table->timestamps();

            $table->unique(['user_id', 'badge']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_badges');
        Schema::dropIfExists('reputation_events');

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['reputation_points', 'verified_streak', 'reports_verified_count', 'reports_rejected_count']);
        });

        Schema::table('incidents', function (Blueprint $table) {
            $table->dropColumn(['verified_at', 'expires_at']);
        });
    }
};
