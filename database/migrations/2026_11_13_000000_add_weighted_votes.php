<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('incidents', function (Blueprint $table) {
            if (! Schema::hasColumn('incidents', 'weighted_confirmations')) {
                $table->decimal('weighted_confirmations', 8, 2)->default(0);
            }
            if (! Schema::hasColumn('incidents', 'weighted_resolve_votes')) {
                $table->decimal('weighted_resolve_votes', 8, 2)->default(0);
            }
        });

        Schema::table('incident_votes', function (Blueprint $table) {
            if (! Schema::hasColumn('incident_votes', 'weight')) {
                $table->decimal('weight', 4, 2)->default(1);
            }
        });

        Schema::table('incidents', function (Blueprint $table) {
            $table->index(['status', 'expires_at'], 'incidents_status_expires_idx');
        });
        Schema::table('incident_votes', function (Blueprint $table) {
            $table->index(['incident_id', 'vote'], 'incident_votes_incident_vote_idx');
        });
    }

    public function down(): void
    {
        Schema::table('incident_votes', function (Blueprint $table) {
            $table->dropIndex('incident_votes_incident_vote_idx');
            $table->dropColumn('weight');
        });
        Schema::table('incidents', function (Blueprint $table) {
            $table->dropIndex('incidents_status_expires_idx');
            $table->dropColumn(['weighted_confirmations', 'weighted_resolve_votes']);
        });
    }
};
