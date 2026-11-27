@extends('layouts.app')
@section('title', 'SafeMap — Mapa')

@section('fonts')
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500&display=swap" rel="stylesheet"/>
@endsection

@section('styles')
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"/>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/MarkerCluster.min.css"/>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/MarkerCluster.Default.min.css"/>
<link rel="stylesheet" href="{{ secure_asset('css/map.css') }}?v={{ md5_file(public_path('css/map.css')) }}">
<link rel="stylesheet" href="{{ secure_asset('css/mobile-ux.css') }}?v={{ md5_file(public_path('css/mobile-ux.css')) }}">
{{-- Modo oscuro real (filtro de inversión de teselas) — se activa con [data-theme="dark"] --}}
<link rel="stylesheet" href="{{ secure_asset('css/dark-mode.css') }}?v={{ md5_file(public_path('css/dark-mode.css')) }}">
{{-- Capas nuevas: enrutamiento, mapa de calor, zonas de riesgo y geocercas --}}
<link rel="stylesheet" href="{{ secure_asset('css/map-features.css') }}?v={{ md5_file(public_path('css/map-features.css')) }}">
<meta name="csrf-token" content="{{ csrf_token() }}">
<meta name="theme-color" content="#1B3A4B">
{{-- El tema se aplica en el <head> (antes de pintar) para evitar un destello blanco de noche --}}
<script src="{{ secure_asset('js/map-theme.js') }}?v={{ md5_file(public_path('js/map-theme.js')) }}"></script>
@endsection

@section('content')
<x-skeleton-loaders />
<x-bottom-sheet />
<header class="topbar">
  <div class="topbar-left">
    <a href="{{ route('login') }}" class="topbar-brand">
      <svg width="24" height="24" viewBox="0 0 40 40" fill="none">
        <circle cx="20" cy="20" r="20" fill="#E84855"/>
        <path d="M20 8C15.03 8 11 12.03 11 17c0 7 9 17 9 17s9-10 9-17c0-4.97-4.03-9-9-9zm0 12.5a3.5 3.5 0 110-7 3.5 3.5 0 010 7z" fill="white"/>
      </svg>
      <span>SafeMap</span>
    </a>
    <span class="topbar-location">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
        <path d="M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/>
      </svg>
      Xalapa, Ver.
    </span>
  </div>
 <div class="topbar-right" style="display: flex; align-items: center; gap: 12px;">
    <!-- Botón Dark Mode -->
    <button id="theme-toggle" class="btn-theme-toggle" title="Alternar tema">🌙</button>

    @guest
      <div class="mode-tag mode-tag--guest">Modo invitado</div>
      <a href="{{ route('login') }}" class="btn-topbar-login">Iniciar sesión</a>
    @else
      <!-- Píldora de Gamificación Elegante -->
      <div class="gamification-pill" id="repChip" title="Mi reputación" aria-haspopup="dialog">
        <span class="badge-icon">🏅</span>
        <span class="badge-points" id="repPoints">...</span>
      </div>
      <div class="rep-panel" id="repPanel" role="dialog" aria-label="Mi reputación" hidden></div>

      <div class="mode-tag mode-tag--auth">{{ auth()->user()->name }}</div>
      <form method="POST" action="/logout" class="logout-form">
        @csrf
        <button type="submit" class="btn-topbar-logout">Cerrar sesión</button>
      </form>
    @endguest
  </div>
</header>

