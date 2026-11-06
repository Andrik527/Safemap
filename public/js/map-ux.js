(function () {
'use strict';

/**
 * SafeMap — map-ux.js
 * Carga DESPUÉS de Leaflet y map.js existente.
 * Controla: Bottom Sheet · Skeletons · Microinteracciones · Marcadores tipificados
 *
 * public/js/map-ux.js
 * En tu blade: <script src="{{ secure_asset('js/map-ux.js') }}"></script>
 */

/* ================================================================
   CONFIGURACIÓN
   ================================================================ */

const INCIDENT_CONFIG = {
  fire:      { label: 'Incendio',   color: '#E84855', emoji: '🔥' },
  landslide: { label: 'Deslave',    color: '#F2A65A', emoji: '⛰️' },
  flood:     { label: 'Inundación', color: '#3BB6D8', emoji: '🌊' },
  accident:  { label: 'Accidente',  color: '#6B8F71', emoji: '🚨' },
  pothole:   { label: 'Bache',      color: '#9C88FF', emoji: '🕳️' },
  other:     { label: 'Otro',       color: '#697A84', emoji: '⚠️' },
};

// Umbral en minutos para mostrar el pulso de "reporte fresco"
const FRESH_THRESHOLD_MIN = 10;


/* ================================================================
   MARCADORES TIPIFICADOS
   ================================================================ */

/**
 * Crea un icono de Leaflet con el diseño de pin por tipo.
 * Sustituye a createMarkerIcon() en map.js
 */
function createTypedMarkerIcon(type, isFresh = false) {
  const cfg = INCIDENT_CONFIG[type] || INCIDENT_CONFIG.other;
  const freshClass = isFresh ? 'is-fresh' : '';

  return L.divIcon({
    className: '',
    html: `
      <div class="sm-pin ${type} ${freshClass}">
        <div class="sm-pin-body ${type}">
          <span class="sm-pin-emoji">${cfg.emoji}</span>
        </div>
      </div>
    `,
    iconSize:    [36, 36],
    iconAnchor:  [18, 36],
    popupAnchor: [0, -38],
  });
}

/**
 * Genera el HTML del popup moderno.
 */
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

/** Sección de validación comunitaria dentro del popup */
function buildVoteSection(report) {
  const S = window.SAFEMAP || {};
  const isGuestUser = S.isGuest !== false;
  const confirmations = Number(report.confirmations) || 0;
  const resolveVotes = Number(report.resolve_votes) || 0;

  const stats = `
    <div class="popup-votes-stats">
      <span class="stat-yes">✓ ${confirmations} siguen aquí</span>
      <span class="stat-no">✕ ${resolveVotes} ya no existe</span>
    </div>`;

  if (isGuestUser) {
    return `<div class="popup-votes">${stats}
      <a class="popup-vote-login" href="${esc(S.loginUrl || '/login')}">Inicia sesión para validar este reporte</a>
    </div>`;
  }

  if (report.my_vote) {
    const label = report.my_vote === 'gone' ? 'Ya no existe' : 'Sigue aquí';
    return `<div class="popup-votes">${stats}<p class="popup-voted">Tu voto: ${label}</p></div>`;
  }

  const hint = S.voteRadius > 0
    ? `<p class="popup-vote-hint">Debes estar a menos de ${esc(S.voteRadius)} m para validar.</p>` : '';

  // El autor no puede confirmar su propio reporte, pero sí cerrarlo
  const yesBtn = report.mine ? '' : `
      <button type="button" class="vote-btn vote-btn--yes" data-id="${esc(report.id)}" data-vote="still_there">✓ Sigue aquí</button>`;
  const noLabel = report.mine ? 'Ya se resolvió' : '✕ Ya no existe';

  return `<div class="popup-votes">${stats}
    <div class="popup-vote-actions">${yesBtn}
      <button type="button" class="vote-btn vote-btn--no" data-id="${esc(report.id)}" data-vote="gone">${noLabel}</button>
    </div>${hint}
  </div>`;
}

/** Estado de verificación comunitaria */
function buildStatusLine(report) {
  if (report.verified) return '<div class="popup-verified">✔ Verificado por la comunidad</div>';
  const n = Number(report.confirmations_needed) || 0;
  if (n > 0) {
    return `<div class="popup-pending">⏳ Sin verificar · faltan ${n} confirmación${n === 1 ? '' : 'es'}</div>`;
  }
  return '';
}

function buildModernPopup(report) {
  const cfg = INCIDENT_CONFIG[report.type] || INCIDENT_CONFIG.other;

  // Solo rutas relativas del propio servidor
  const photo = report.photo_url && String(report.photo_url).startsWith('/')
    ? `<a class="popup-photo" href="${esc(report.photo_url)}" target="_blank" rel="noopener">
         <img src="${esc(report.photo_url)}" alt="Evidencia del reporte" loading="lazy">
       </a>`
    : '';

  return `
    <div class="incident-popup">
      <div class="popup-header">
        <span class="popup-badge ${esc(report.type)}">${esc(cfg.label)}</span>
        <span class="popup-time">${esc(report.time ?? '')}</span>
      </div>
      ${photo}
      <div class="popup-title">${esc(report.title)}</div>
      <div class="popup-desc">${esc(report.desc)}</div>
      ${buildStatusLine(report)}
      ${buildVoteSection(report)}
    </div>
  `;
}

/**
 * Verifica si un reporte es "fresco" (menos de FRESH_THRESHOLD_MIN minutos).
 * Ajusta según cómo manejes el timestamp en tu BD.
 */
function isReportFresh(report) {
  if (!report.created_at) return false;
  const diff = (Date.now() - new Date(report.created_at).getTime()) / 60000;
  return diff < FRESH_THRESHOLD_MIN;
}


/* ================================================================
   CLUSTERING
   ================================================================ */

/**
 * Si usas leaflet.markercluster (CDN: https://cdnjs.cloudflare.com/ajax/libs/
 * leaflet.markercluster/1.5.3/leaflet.markercluster.min.js),
 * descomenta esta función y úsala para agregar marcadores.
 *
 * En tu blade añade antes de map-ux.js:
 * <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/MarkerCluster.Default.min.css"/>
 * <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet.markercluster/1.5.3/leaflet.markercluster.min.js"></script>
 */
function createClusterGroup() {
  if (typeof L.markerClusterGroup === 'undefined') return null;

  return L.markerClusterGroup({
    maxClusterRadius: 50,
    iconCreateFunction(cluster) {
      const count = cluster.getChildCount();
      const sizeClass = count > 10 ? 'lg' : '';
      return L.divIcon({
        html: `<div class="sm-cluster ${sizeClass}">${count}</div>`,
        className: '',
        iconSize: count > 10 ? [52, 52] : [42, 42],
        iconAnchor: count > 10 ? [26, 26] : [21, 21],
      });
    },
    animate: true,
    animateAddingMarkers: true,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
  });
}


/* ================================================================
   SKELETON LOADERS
   ================================================================ */

function showMapSkeleton() {
  const el = document.getElementById('mapSkeleton');
  if (el) el.classList.remove('is-hidden');
}

function hideMapSkeleton() {
  const el = document.getElementById('mapSkeleton');
  if (el) {
    el.classList.add('is-hidden');
    // Eliminar del DOM tras la transición para no bloquear clicks
    setTimeout(() => el.remove(), 450);
  }
}

function showListSkeleton() {
  const el = document.getElementById('skeletonList');
  if (el) el.style.display = 'block';
}

function hideListSkeleton() {
  const el = document.getElementById('skeletonList');
  if (el) el.style.display = 'none';
}


/* ================================================================
   TOAST DE NOTIFICACIÓN
   ================================================================ */

let toastTimer = null;

function showToastUX(msg, type = 'default') {
  // Limpiar toast anterior
  document.querySelectorAll('.toast-notification').forEach(t => t.remove());
  clearTimeout(toastTimer);

  const dot = type === 'success' ? '<span class="toast-dot"></span>' : '';
  const toast = document.createElement('div');
  toast.className = 'toast-notification';
  toast.innerHTML = `${dot}${msg}`;
  document.body.appendChild(toast);

  toastTimer = setTimeout(() => {
    toast.classList.add('is-leaving');
    setTimeout(() => toast.remove(), 350);
  }, 3000);
}


/* ================================================================
   BOTTOM SHEET
   ================================================================ */

const sheet        = document.getElementById('reportSheet');
const backdrop     = document.getElementById('sheetBackdrop');
const sheetClose   = document.getElementById('sheetClose');
const sheetSubmit  = document.getElementById('sheetSubmit');
const sheetDesc    = document.getElementById('sheetDesc');
const sheetDescCount = document.getElementById('sheetDescCount');
const sheetLocText = document.getElementById('sheetLocText');
const sheetGPS     = document.getElementById('sheetUseGPS');
const sheetGuestNotice = document.getElementById('sheetGuestNotice');
const sheetDescField   = document.getElementById('sheetDescField');
const sheetLocField    = document.getElementById('sheetLocField');

let selectedType = null;
let reportLat    = null;
let reportLng    = null;
let isGuest      = window.SAFEMAP ? !!window.SAFEMAP.isGuest : true;
let isSubmitting = false;

/** Abre el sheet */
function openSheet() {
  if (sheet && backdrop) {
    sheet.classList.add('is-open');
    backdrop.classList.add('is-open');
    document.body.style.overflow = 'hidden';

    // Mostrar aviso si es invitado
    if (sheetGuestNotice) sheetGuestNotice.hidden = !isGuest;

    // Reset
    resetSheet();
  }
}

/** Cierra el sheet */
function closeSheet() {
  if (sheet && backdrop) {
    sheet.classList.remove('is-open');
    backdrop.classList.remove('is-open');
    document.body.style.overflow = '';
  }
}

/** Resetea el estado interno */
function resetSheet() {
  selectedType = null;
  reportLat    = null;
  reportLng    = null;

  document.querySelectorAll('.incident-type-btn').forEach(b => {
    b.classList.remove('selected');
    b.setAttribute('aria-pressed', 'false');
  });

  if (sheetDescField) sheetDescField.hidden = true;
  if (sheetLocField)  sheetLocField.hidden  = true;
  if (sheetSubmit)    sheetSubmit.hidden    = true;
  if (sheetDesc)      sheetDesc.value       = '';
  if (sheetDescCount) sheetDescCount.textContent = '0';
  if (sheetLocText)   sheetLocText.textContent   = 'Centro del mapa actual';
  clearPhoto();
  showPhotoField(false);
}

// Eventos del sheet
if (sheetClose)  sheetClose.addEventListener('click', closeSheet);
if (backdrop)    backdrop.addEventListener('click', closeSheet);

// Conectar FAB al sheet (reemplaza el comportamiento anterior)
const fab = document.getElementById('reportFab');
if (fab) {
  fab.addEventListener('click', openSheet);
}

// Selección de tipo de incidente
document.querySelectorAll('.incident-type-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (isGuest) return; // invitados no pueden reportar

    document.querySelectorAll('.incident-type-btn').forEach(b => {
      b.classList.remove('selected');
      b.setAttribute('aria-pressed', 'false');
    });

    btn.classList.add('selected');
    btn.setAttribute('aria-pressed', 'true');
    selectedType = btn.dataset.type;

    if (sheetDescField) sheetDescField.hidden = false;
    if (sheetLocField)  sheetLocField.hidden  = false;
    if (sheetSubmit)    sheetSubmit.hidden    = false;
    showPhotoField(true);
  });
});

