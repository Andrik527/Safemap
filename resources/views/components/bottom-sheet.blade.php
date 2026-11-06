{{--
  resources/views/components/bottom-sheet.blade.php
  Uso en mapa/index.blade.php: <x-bottom-sheet />
--}}

{{-- Fondo oscuro --}}
<div class="sheet-backdrop" id="sheetBackdrop"></div>

{{-- Bottom Sheet --}}
<div class="bottom-sheet" id="reportSheet" role="dialog" aria-modal="true" aria-labelledby="sheetTitle">

  {{-- Handle para arrastrar --}}
  <div class="sheet-handle" id="sheetHandle" role="presentation"></div>

  {{-- Cabecera --}}
  <div class="sheet-header">
    <h2 class="sheet-title" id="sheetTitle">Nuevo reporte</h2>
    <button class="sheet-close" id="sheetClose" aria-label="Cerrar">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  </div>

  {{-- Cuerpo --}}
  <div class="sheet-body">

    {{-- Aviso invitado --}}
    <div class="modal-guest-notice" id="sheetGuestNotice" hidden>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      Necesitas una cuenta para publicar.
      <a href="{{ route('login') }}">Inicia sesión</a>
    </div>

    {{-- Tipos de incidente --}}
    <div class="incident-type-grid" id="typeGrid">
      @php
        $types = [
          ['key' => 'fire',      'label' => 'Incendio',   'icon' => '🔥'],
          ['key' => 'landslide', 'label' => 'Deslave',    'icon' => '⛰️'],
          ['key' => 'flood',     'label' => 'Inundación', 'icon' => '🌊'],
          ['key' => 'accident',  'label' => 'Accidente',  'icon' => '🚨'],
          ['key' => 'pothole',   'label' => 'Bache',      'icon' => '🕳️'],
          ['key' => 'other',     'label' => 'Otro',       'icon' => '⚠️'],
        ];
      @endphp

      @foreach($types as $t)
        <button
          class="incident-type-btn ripple-btn"
          data-type="{{ $t['key'] }}"
          type="button"
          aria-pressed="false"
        >
          <div class="type-icon {{ $t['key'] }}">{{ $t['icon'] }}</div>
          <span>{{ $t['label'] }}</span>
        </button>
      @endforeach
    </div>

    {{-- Descripción --}}
    <div id="sheetDescField" hidden>
      <label
        for="sheetDesc"
        style="font-family:var(--font-ui);font-size:.8rem;font-weight:600;color:var(--ink);display:block;margin-bottom:.4rem"
      >
        ¿Qué está pasando?
      </label>
      <textarea
        id="sheetDesc"
        class="sheet-textarea"
        rows="3"
        placeholder="Describe brevemente lo que ves..."
        maxlength="280"
      ></textarea>
      <div style="text-align:right;font-size:.72rem;color:var(--muted);margin-top:.2rem">
        <span id="sheetDescCount">0</span>/280
      </div>
    </div>

    {{-- Ubicación --}}
    <div class="sheet-location-row" id="sheetLocField" hidden>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/>
        <circle cx="12" cy="10" r="3"/>
      </svg>
      <span id="sheetLocText">Centro del mapa actual</span>
      <button
        type="button"
        id="sheetUseGPS"
        style="margin-left:auto;font-family:var(--font-ui);font-size:.75rem;font-weight:600;color:var(--navy);background:none;border:1.5px solid var(--border);border-radius:6px;padding:.3rem .65rem;cursor:pointer"
      >
        GPS
      </button>
    </div>

    {{-- Botón publicar --}}
    <button
      type="button"
      class="sheet-submit-btn ripple-btn"
      id="sheetSubmit"
      hidden
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      Publicar reporte
    </button>

  </div>{{-- /.sheet-body --}}
</div>{{-- /.bottom-sheet --}}
