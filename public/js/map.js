/**
 * SafeMap — map.js
 * Reportes desde la API de Laravel + filtro por zona + validación comunitaria.
 * Carga DESPUÉS de leaflet, markercluster y map-ux.js.
 */
(function () {
  'use strict';

  const API_URL = (window.SAFEMAP && window.SAFEMAP.api && window.SAFEMAP.api.incidents) || '/api/incidents';
  const DEFAULT_ZONE_RADIUS = 1500; // metros

  let reports = [];
  let activeFilter = 'all';
  let activeZone = null;     // { name, lat, lng, radius }
  let zoneCircle = null;
  let markers = {};

  /* ---------- utilidades ---------- */

  // Los reportes los escriben usuarios: SIEMPRE escapar antes de usar innerHTML
  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[ch]));
  }

  function showToast(msg) {
    const toast = document.getElementById('mapToast');
    const text = document.getElementById('toastMsg');
    if (!toast || !text) return;
    text.textContent = msg;
    toast.hidden = false;
  }

  function hideToast() {
    const toast = document.getElementById('mapToast');
    if (toast) toast.hidden = true;
  }

  // Aviso flotante (el de map-ux si existe; si no, el toast del mapa)
  function notify(msg, type) {
    if (window.SafeMapUX && window.SafeMapUX.showToastUX) window.SafeMapUX.showToastUX(msg, type);
    else showToast(msg);
  }

  function csrfToken() {
    const meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.content : '';
  }

  // Distancia en metros entre dos coordenadas (Haversine)
  function distanceM(lat1, lng1, lat2, lng2) {
    const R = 6371000, rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  function formatDistance(m) {
    return m >= 1000 ? (m / 1000).toFixed(m % 1000 === 0 ? 0 : 1) + ' km' : Math.round(m) + ' m';
  }

  /* ---------- mapa ---------- */

  const map = L.map('map', {
    center: [19.543, -96.927],
    zoom: 13,
    zoomControl: true,
  });
  window.map = map;

  // Capa base primero, para que el mapa se vea aunque algo más falle
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map);

  // Clusters (opcional): si algo falla, se usan marcadores normales
  let clusterGroup = null;
  try {
    if (window.SafeMapUX && typeof L.markerClusterGroup === 'function') {
      clusterGroup = window.SafeMapUX.createClusterGroup();
      if (clusterGroup) map.addLayer(clusterGroup);
    }
  } catch (err) {
    console.error('[SafeMap] Clustering desactivado:', err);
    clusterGroup = null;
  }

  /* ---------- marcadores ---------- */

  function createMarkerIcon(r) {
    if (window.SafeMapUX) {
      return window.SafeMapUX.createTypedMarkerIcon(r.type, window.SafeMapUX.isReportFresh(r));
    }
    return L.divIcon({
      className: '',
      html: `<div style="width:32px;height:32px;background:${esc(r.color)};border-radius:50%;border:3px solid rgba(255,255,255,.9);"></div>`,
      iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -18],
    });
  }

  function buildPopup(r) {
    if (window.SafeMapUX) return window.SafeMapUX.buildModernPopup(r);
    return `<div class="incident-popup"><b>${esc(r.title)}</b><p>${esc(r.desc)}</p></div>`;
  }

  function inZone(r) {
    return !activeZone || distanceM(r.lat, r.lng, activeZone.lat, activeZone.lng) <= activeZone.radius;
  }

  // Un reporte vencido (sin confirmaciones a tiempo) deja de mostrarse aunque la página siga abierta
  function isLive(r) {
    return !r.expires_at || new Date(r.expires_at).getTime() > Date.now();
  }

  function visibleReports() {
    return reports.filter(r => isLive(r) && (activeFilter === 'all' || r.type === activeFilter) && inZone(r));
  }

  function renderMarkers() {
    if (clusterGroup) {
      clusterGroup.clearLayers();
    } else {
      Object.values(markers).forEach(m => map.removeLayer(m));
    }
    markers = {};

    visibleReports().forEach(r => {
      const marker = L.marker([r.lat, r.lng], { icon: createMarkerIcon(r) })
        .bindPopup(buildPopup(r), { maxWidth: 270 });

      marker.on('click', () => selectReport(r.id));

      if (clusterGroup) clusterGroup.addLayer(marker);
      else marker.addTo(map);

      markers[r.id] = marker;
    });
  }

  /* ---------- lista lateral ---------- */

  function renderList() {
    const list = document.getElementById('reportList');
    const empty = document.getElementById('emptyState');
    const countEl = document.getElementById('activeCount');
    const filtered = visibleReports();

    // Con zona activa, los más cercanos al destino van primero
    if (activeZone) {
      filtered.sort((a, b) =>
        distanceM(a.lat, a.lng, activeZone.lat, activeZone.lng) -
        distanceM(b.lat, b.lng, activeZone.lat, activeZone.lng));
    }

    countEl.textContent = filtered.length;
    list.querySelectorAll('.report-card').forEach(el => el.remove());

    if (filtered.length === 0) {
      empty.hidden = false;
      if (activeFilter !== 'all') showToast('Sin reportes en este filtro');
      return;
    }

    empty.hidden = true;
    hideToast();

    filtered.forEach(r => {
      const card = document.createElement('div');
      card.className = 'report-card';
      card.dataset.id = r.id;
      const confirmed = r.confirmations > 0 ? ` &middot; ✓ ${esc(r.confirmations)}` : '';
      card.innerHTML = `
        <div class="report-type-dot" style="background:${esc(r.color)}"></div>
        <div class="report-card-body">
          <div class="report-card-title">${esc(r.title)}</div>
          <div class="report-card-desc">${esc(r.desc)}</div>
          <div class="report-card-meta">${esc(r.label)} &middot; ${esc(r.time)}${confirmed}</div>
        </div>
      `;
      card.addEventListener('click', () => selectReport(r.id));
      list.appendChild(card);
    });
  }

  /* ---------- selección / enfoque ---------- */

  function revealMarker(marker, report, animate) {
    const show = () => {
      marker.openPopup();
      if (!animate) return;
      const pin = marker.getElement && marker.getElement()
        ? marker.getElement().querySelector('.sm-pin') : null;
      if (pin) {
        pin.classList.add('is-new');
        setTimeout(() => pin.classList.remove('is-new'), 1200);
      }
    };

    if (clusterGroup && clusterGroup.zoomToShowLayer) {
      // Si el marcador está dentro de un cluster, lo desagrupa y luego ejecuta show()
      clusterGroup.zoomToShowLayer(marker, show);
    } else {
      map.setView([report.lat, report.lng], 15, { animate: true });
      show();
    }
  }

  function selectReport(id) {
    document.querySelectorAll('.report-card').forEach(el => {
      el.classList.toggle('is-selected', parseInt(el.dataset.id, 10) === id);
    });
    const marker = markers[id];
    const report = reports.find(r => r.id === id);
    if (marker && report) revealMarker(marker, report, false);
  }

  /* ---------- zona / destino (búsqueda estilo Waze) ---------- */

  function renderZoneChip() {
    let chip = document.getElementById('zoneChip');

    if (!activeZone) {
      if (chip) chip.remove();
      return;
    }

    if (!chip) {
      chip = document.createElement('div');
      chip.id = 'zoneChip';
      chip.className = 'zone-chip';
      const bar = document.querySelector('.filter-bar');
      if (bar) bar.insertAdjacentElement('afterend', chip);
    }

    chip.innerHTML = `
      <span class="zone-chip-label">📍 ${esc(activeZone.name)} · ${formatDistance(activeZone.radius)}</span>
      <button type="button" class="zone-chip-clear" aria-label="Quitar zona">✕</button>
    `;
    chip.querySelector('button').addEventListener('click', () => setZone(null));
  }

  /** Centra el mapa en un destino y filtra los reportes cercanos. setZone(null) quita el filtro. */
  function setZone(zone) {
    if (zoneCircle) { map.removeLayer(zoneCircle); zoneCircle = null; }

    if (!zone) {
      activeZone = null;
      renderZoneChip();
      renderMarkers();
      renderList();
      document.dispatchEvent(new CustomEvent('safemap:zone-cleared'));
      return;
    }

    activeZone = {
      name: zone.name,
      lat: zone.lat,
      lng: zone.lng,
      radius: zone.radius || DEFAULT_ZONE_RADIUS,
    };

    zoneCircle = L.circle([activeZone.lat, activeZone.lng], {
      radius: activeZone.radius,
      color: '#E84855', weight: 2, dashArray: '6 6',
      fillColor: '#E84855', fillOpacity: 0.06,
      interactive: false,
    }).addTo(map);

    map.flyToBounds(zoneCircle.getBounds(), { padding: [24, 24], duration: 1.0, maxZoom: 16 });

    renderZoneChip();
    renderMarkers();
    renderList();

    const n = visibleReports().length;
    notify(n ? `${n} reporte${n === 1 ? '' : 's'} cerca de ${activeZone.name}` : `Sin reportes cerca de ${activeZone.name}`);
  }

  /* ---------- validación comunitaria ---------- */

  function getPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(Object.assign(new Error('unsupported'), { code: 0 }));
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true, timeout: 12000, maximumAge: 15000,
      });
    });
  }

  function setVoting(popupEl, busy) {
    if (!popupEl) return;
    popupEl.querySelectorAll('.vote-btn').forEach(b => { b.disabled = busy; });
    const box = popupEl.querySelector('.popup-votes');
    if (box) box.classList.toggle('is-busy', busy);
  }

  async function castVote(id, vote, popupEl) {
    const report = reports.find(r => r.id === id);
    if (!report) return;

    setVoting(popupEl, true);

    try {
      let pos;
      try {
        pos = await getPosition();
      } catch (err) {
        notify(err.code === 1
          ? 'Activa el permiso de ubicación para validar este reporte'
          : 'No pudimos obtener tu ubicación. Intenta de nuevo.');
        return;
      }

      const res = await fetch(`${API_URL}/${id}/vote`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-CSRF-TOKEN': csrfToken(),
        },
        body: JSON.stringify({ vote, lat: pos.coords.latitude, lng: pos.coords.longitude }),
      });

      const json = await res.json().catch(() => ({}));

      if (res.status === 401 || res.status === 419) {
        notify(res.status === 401
          ? 'Inicia sesión para validar reportes'
          : 'La página caducó. Recárgala e intenta otra vez.');
        return;
      }
      if (!res.ok) {
        notify(json.message || 'No se pudo registrar tu voto');
        return;
      }

      if (json.resolved) {
        // La comunidad cerró el reporte: sale del mapa y de la lista
        reports = reports.filter(r => r.id !== id);
        map.closePopup();
        renderMarkers();
        renderList();
      } else {
        const updated = json.data;
        reports = reports.map(r => (r.id === id ? updated : r));
        const marker = markers[id];
        if (marker) marker.setPopupContent(buildPopup(updated));
        renderList();
      }

      notify(json.message || 'Voto registrado', 'success');
      if (window.SafeMapRep) window.SafeMapRep.refresh();   // puntos / insignias
    } catch (err) {
      console.error('[SafeMap] Error al votar:', err);
      notify('Sin conexión. Intenta de nuevo.');
    } finally {
      setVoting(popupEl, false);
    }
  }

  // Los popups se crean al abrirse: delegamos el clic en su contenedor (una sola vez)
  map.on('popupopen', e => {
    const el = e.popup.getElement();
    if (!el || el.dataset.voteBound) return;
    el.dataset.voteBound = '1';

    el.addEventListener('click', ev => {
      const btn = ev.target.closest('.vote-btn');
      if (!btn || btn.disabled) return;
      castVote(parseInt(btn.dataset.id, 10), btn.dataset.vote, el);
    });
  });

  /* ---------- API pública para map-ux.js y map-search.js ---------- */

  /** Inserta un reporte recién creado (respuesta del servidor) sin recargar. */
  function addReport(report) {
    if (activeFilter !== 'all' && activeFilter !== report.type) {
      activeFilter = 'all';
      document.querySelectorAll('.filter-chip').forEach(c =>
        c.classList.toggle('filter-chip--active', c.dataset.filter === 'all'));
    }
    if (activeZone && !inZone(report)) setZone(null);

    reports = [report, ...reports.filter(r => r.id !== report.id)];
    renderMarkers();
    renderList();

    const card = document.querySelector(`.report-card[data-id="${report.id}"]`);
    if (card) {
      card.classList.add('is-new');
      card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    const marker = markers[report.id];
    if (marker) revealMarker(marker, report, true);
  }

  async function loadReports(opts = {}) {
    try {
      const res = await fetch(API_URL, {
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      reports = json.data || [];
      renderMarkers();
      renderList();
    } catch (err) {
      console.error('[SafeMap] No se pudieron cargar los reportes:', err);
      if (!opts.silent) showToast('No se pudieron cargar los reportes');
    } finally {
      if (window.SafeMapUX) {
        window.SafeMapUX.hideMapSkeleton();
        window.SafeMapUX.hideListSkeleton();
      }
    }
  }

  window.SafeMap = {
    addReport,
    reload: loadReports,
    setZone,
    getZone: () => activeZone,
    getReports: () => reports,        // lo usa el geofencing
    focusReport: selectReport,        // lo usa la alerta "Ver"
  };

  /* ---------- eventos de interfaz ---------- */

  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('filter-chip--active'));
      chip.classList.add('filter-chip--active');
      activeFilter = chip.dataset.filter;
      renderMarkers();
      renderList();
    });
  });

  document.getElementById('locateMe').addEventListener('click', () => {
    if (!navigator.geolocation) {
      showToast('Tu navegador no soporta geolocalización');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => map.setView([pos.coords.latitude, pos.coords.longitude], 15, { animate: true }),
      () => showToast('No se pudo obtener tu ubicación')
    );
  });

  const sidebar = document.getElementById('sidebar');
  document.getElementById('sidebarToggle').addEventListener('click', () => sidebar.classList.toggle('is-open'));
  map.on('click', () => {
    if (window.innerWidth <= 768) sidebar.classList.remove('is-open');
  });

  loadReports();

  // Refresco silencioso cada 2 min (los reportes vencidos desaparecen y se ven los de otros),
  // sin molestar si el usuario tiene un popup abierto.
  let popupOpen = false;
  map.on('popupopen', () => { popupOpen = true; });
  map.on('popupclose', () => { popupOpen = false; });
  setInterval(() => {
    if (!document.hidden && !popupOpen) loadReports({ silent: true });
  }, 120000);
})();