// Contador de caracteres
if (sheetDesc) {
  sheetDesc.addEventListener('input', () => {
    if (sheetDescCount) sheetDescCount.textContent = sheetDesc.value.length;
  });
}

// GPS
if (sheetGPS) {
  sheetGPS.addEventListener('click', () => {
    if (!navigator.geolocation) {
      showToastUX('Tu navegador no soporta geolocalización');
      return;
    }
    sheetGPS.textContent = '…';
    navigator.geolocation.getCurrentPosition(
      pos => {
        reportLat = pos.coords.latitude;
        reportLng = pos.coords.longitude;
        if (sheetLocText) {
          sheetLocText.textContent = `${reportLat.toFixed(5)}, ${reportLng.toFixed(5)}`;
        }
        sheetGPS.textContent = '✓';
      },
      () => {
        showToastUX('No se pudo obtener tu ubicación');
        sheetGPS.textContent = 'GPS';
      }
    );
  });
}

/* ================================================================
   EVIDENCIA FOTOGRÁFICA (opcional)
   El campo se crea por JS para no depender de editar el componente Blade.
   La imagen se reduce a 1280 px en el navegador antes de subirla.
   ================================================================ */

let selectedPhoto = null;   // Blob JPEG ya comprimido
let photoPreviewUrl = null;