<div class="app-layout">
  <aside class="sidebar" id="sidebar">
    <div class="sidebar-header">
      <span class="sidebar-title">Reportes activos</span>
      <div class="active-count" id="activeCount">0</div>
    </div>
    <div class="filter-bar" role="group" aria-label="Filtrar reportes por tipo">
      <button class="filter-chip filter-chip--active" data-filter="all" aria-pressed="true">Todos</button>
      <button class="filter-chip" data-filter="fire" aria-pressed="false">
        <span class="chip-dot" style="background:#E84855"></span>Incendio
      </button>
      <button class="filter-chip" data-filter="landslide" aria-pressed="false">
        <span class="chip-dot" style="background:#F2A65A"></span>Deslave
      </button>
      <button class="filter-chip" data-filter="flood" aria-pressed="false">
        <span class="chip-dot" style="background:#3BB6D8"></span>Inundación
      </button>
      <button class="filter-chip" data-filter="pothole" aria-pressed="false">
        <span class="chip-dot" style="background:#9C88FF"></span>Bache
      </button>
      <button class="filter-chip" data-filter="accident" aria-pressed="false">
        <span class="chip-dot" style="background:#6B8F71"></span>Accidente
      </button>
      <button class="filter-chip" data-filter="other" aria-pressed="false">
        <span class="chip-dot" style="background:#697A84"></span>Otro
      </button>
    </div>
    <div class="report-list" id="reportList">
      <div class="empty-state" id="emptyState">
        <div class="empty-icon">🗺️</div>
        <p>Sin reportes activos</p>
        <span>Los nuevos reportes aparecerán aquí.</span>
      </div>
    </div>
    <div class="sidebar-footer">
      <a href="#" class="guides-link">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        Guías de prevención
      </a>
    </div>
  </aside>

  <button class="sidebar-toggle" id="sidebarToggle" aria-label="Abrir panel">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <line x1="3" y1="6" x2="21" y2="6"/>
      <line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  </button>

  <main class="map-wrapper">
    <div id="map"></div>

    {{-- Buscador de destinos (estilo Waze) --}}
    <div class="map-search" id="mapSearch">
      <div class="map-search-box">
        <span class="map-search-icon" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </span>
        <input type="search" id="searchInput" placeholder="Buscar lugar en Xalapa…"
               autocomplete="off" role="combobox" aria-expanded="false"
               aria-controls="searchResults" aria-label="Buscar un destino en Xalapa">
        <button type="button" class="map-search-clear" id="searchClear" aria-label="Borrar búsqueda" hidden>✕</button>
      </div>
      <ul class="map-search-results" id="searchResults" role="listbox" hidden></ul>
    </div>
    <div class="map-controls">
      <button class="map-ctrl-btn" id="locateMe" title="Mi ubicación">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="12" cy="12" r="3"/>
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
        </svg>
      </button>
      {{-- Capas de analítica y geocercas --}}
      <button class="map-ctrl-btn" id="layerHeat" title="Mapa de calor de siniestralidad" aria-pressed="false">🔥</button>
      <button class="map-ctrl-btn" id="layerRisk" title="Zonas predictivas de anegamiento" aria-pressed="false">💧</button>
      <button class="map-ctrl-btn" id="layerPlaces" title="Mis lugares vigilados (geocercas)" aria-pressed="false">🏠</button>
      @if (app()->environment(['local', 'testing']))
        {{-- Simulador de GPS solo en desarrollo y pruebas --}}
        <button class="map-ctrl-btn" id="btn-simulate-gps" title="Simular GPS (dev)">📍</button>
      @endif
    </div>
    <div class="map-toast" id="mapToast" hidden><span id="toastMsg"></span></div>
  </main>
</div>

<button class="fab" id="reportFab">
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
  Reportar incidente
</button>
@endsection

@section('scripts')
<script>
  window.SAFEMAP = {
    isGuest: @json(!auth()->check()),
    loginUrl: @json(route('login', [], false)),
    voteRadius: @json((int) config('safemap.vote_radius_m')),
    api: { incidents: '/api/incidents' },
    // Analítica histórica y predictiva (Ideas 3 y 6)
    analytics: {
      heatmap: '/api/analytics/heatmap',
      risk:    '/api/analytics/risk-zones'
    },
    // Enrutamiento Waze-style (Idea 1) — OSRM público, gratuito
    routing: {
      osrm:         @json(config('safemap.routing.osrm_url')),
      alternatives: @json((int) config('safemap.routing.alternatives')),
      riskRadius:   @json((int) config('safemap.routing.risk_radius_m')),
      riskWeights:  @json(config('safemap.routing.risk_weights'))
    },
    mapTiles: {
      cartoApiKey: @json(config('safemap.carto_api_key'))
    },
    // Geocercas y alertas vecinales (Ideas 4 y 5)
    geofence: {
      radius:     @json((int) config('safemap.geofence.default_radius_m')),
      highImpact: @json(config('safemap.geofence.high_impact_types')),
      cooldown:   @json((int) config('safemap.geofence.alert_cooldown_s'))
    }
  };
</script>
{{-- 1. Leaflet y plugins --}}
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/leaflet.markercluster.min.js"></script>
{{-- 2. map-ux.js ANTES de map.js (map.js consulta window.SafeMapUX al iniciar) --}}
<script src="{{ secure_asset('js/map-ux.js') }}"></script>
{{-- 3. Lógica principal --}}
<script src="{{ secure_asset('js/map.js') }}?v={{ md5_file(public_path('js/map.js')) }}"></script>
{{-- 4. Buscador de destinos (usa window.SafeMap de map.js) --}}
<script src="{{ secure_asset('js/map-search.js') }}?v={{ md5_file(public_path('js/map-search.js')) }}"></script>
{{-- 5. Enrutamiento dual Rápida / Segura (Idea 1) --}}
<script src="{{ secure_asset('js/map-routing.js') }}?v={{ md5_file(public_path('js/map-routing.js')) }}"></script>
{{-- 6. Mapa de calor de siniestralidad (Idea 6) --}}
<script src="{{ secure_asset('js/map-heatmap.js') }}"></script>
{{-- 7. Zonas predictivas de anegamiento por temporada (Idea 3) --}}
<script src="{{ secure_asset('js/map-risk.js') }}"></script>
{{-- 8. Geocercas y alertas vecinales por proximidad (Ideas 4 y 5) --}}
<script src="{{ secure_asset('js/map-geofence.js') }}?v={{ md5_file(public_path('js/map-geofence.js')) }}"></script>
{{-- 9. Reputación y gamificación (solo con sesión) --}}
    <!-- Cargamos los scripts funcionales del mapa -->

@auth
<script src="{{ secure_asset('js/map-reputation.js') }}?v={{ md5_file(public_path('js/map-reputation.js')) }}"></script>
@endauth
@endsection
