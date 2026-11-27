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

    /* ---------------- Verificación cruzada por reputación (Idea 5) ---------------- */
    // Peso del voto según la reputación del votante. Un vecino nuevo (pocos puntos
    // o cuenta reciente) aporta menos peso a la verificación que un usuario veterano.
    // El umbral de confirmaciones se compara contra la SUMA de pesos, no contra el número de votos.
    'vote_weights' => [
        ['min' => 0,   'weight' => 0.5],   // Vecino / cuenta nueva
        ['min' => 50,  'weight' => 1.0],   // Observador-Vigía
        ['min' => 120, 'weight' => 1.5],   // Guardián
        ['min' => 250, 'weight' => 2.0],   // Centinela
    ],
    // Una cuenta con menos de estos días pesa como "nueva" aunque tenga puntos.
    'new_account_days' => (int) env('SAFEMAP_NEW_ACCOUNT_DAYS', 14),
    // Ajuste del umbral de confirmaciones según la confianza del AUTOR del reporte.
    'author_trust_adjust' => true,

    /* ---------------- Alertas vecinales / geocercas (Ideas 4 y 7) ---------------- */
    'geofence' => [
        // Radio por defecto (m) para avisar de reportes cercanos al transitar.
        'default_radius_m' => (int) env('SAFEMAP_GEOFENCE_RADIUS_M', 1000),
        // Tipos de alto impacto que disparan alerta vecinal prioritaria.
        'high_impact_types' => ['fire', 'landslide'],
        // Segundos mínimos entre dos avisos del mismo reporte (evita spam de notificaciones).
        'alert_cooldown_s' => (int) env('SAFEMAP_GEOFENCE_COOLDOWN', 300),
    ],

    /* ---------------- Analítica predictiva e histórica (Ideas 3 y 6) ---------------- */
    'analytics' => [
        // Meses de temporada de lluvias en Xalapa (1 = enero). May–Oct.
        'rainy_season_months' => [5, 6, 7, 8, 9, 10],
        // Precisión del agrupamiento geográfico para mapas de calor/puntos (decimales).
        'cluster_decimals' => 3,
        // Radio (m) con el que se dibuja cada zona predictiva de anegamiento.
        'flood_zone_radius_m' => (int) env('SAFEMAP_FLOOD_RADIUS_M', 350),
        // Reportes históricos mínimos para que un punto aparezca como foco de riesgo.
        'flood_min_reports' => (int) env('SAFEMAP_FLOOD_MIN_REPORTS', 1),
        // Puntos históricamente problemáticos (semilla cuando aún hay pocos datos reales).
        'known_flood_zones' => [
            ['name' => 'Centro Histórico',        'lat' => 19.5438, 'lng' => -96.9238],
            ['name' => 'Av. Lázaro Cárdenas',     'lat' => 19.5268, 'lng' => -96.9189],
            ['name' => 'Zona Universitaria',      'lat' => 19.5126, 'lng' => -96.9189],
            ['name' => 'Anillo Periférico (Sur)', 'lat' => 19.5142, 'lng' => -96.9402],
        ],
    ],

    /* ---------------- Enrutamiento Waze-style (Idea 1) ---------------- */
    'routing' => [
        // Servidor público OSRM (gratuito, sin API key). Cambia por tu instancia si la tienes.
        'osrm_url' => env('SAFEMAP_OSRM_URL', 'https://router.project-osrm.org'),
        // Alternativas a evaluar para hallar la ruta "segura".
        'alternatives' => (int) env('SAFEMAP_ROUTE_ALTERNATIVES', 3),
        // Penalización por tipo de incidente al puntuar el riesgo de una ruta.
        'risk_weights' => [
            'fire'      => 10,
            'landslide' => 8,
            'flood'     => 6,
            'accident'  => 4,
            'pothole'   => 2,
            'other'     => 1,
        ],
        // Distancia (m) a la que un incidente "toca" una ruta y aporta riesgo.
        'risk_radius_m' => (int) env('SAFEMAP_ROUTE_RISK_RADIUS_M', 120),
    ],

    // Carto Dark Matter requiere una API key para cargas propias.
    'carto_api_key' => env('SAFEMAP_CARTO_API_KEY'),
];
