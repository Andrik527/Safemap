/**
 * SafeMap — map-routing.js   (Idea 1: enrutamiento inteligente estilo Waze)
 * -------------------------------------------------------------------------
 * Usa OSRM público (gratuito, sin API key) para trazar DOS rutas al destino:
 *
 *   · Ruta Rápida  → la de menor tiempo (comportamiento estándar).
 *   · Ruta Segura  → la alternativa que menos incidentes activos intercepta
 *                    (incendios, deslaves, inundaciones, baches…), penalizando
 *                    cada reporte que cae dentro de `routing.risk_radius_m`.
 *
 * Depende de: leaflet (window.map) y, opcionalmente, window.SafeMap (reportes activos)
 *             y window.SafeMapGeo (última posición conocida del GPS).
 * Carga DESPUÉS de map.js.
 */
(function () {
  'use strict';

  if (!window.map || typeof L === 'undefined') return;

  const CFG        = (window.SAFEMAP && window.SAFEMAP.routing) || {};
  const OSRM_URL   = (CFG.osrm || 'https://router.project-osrm.org').replace(/\/+$/, '');
  const ALTERNATIVES = CFG.alternatives || 3;
  const RISK_RADIUS  = CFG.riskRadius || 120;
  const RISK_WEIGHT  = CFG.riskWeights || { fire: 10, landslide: 8, flood: 6, accident: 4, pothole: 2, other: 1 };

  const COLORS = { fast: '#2563a8', safe: '#3BB273' };

  let routeLayer   = null;   // L.LayerGroup con las polilíneas + marcadores
  let routes       = { fast: null, safe: null };
  let panelEl      = null;
  let destination  = null;   // { lat, lng, name }
  let originMarker = null;

  /* ── utilidades geométricas ── */

  const R = 6371000, RAD = Math.PI / 180;

  function distanceM(lat1, lng1, lat2, lng2) {
    const dLat = (lat2 - lat1) * RAD, dLng = (lng2 - lng1) * RAD;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  /** Distancia (m) de un punto a un segmento [a,b] usando proyección equirectangular. */
  function distToSegmentM(plat, plng, alat, alng, blat, blng) {
    const latRef = plat * RAD;
    const kx = Math.cos(latRef) * R * RAD;   // m por grado de longitud
    const ky = R * RAD;                       // m por grado de latitud

    const px = plng * kx, py = plat * ky;
    const ax = alng * kx, ay = alat * ky;
    const bx = blng * kx, by = blat * ky;

    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
    t = Math.max(0, Math.min(1, t));

    const cx = ax + t * dx, cy = ay + t * dy;
    return Math.hypot(px - cx, py - cy);
  }

  /** Distancia mínima (m) de un punto a una polilínea [[lat,lng],…]. */
  function distToPolyline(lat, lng, coords) {
    let min = Infinity;
    for (let i = 1; i < coords.length; i++) {
      const d = distToSegmentM(lat, lng, coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]);
      if (d < min) min = d;
      if (min === 0) break;
    }
    return coords.length === 1 ? distanceM(lat, lng, coords[0][0], coords[0][1]) : min;
  }

  /* ── puntuación de riesgo de una ruta ── */

  function scoreRoute(coords) {
    const incidents = (window.SafeMap && window.SafeMap.getReports) ? window.SafeMap.getReports() : [];
    let risk = 0;
    const hits = [];

    incidents.forEach(inc => {
      const d = distToPolyline(inc.lat, inc.lng, coords);
      if (d <= RISK_RADIUS) {
        const w = RISK_WEIGHT[inc.type] ?? RISK_WEIGHT.other ?? 1;
        // A más alto impacto, más pesa; el extra por "high_impact" prioriza incendios/deslaves.
        risk += w * (inc.high_impact ? 1.5 : 1);
        hits.push({ id: inc.id, type: inc.type });
      }
    });

    return { risk: Math.round(risk * 10) / 10, hits };
  }

  /* ── panel flotante ── */

  function ensurePanel() {
    if (panelEl) return panelEl;
    panelEl = document.getElementById('routingPanel');
    if (!panelEl) {
      panelEl = document.createElement('div');
      panelEl.id = 'routingPanel';
      panelEl.className = 'routing-panel';
      panelEl.hidden = true;
      document.querySelector('.map-wrapper').appendChild(panelEl);
    }
    return panelEl;
  }

  function fmtDist(m) { return m >= 1000 ? (m / 1000).toFixed(1) + ' km' : Math.round(m) + ' m'; }
  function fmtTime(s) {
    const min = Math.round(s / 60);
    return min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`;
  }

  function renderPanel() {
    const el = ensurePanel();
    if (!routes.fast) { el.hidden = true; return; }

    const option = (key, title, route, score) => {
      if (!route) return '';
      const risks = score.hits.length
        ? `${score.hits.length} riesgo${score.hits.length === 1 ? '' : 's'}`
        : 'sin riesgos';
      return `
        <button type="button" class="route-opt" data-route="${key}">
          <span class="route-dot" style="background:${COLORS[key]}"></span>
          <span class="route-info">
            <strong>${title}</strong>
            <small>${fmtTime(route.duration)} · ${fmtDist(route.distance)} · ${risks}</small>
          </span>
        </button>`;
    };

    const sameRoute = routes.safe === routes.fast;
    el.innerHTML = `
      <div class="routing-panel-head">
        <span class="routing-title">🧭 Ruta a ${escapeHtml(destination ? destination.name : 'destino')}</span>
        <button type="button" class="routing-close" aria-label="Cerrar ruta">✕</button>
      </div>
      ${option('fast', 'Ruta rápida', routes.fast, routes.fastScore)}
      ${sameRoute
        ? '<p class="routing-note">No hay una alternativa más segura: la ruta rápida no cruza incidentes.</p>'
        : option('safe', 'Ruta segura', routes.safe, routes.safeScore)}
    `;
    el.hidden = false;

    el.querySelector('.routing-close').addEventListener('click', clear);
    el.querySelectorAll('.route-opt').forEach(btn => {
      btn.addEventListener('click', () => focusRoute(btn.dataset.route));
    });

    focusRoute(routes.safe === routes.fast ? 'fast' : 'safe');
  }

  function escapeHtml(v) {
    return String(v ?? '').replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* ── dibujo ── */

  function drawRoutes() {
    if (routeLayer) { window.map.removeLayer(routeLayer); routeLayer = null; }
    routeLayer = L.layerGroup().addTo(window.map);

    const line = (route, color, primary) => {
      const coords = route.coords;
      // "Casing" blanco para que se lea sobre cualquier tesela
      L.polyline(coords, { color: '#ffffff', weight: primary ? 9 : 6, opacity: 0.85, interactive: false }).addTo(routeLayer);
      return L.polyline(coords, {
        color,
        weight: primary ? 5 : 3.5,
        opacity: primary ? 0.95 : 0.55,
        dashArray: primary ? null : '6 8',
        interactive: false,
      }).addTo(routeLayer);
    };

    routes._fastLine = routes.fast ? line(routes.fast, COLORS.fast, false) : null;
    routes._safeLine = routes.safe && routes.safe !== routes.fast ? line(routes.safe, COLORS.safe, true) : null;

    markEndpoints();
  }

  function markEndpoints() {
    if (originMarker) { window.map.removeLayer(originMarker); originMarker = null; }
    if (!destination) return;

    originMarker = L.marker([destination.lat, destination.lng], {
      icon: L.divIcon({
        className: '',
        html: '<div class="route-end pin-end"></div>',
        iconSize: [22, 22], iconAnchor: [11, 11],
      }),
    }).addTo(routeLayer);
  }

  function focusRoute(key) {
    const chosen = routes[key];
    if (!chosen) return;

    // Resalta la elegida y atenúa la otra
    const fastLine = routes._fastLine, safeLine = routes._safeLine;
    if (fastLine) fastLine.setStyle({ opacity: key === 'fast' ? 0.95 : 0.28, weight: key === 'fast' ? 5 : 3 });
    if (safeLine) safeLine.setStyle({ opacity: key === 'safe' ? 0.95 : 0.28, weight: key === 'safe' ? 5 : 3 });

    window.map.fitBounds(L.latLngBounds(chosen.coords), { padding: [60, 60], maxZoom: 16, animate: true });

    panelEl.querySelectorAll('.route-opt').forEach(b =>
      b.classList.toggle('is-active', b.dataset.route === key));
  }

  /* ── obtener origen ── */

  function getOrigin() {
    return new Promise(resolve => {
      if (window.SafeMapGeo && typeof window.SafeMapGeo.getLastPosition === 'function') {
        const p = window.SafeMapGeo.getLastPosition();
        if (p) return resolve({ lat: p.lat, lng: p.lng });
      }
      if (!navigator.geolocation) {
        const c = window.map.getCenter();
        return resolve({ lat: c.lat, lng: c.lng });
      }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {
          const c = window.map.getCenter();
          resolve({ lat: c.lat, lng: c.lng });
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
      );
    });
  }

  /* ── consulta a OSRM ── */

  async function setDestination(lat, lng, name) {
    destination = { lat: parseFloat(lat), lng: parseFloat(lng), name: name || 'destino' };

    const origin = await getOrigin();
    const coordsParam = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
    const url = `${OSRM_URL}/route/v1/driving/${coordsParam}` +
      `?overview=full&geometries=geojson&alternatives=${ALTERNATIVES}&steps=false`;

    let data;
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      data = await res.json();
    } catch (err) {
      console.error('[SafeMap] OSRM:', err);
      notify('No se pudo calcular la ruta (sin conexión).');
      return;
    }

    if (!data || data.code !== 'Ok' || !data.routes || !data.routes.length) {
      notify('No hay ruta disponible hasta ese destino.');
      return;
    }

    // Normaliza y puntúa cada alternativa
    const candidates = data.routes.map(r => {
      const coords = r.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
      return { distance: r.distance, duration: r.duration, coords, score: scoreRoute(coords) };
    });

    const fast = candidates.reduce((a, b) => (b.duration < a.duration ? b : a));

    // Ruta segura = la de menor riesgo (desempata por tiempo). Solo si existe otra alternativa.
    const safe = candidates
      .filter(c => c !== fast)
      .reduce((best, c) => {
        if (!best) return c;
        if (c.score.risk < best.score.risk) return c;
        if (c.score.risk === best.score.risk && c.duration < best.duration) return c;
        return best;
      }, null);

    const safeUseful = safe && (safe.score.risk < fast.score.risk || safe.score.risk === 0 && fast.score.risk > 0);

    routes = {
      fast,
      safe: safeUseful ? safe : fast,
      fastScore: fast.score,
      safeScore: safeUseful ? safe.score : fast.score,
    };

    drawRoutes();
    renderPanel();

    const avoided = routes.fastScore.hits.length - routes.safeScore.hits.length;
    if (safeUseful && avoided > 0) {
      notify(`Ruta segura evita ${avoided} incidente${avoided === 1 ? '' : 's'}`, 'success');
    }
  }

  /* ── limpieza ── */

  function clear() {
    if (routeLayer) { window.map.removeLayer(routeLayer); routeLayer = null; }
    if (panelEl) panelEl.hidden = true;
    routes = { fast: null, safe: null };
    destination = null;
  }

  /* ── eventos ── */

  document.addEventListener('safemap:destination', e => {
    const d = e.detail || {};
    if (d.lat != null && d.lng != null) setDestination(d.lat, d.lng, d.name);
  });

  // Cancela la ruta si el usuario limpia la búsqueda / quita la zona
  document.addEventListener('safemap:zone-cleared', clear);
  document.addEventListener('safemap:routing-clear', clear);

  function notify(msg, type) {
    if (window.SafeMapUX && window.SafeMapUX.showToastUX) window.SafeMapUX.showToastUX(msg, type);
  }

  window.SafeMapRouting = { setDestination, clear, focusRoute };
})();