function ensurePhotoField() {
  let field = document.getElementById('sheetPhotoField');
  if (field || !sheetDescField) return field;

  field = document.createElement('div');
  field.id = 'sheetPhotoField';
  field.className = 'photo-field';
  field.hidden = true;
  field.innerHTML = `
    <span class="photo-field-label">Evidencia <small>(opcional)</small></span>
    <div class="photo-picker">
      <label class="photo-pick-btn" for="sheetPhotoInput">📷 Agregar foto</label>
      <input type="file" id="sheetPhotoInput" accept="image/jpeg,image/png,image/webp" hidden>
      <div class="photo-preview" id="sheetPhotoPreview" hidden>
        <img alt="Vista previa de la evidencia">
        <button type="button" class="photo-remove" id="sheetPhotoRemove" aria-label="Quitar foto">✕</button>
      </div>
    </div>`;
  sheetDescField.insertAdjacentElement('afterend', field);

  field.querySelector('#sheetPhotoInput').addEventListener('change', onPhotoSelected);
  field.querySelector('#sheetPhotoRemove').addEventListener('click', clearPhoto);
  return field;
}

function showPhotoField(visible) {
  const field = ensurePhotoField();
  if (field) field.hidden = !visible;
}

function clearPhoto() {
  selectedPhoto = null;
  if (photoPreviewUrl) { URL.revokeObjectURL(photoPreviewUrl); photoPreviewUrl = null; }
  const input = document.getElementById('sheetPhotoInput');
  const preview = document.getElementById('sheetPhotoPreview');
  if (input) input.value = '';
  if (preview) preview.hidden = true;
}

