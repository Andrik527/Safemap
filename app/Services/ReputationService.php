<?php

namespace App\Services;

use App\Enums\Badge;
use App\Models\Incident;
use App\Models\IncidentVote;
use App\Models\ReputationEvent;
use App\Models\User;
use App\Models\UserBadge;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

class ReputationService
{
    /** Niveles según puntos acumulados. */
    private const LEVELS = [
        ['min' => 0,   'name' => 'Vecino',     'icon' => '🏠'],
        ['min' => 20,  'name' => 'Observador', 'icon' => '👀'],
        ['min' => 50,  'name' => 'Vigía',      'icon' => '🔭'],
        ['min' => 120, 'name' => 'Guardián',   'icon' => '🛡️'],
        ['min' => 250, 'name' => 'Centinela',  'icon' => '🌟'],
    ];

    private const STREAK_FOR_EXEMPLARY = 3;
    private const VERIFIED_FOR_GUARDIAN = 10;
    private const VOTES_FOR_WATCHFUL = 10;

    /**
     * Suma (o resta) puntos y lo registra en el libro de movimientos.
     * Devuelve false si ese mismo movimiento ya se había registrado (nunca se paga dos veces).
     */
    public function award(User $user, int $points, string $reason, ?Incident $incident = null): bool
    {
        try {
            return DB::transaction(function () use ($user, $points, $reason, $incident) {
                ReputationEvent::create([
                    'user_id'     => $user->id,
                    'incident_id' => $incident?->id,
                    'points'      => $points,
                    'reason'      => $reason,
                ]);

                $locked = User::whereKey($user->id)->lockForUpdate()->first();
                $locked->forceFill([
                    'reputation_points' => max(0, $locked->reputation_points + $points),   // nunca negativo
                ])->save();

                return true;
            });
        } catch (UniqueConstraintViolationException) {
            return false;
        }
    }

    /** El reporte llegó al número de confirmaciones requerido: el autor gana puntos y racha. */
    public function onReportVerified(Incident $incident): void
    {
        $author = $incident->user;
        if (! $author) {
            return;
        }

        if (! $this->award($author, (int) config('safemap.points.report_verified'), 'report_verified', $incident)) {
            return;
        }

        User::whereKey($author->id)->increment('verified_streak');
        User::whereKey($author->id)->increment('reports_verified_count');

        $this->syncBadges($author->refresh());
    }

    /** La comunidad cerró un reporte que nunca llegó a verificarse: penaliza y rompe la racha. */
    public function onReportRejected(Incident $incident): void
    {
        $author = $incident->user;
        if (! $author) {
            return;
        }

        if (! $this->award($author, (int) config('safemap.points.report_rejected'), 'report_rejected', $incident)) {
            return;
        }

        User::whereKey($author->id)->update(['verified_streak' => 0]);
        User::whereKey($author->id)->increment('reports_rejected_count');
    }

    /** Pequeño premio por validar reportes ajenos (con tope diario para evitar granjas de puntos). */
    public function onVoteCast(User $voter, Incident $incident): void
    {
        $cap = (int) config('safemap.points.vote_daily_cap');

        $today = ReputationEvent::where('user_id', $voter->id)
            ->where('reason', 'vote_cast')
            ->where('created_at', '>=', now()->startOfDay())
            ->count();

        if ($today < $cap) {
            $this->award($voter, (int) config('safemap.points.vote_cast'), 'vote_cast', $incident);
        }

        $this->syncBadges($voter->refresh());
    }

    /** Otorga las insignias que el usuario ya merece. Devuelve las nuevas. */
    public function syncBadges(User $user): array
    {
        $earned = [];

        if ($user->reports_verified_count >= 1)                        $earned[] = Badge::FirstVerified;
        if ($user->verified_streak >= self::STREAK_FOR_EXEMPLARY)      $earned[] = Badge::ExemplaryCitizen;
        if ($user->reports_verified_count >= self::VERIFIED_FOR_GUARDIAN) $earned[] = Badge::CityGuardian;

        if (IncidentVote::where('user_id', $user->id)->count() >= self::VOTES_FOR_WATCHFUL) {
            $earned[] = Badge::WatchfulNeighbor;
        }

        $new = [];
        foreach ($earned as $badge) {
            try {
                $row = UserBadge::firstOrCreate(
                    ['user_id' => $user->id, 'badge' => $badge->value],
                    ['awarded_at' => now()]
                );
                if ($row->wasRecentlyCreated) {
                    $new[] = $badge;
                }
            } catch (UniqueConstraintViolationException) {
                // otra petición ya la otorgó: no pasa nada
            }
        }

        return $new;
    }

    /** @return array{name:string,icon:string,min:int,next:?array,progress:int} */
    public function levelFor(int $points): array
    {
        $current = self::LEVELS[0];
        $next = null;

        foreach (self::LEVELS as $i => $level) {
            if ($points >= $level['min']) {
                $current = $level;
                $next = self::LEVELS[$i + 1] ?? null;
            }
        }

        $progress = $next
            ? (int) round((($points - $current['min']) / ($next['min'] - $current['min'])) * 100)
            : 100;

        return $current + ['next' => $next, 'progress' => $progress];
    }

    /** Resumen para el panel de reputación. Marca como "avisadas" las insignias nuevas. */
    public function summary(User $user): array
    {
        $user->refresh();

        $owned = $user->badges()->get()->keyBy(fn (UserBadge $b) => $b->badge->value);

        // Nota: esta lectura tiene un efecto secundario a propósito (marca como vistas
        // las insignias nuevas) para mostrar el aviso "🏅 Nueva insignia" una sola vez.
        $fresh = $owned->filter(fn (UserBadge $b) => $b->notified_at === null);
        if ($fresh->isNotEmpty()) {
            UserBadge::whereIn('id', $fresh->pluck('id'))->update(['notified_at' => now()]);
        }

        return [
            'points'    => (int) $user->reputation_points,
            'level'     => $this->levelFor((int) $user->reputation_points),
            'streak'    => (int) $user->verified_streak,
            'verified'  => (int) $user->reports_verified_count,
            'rejected'  => (int) $user->reports_rejected_count,
            'badges'    => collect(Badge::cases())->map(fn (Badge $b) => [
                'key'         => $b->value,
                'label'       => $b->label(),
                'icon'        => $b->icon(),
                'description' => $b->description(),
                'earned'      => $owned->has($b->value),
            ])->values(),
            'new_badges' => $fresh->map(fn (UserBadge $b) => $b->badge->label())->values(),
        ];
    }
}
