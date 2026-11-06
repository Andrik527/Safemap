{{--
  resources/views/components/skeleton-loaders.blade.php
  Uso: <x-skeleton-loaders />
  Se oculta cuando los datos cargan con JS: hideSkeleton()
--}}

{{-- Skeleton de la lista de reportes --}}
<div id="skeletonList" aria-hidden="true">
  @for($i = 0; $i < 4; $i++)
    <div class="skeleton-card">
      <div class="skeleton skeleton-dot"></div>
      <div class="skeleton-body">
        <div class="skeleton skeleton-line skeleton-title"></div>
        <div class="skeleton skeleton-line skeleton-desc"></div>
        <div class="skeleton skeleton-line skeleton-meta"></div>
      </div>
    </div>
  @endfor
</div>

{{-- Skeleton del mapa --}}
<div class="map-skeleton" id="mapSkeleton" aria-label="Cargando mapa...">
  <div class="map-skeleton-inner">
    <div class="map-skeleton-icon">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1B3A4B" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 6v6l4 2"/>
      </svg>
    </div>
    <span class="map-skeleton-label">Cargando mapa…</span>
  </div>
</div>