function compressImage(file, maxSide = 1280, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);   // re-dibujar elimina los metadatos EXIF (incluido el GPS)
      canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('toBlob'))), 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen')); };
    img.src = url;
  });
}

async function onPhotoSelected(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    showToastUX('Elige un archivo de imagen');
    e.target.value = '';
    return;
  }

  try {
    const blob = await compressImage(file);
    clearPhoto();
    selectedPhoto = blob;
    photoPreviewUrl = URL.createObjectURL(blob);
    const preview = document.getElementById('sheetPhotoPreview');
    preview.querySelector('img').src = photoPreviewUrl;
    preview.hidden = false;
  } catch (err) {
    console.error('[SafeMap] Foto:', err);
    showToastUX('No se pudo procesar la foto. Prueba con otra.');
    e.target.value = '';
  }
}

// Publicar: envía el reporte (con foto opcional) a Laravel y lo pinta en el mapa
if (sheetSubmit) {
  sheetSubmit.addEventListener('click', async () => {
    if (isSubmitting) return;

    if (isGuest) { showToastUX('Inicia sesión para publicar reportes'); return; }

    const desc = sheetDesc ? sheetDesc.value.trim() : '';
    if (!selectedType) { showToastUX('Selecciona un tipo de incidente'); return; }
    if (desc.length < 5) { showToastUX('Agrega una descripción'); return; }

    const center = window.map ? window.map.getCenter() : { lat: 19.543, lng: -96.927 };
    const csrf = document.querySelector('meta[name="csrf-token"]')?.content;
    const apiUrl = (window.SAFEMAP && window.SAFEMAP.api && window.SAFEMAP.api.incidents) || '/api/incidents';

    // multipart/form-data: el navegador pone el Content-Type con su boundary
    const form = new FormData();
    form.append('type', selectedType);
    form.append('description', desc);
    form.append('lat', String(reportLat ?? center.lat));
    form.append('lng', String(reportLng ?? center.lng));
    if (selectedPhoto) form.append('photo', selectedPhoto, 'evidencia.jpg');

    const originalHTML = sheetSubmit.innerHTML;
    isSubmitting = true;
    sheetSubmit.disabled = true;
    sheetSubmit.textContent = selectedPhoto ? 'Subiendo foto…' : 'Publicando…';

    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-CSRF-TOKEN': csrf || '',
        },
        body: form,
      });

      const json = await res.json().catch(() => ({}));

      if (res.status === 401 || res.status === 419) {
        showToastUX(res.status === 401
          ? 'Tu sesión expiró. Inicia sesión de nuevo.'
          : 'La página caducó. Recárgala e intenta otra vez.');
        return;
      }
      if (res.status === 413) {
        showToastUX('La foto es demasiado pesada. Prueba con otra.');
        return;
      }
      if (!res.ok) {
        showToastUX(json.message || 'No se pudo publicar el reporte');
        return;
      }

      closeSheet();
      if (window.SafeMap) window.SafeMap.addReport(json.data);
      showToastUX('Reporte publicado', 'success');
    } catch (err) {
      console.error('[SafeMap] Error al publicar:', err);
      showToastUX('Sin conexión. Intenta de nuevo.');
    } finally {
      isSubmitting = false;
      sheetSubmit.disabled = false;
      sheetSubmit.innerHTML = originalHTML;
    }
  });
}


