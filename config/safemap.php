<?php

return [
    /* ---------------- Validación comunitaria ---------------- */

    // Distancia máxima (m) entre el usuario y el incidente para poder validarlo.
    // 0 = desactiva la regla (solo para pruebas).
    'vote_radius_m' => (int) env('SAFEMAP_VOTE_RADIUS_M', 300),

    // Confirmaciones de usuarios DISTINTOS que necesita un reporte para considerarse verificado.
    'confirmations_required' => (int) env('SAFEMAP_CONFIRMATIONS_REQUIRED', 2),

    // Votos "Ya no existe" necesarios para cerrarlo (y deben superar a los "Sigue aquí").
    'resolve_votes_threshold' => (int) env('SAFEMAP_RESOLVE_THRESHOLD', 2),

    // Reporte nuevo: minutos que tiene para conseguir las confirmaciones, o se oculta.
    'unverified_ttl_minutes' => (int) env('SAFEMAP_UNVERIFIED_TTL', 180),

    // Reporte verificado: minutos de vida desde la última confirmación (se renueva con cada una).
    'verified_ttl_minutes' => (int) env('SAFEMAP_VERIFIED_TTL', 1440),

    /* ---------------- Reputación ---------------- */
    'points' => [
        'report_verified' => 10,   // tu reporte llegó a N confirmaciones
        'report_rejected' => -5,   // la comunidad lo cerró sin haber sido verificado
        'vote_cast'       => 1,    // por validar el reporte de otra persona
        'vote_daily_cap'  => 10,   // máximo de puntos por validar, por día
    ],

    /* ---------------- Fotos ---------------- */
    // 'public' = disco local (se pierde en cada deploy en Render gratis).
    // Cambia a 's3' cuando configures almacenamiento externo.
    'photo_disk' => env('SAFEMAP_PHOTO_DISK', 'public'),
];
