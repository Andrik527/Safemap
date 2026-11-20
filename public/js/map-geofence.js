/**
 * SafeMap — map-geofence.js
 * ---------------------------------------------------------------------------
 * Ideas 4 y 5 del proyecto:
 *
 *   · GEOFENCING ACTIVO (Idea 4): el usuario guarda lugares clave
 *     (su casa, el Tecnológico…) y el sistema le avisa si aparece/está un
 *     incidente activo a menos de 1 km de él (o del radio que elija).
 *
 *   · ALERTAS VECINALES POR PROXIMIDAD (Idea 5): mientras el usuario se
 *     desplaza (GPS en vivo), si se acerca a un reporte activo de alto
 *     impacto (incendios, deslaves) recibe una alerta flotante prioritaria.
 *
 * Los lugares se guardan SOLO en el navegador (localStorage 'safemap_places').
 * Requiere window.map y, para leer los reportes, window.SafeMap.
 */
(function () {
  'use strict';

  if (!window.map) return;

  const CFG          = (window.SAFEMAP && window.SAFEMAP.geofence) || {};
  const RADIUS       = CFG.radius || 1000;                    // 1 km por defecto
  const HIGH_IMPACT  = CFG.highImpact || ['fire', 'landslide'];
  const COOLDOWN_MS  = (CFG.cooldown || 300) * 1000;
  const STORAGE_KEY  = 'safemap_places';

  const HIGH_IMPACT_LABEL = { fire: '🔥 Incendio', landslide: '⛰️ Deslave' };

  let placesLayer = null;
  let userLayer   = null;
  let panelEl     = null;
  let lastPosition = null;          // { lat, lng, accuracy }
  const lastAlertAt = new Map();     // id de incidente → timestamp del último aviso

  /* ── utilidades ── */

  function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function distanceM(lat1, lng1, lat2, lng2) {
    const R = 6371000, rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  function fmtDist(m) { return m >= 1000 ? (m / 1000).toFixed(1) + ' km' : Math.round(m) + ' m'; }

  /* ── lugares guardados (localStorage) ── */

  function loadPlaces() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(raw) ? raw.filter(p => p && p.lat != null && p.lng != null) : [];
    } catch (_) {
      return [];
    }
  }

  function savePlaces(places) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(places));
  }

  function addPlace(name, lat, lng, radius) {
    const places = loadPlaces();
    places.push({
      id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: String(name || 'Mi lugar').slice(0, 40),
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      radius: parseInt(radius, 10) || RADIUS,
    });
    savePlaces(places);
    renderPanel();
    drawPlaces();
    notify(`Lugar "${name}" guardado · te avisaremos si hay incidentes cerca`);
    return places;
  }

  function removePlace(id) {
    savePlaces(loadPlaces().filter(p => p.id !== id));
    renderPanel();
    drawPlaces();
  }

  /* ── capa de círculos ── */

  function drawPlaces() {
    if (placesLayer) { window.map.removeLayer(placesLayer); placesLayer = null; }
    if (!panelVisible()) return;

    placesLayer = L.layerGroup().addTo(window.map);
    loadPlaces().forEach(p => {
      L.circle([p.lat, p.lng], {
        radius: p.radius, color: '#2563a8', weight: 1.5, dashArray: '5 6',
        fillColor: '#2563a8', fillOpacity: 0.08, interactive: false,
      }).addTo(placesLayer);

      L.marker([p.lat, p.lng], {
        icon: L.divIcon({ className: '', html: '<div class="geo-pin">🏠</div>', iconSize: [26, 26], iconAnchor: [13, 13] }),
      }).bindPopup(`<b>${esc(p.name)}</b><br><small>Radio de aviso: ${fmtDist(p.radius)}</small>`).addTo(placesLayer);
    });
  }

  /* ── marcador del usuario ── */

  function drawUser() {
    if (userLayer) { window.map.removeLayer(userLayer); userLayer = null; }
    if (!lastPosition) return;

    userLayer = L.layerGroup().addTo(window.map);
    L.circle([lastPosition.lat, lastPosition.lng], {
      radius: RADIUS, color: '#3BB273', weight: 1, opacity: 0.5,
      fillColor: '#3BB273', fillOpacity: 0.06, interactive: false,
    }).addTo(userLayer);
    L.circleMarker([lastPosition.lat, lastPosition.lng], {
      radius: 6, color: '#fff', weight: 2, fillColor: '#2563a8', fillOpacity: 1,
    }).addTo(userLayer);
  }

  /* ── panel de lugares ── */

  function ensurePanel() {
    if (panelEl) return panelEl;
    panelEl = document.getElementById('geoPanel');
    if (!panelEl) {
      panelEl = document.createElement('div');
      panelEl.id = 'geoPanel';
      panelEl.className = 'geo-panel';
      panelEl.hidden = true;
      document.querySelector('.map-wrapper').appendChild(panelEl);
    }
    return panelEl;
  }

  function panelVisible() { return panelEl && !panelEl.hidden; }

  function renderPanel() {
    const el = ensurePanel();
    const places = loadPlaces();

    el.innerHTML = `
      <div class="geo-panel-head">
        <span>🏠 Mis lugares vigilados</span>
        <button type="button" class="geo-panel-close" aria-label="Cerrar">✕</button>
      </div>
      <div class="geo-add">
        <input type="text" id="geoName" maxlength="40" placeholder="Ej. Mi casa / TecNM">
        <button type="button" id="geoAddHere" class="geo-add-btn">📍 Usar mi ubicación</button>
      </div>
      <ul class="geo-list">
        ${places.length ? places.map(p => `
          <li class="geo-item">
            <span class="geo-item-body"><strong>${esc(p.name)}</strong><small>${fmtDist(p.radius)} a la redonda</small></span>
            <button type="button" class="geo-item-del" data-id="${esc(p.id)}" aria-label="Eliminar">✕</button>
          </li>`).join('')
          : '<li class="geo-empty">Aún no guardas lugares. Agrega tu casa o tu escuela para recibir avisos de incidentes cercanos.</li>'}
      </ul>`;

    el.querySelector('.geo-panel-close').addEventListener('click', hidePanel);
    el.querySelector('#geoAddHere').addEventListener('click', addCurrentLocation);
    el.querySelectorAll('.geo-item-del').forEach(btn =>
      btn.addEventListener('click', () => removePlace(btn.dataset.id)));
  }

  function addCurrentLocation() {
    const nameInput = document.getElementById('geoName');
    const name = (nameInput && nameInput.value.trim()) || 'Mi lugar';

    const finish = (lat, lng) => { addPlace(name, lat, lng, RADIUS); if (nameInput) nameInput.value = ''; };

    if (lastPosition) return finish(lastPosition.lat, lastPosition.lng);

    if (!navigator.geolocation) { notify('Tu navegador no soporta geolocalización'); return; }
    notify('Obteniendo tu ubicación…');
    navigator.geolocation.getCurrentPosition(
      pos => finish(pos.coords.latitude, pos.coords.longitude),
      () => notify('No pudimos obtener tu ubicación. Activa el GPS e intenta de nuevo.')
    );
  }

  function showPanel() {
    const el = ensurePanel();
    renderPanel();
    el.hidden = false;
    drawPlaces();
    syncButton(true);
  }

  function hidePanel() {
    const el = ensurePanel();
    el.hidden = true;
    if (placesLayer) { window.map.removeLayer(placesLayer); placesLayer = null; }
    syncButton(false);
  }

  function togglePanel() { panelVisible() ? hidePanel() : showPanel(); }

  function syncButton(active) {
    const btn = document.getElementById('layerPlaces');
    if (btn) {
      btn.classList.toggle('is-active', !!active);
      btn.setAttribute('aria-pressed', String(!!active));
    }
  }

  /* ── alerta flotante ── */

  function showAlert({ icon, title, text, incidentId }) {
    document.querySelectorAll('.geo-alert').forEach(a => a.remove());

    const alert = document.createElement('div');
    alert.className = 'geo-alert';
    alert.innerHTML = `
      <span class="geo-alert-icon">${icon}</span>
      <span class="geo-alert-text"><strong>${esc(title)}</strong><br>${esc(text)}</span>
      ${incidentId != null ? '<button type="button" class="geo-alert-view">Ver</button>' : ''}
      <button type="button" class="geo-alert-close" aria-label="Cerrar">✕</button>`;

    document.body.appendChild(alert);

    const remove = () => alert.remove();
    alert.querySelector('.geo-alert-close').addEventListener('click', remove);
    const viewBtn = alert.querySelector('.geo-alert-view');
    if (viewBtn) {
      viewBtn.addEventListener('click', () => {
        if (window.SafeMap && window.SafeMap.focusReport) window.SafeMap.focusReport(incidentId);
        remove();
      });
    }

    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    setTimeout(remove, 9000);
  }

  /* ── motor de proximidad ── */

  function canAlert(id) {
    const now = Date.now();
    const last = lastAlertAt.get(id) || 0;
    if (now - last < COOLDOWN_MS) return false;
    lastAlertAt.set(id, now);
    return true;
  }

  function evaluate() {
    const reports = (window.SafeMap && window.SafeMap.getReports) ? window.SafeMap.getReports() : [];
    if (!reports.length) return;

    const places = loadPlaces();

    // 1) Alertas vecinales: proximidad del USUARIO a incidentes de alto impacto.
    if (lastPosition) {
      reports.forEach(inc => {
        const lat = parseFloat(inc.lat), lng = parseFloat(inc.lng);
        const d = distanceM(lastPosition.lat, lastPosition.lng, lat, lng);
        if (d > RADIUS || !canAlert(inc.id)) return;

        if (inc.high_impact || HIGH_IMPACT.includes(inc.type)) {
          showAlert({
            icon: HIGH_IMPACT_LABEL[inc.type] ? HIGH_IMPACT_LABEL[inc.type].split(' ')[0] : '🚨',
            title: `Alerta vecinal: ${inc.label || inc.type}`,
            text: `${inc.title} a ${fmtDist(d)} de tu ubicación.`,
            incidentId: inc.id,
          });
        } else {
          showAlert({
            icon: '⚠️',
            title: `Precaución cerca (${fmtDist(d)})`,
            text: inc.title,
            incidentId: inc.id,
          });
        }
      });
    }

    // 2) Geofencing de lugares guardados: incidentes que caen dentro del radio de un lugar.
    places.forEach(place => {
      reports.forEach(inc => {
        const lat = parseFloat(inc.lat), lng = parseFloat(inc.lng);
        const d = distanceM(place.lat, place.lng, lat, lng);
        if (d > place.radius || !canAlert('place:' + place.id + ':' + inc.id)) return;

        const high = inc.high_impact || HIGH_IMPACT.includes(inc.type);
        showAlert({
          icon: high ? '🚨' : '📍',
          title: high ? `Alerta en ${place.name}` : `Reporte cerca de ${place.name}`,
          text: `${inc.label || inc.type}: ${inc.title} (a ${fmtDist(d)}).`,
          incidentId: inc.id,
        });
      });
    });
  }

  /* ── GPS en vivo ── */

  function startWatch() {
    if (!navigator.geolocation) return;
    navigator.geolocation.watchPosition(
      pos => {
        lastPosition = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        drawUser();
        evaluate();
      },
      () => { /* silencioso: el usuario puede denegar el permiso */ },
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 }
    );
  }

  function simulate(lat, lng) {
    lastPosition = { lat: parseFloat(lat), lng: parseFloat(lng), accuracy: 25 };
    drawUser();
    evaluate();
  }

  /* ── evento del botón de capa ── */

  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('layerPlaces');
    if (btn) btn.addEventListener('click', togglePanel);

    // Simulador de GPS (solo desarrollo): nos "teletransporta" junto al 1er reporte
    const simBtn = document.getElementById('btn-simulate-gps');
    if (simBtn) {
      simBtn.addEventListener('click', () => {
        const reports = (window.SafeMap && window.SafeMap.getReports) ? window.SafeMap.getReports() : [];
        if (!reports.length) { notify('No hay reportes activos para simular.'); return; }
        const target = reports[0];
        simulate(parseFloat(target.lat) + 0.0009, parseFloat(target.lng));  // ~100 m
        notify('Simulando GPS a ~100 m del reporte');
      });
    }

    startWatch();
  });

  function notify(msg) {
    if (window.SafeMapUX && window.SafeMapUX.showToastUX) window.SafeMapUX.showToastUX(msg);
  }

  window.SafeMapGeo = {
    getLastPosition: () => lastPosition,
    places: loadPlaces,
    addPlace,
    removePlace,
    simulate,
    showPanel,
    hidePanel,
    togglePanel,
  };
})();