/* ================================================================
   DRAG PARA CERRAR EL SHEET (swipe down)
   ================================================================ */

(function initSheetDrag() {
  if (!sheet) return;
  let startY = 0, currentY = 0, isDragging = false;

  const handle = document.getElementById('sheetHandle');
  if (!handle) return;

  handle.addEventListener('touchstart', e => {
    startY = e.touches[0].clientY;
    isDragging = true;
  }, { passive: true });

  document.addEventListener('touchmove', e => {
    if (!isDragging) return;
    currentY = e.touches[0].clientY;
    const delta = Math.max(0, currentY - startY);
    sheet.style.transform = `translateY(${delta}px)`;
  }, { passive: true });

  document.addEventListener('touchend', () => {
    if (!isDragging) return;
    isDragging = false;
    const delta = currentY - startY;
    sheet.style.transform = '';
    if (delta > 100) closeSheet();
  });
})();


/* ================================================================
   INICIALIZACIÓN
   ================================================================ */

document.addEventListener('DOMContentLoaded', () => {
  showMapSkeleton();
  showListSkeleton();
});

// Ocultar skeletons cuando el mapa esté listo
// Llama a esto desde tu map.js cuando los datos carguen:
// window.onMapReady = hideMapSkeleton;
// Por ahora, timeout de seguridad:
window.addEventListener('load', () => {
  setTimeout(() => {
    hideMapSkeleton();
    hideListSkeleton();
  }, 800);
});

// Exportar funciones útiles al scope global
window.SafeMapUX = {
  openSheet,
  closeSheet,
  showToastUX,
  createTypedMarkerIcon,
  buildModernPopup,
  createClusterGroup,
  hideMapSkeleton,
  hideListSkeleton,
  isReportFresh,
};

})();
