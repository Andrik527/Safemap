/**
 * SafeMap — map-risk.js   (Idea 1: historial predictivo de riesgos por clima)
 * ---------------------------------------------------------------------------
 * Cruza la temporada actual (lluvias may–oct) con los puntos donde
 * históricamente se reportan más anegamientos en Xalapa y los dibuja como
 * una capa de advertencia predictiva sobre el mapa.
 *
 * Datos: GET /api/analytics/risk-zones
 *   → { data: { season:{active,label,monthly_profile}, zones:[{name,lat,lng,radius,reports,risk,advice}] } }
 */
(function () {
  'use strict';

  if (!window.map) return;

  const ENDPOINT = (window.SAFEMAP && window.SAFEMAP.analytics && window.SAFEMAP.analytics.risk) ||
    '/api/analytics/risk-zones';

  const LEVELS = {
    alto:  { color: '#E84855', label: 'Riesgo alto' },
    medio: { color: '#F2A65A', label: 'Riesgo medio' },
    bajo:  { color: '#3BB6D8', label: 'Riesgo bajo' },
  };

  let riskLayer = null;
  let legendEl  = null;
  let loading   = false;
  let season    = null;

  function esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function legend() {
    if (!legendEl) {
      legendEl = document.getElementById('riskLegend');
      if (!legendEl) {
        legendEl = document.createElement('div');
        legendEl.id = 'riskLegend';
        legendEl.className = 'map-legend map-legend--risk';
        legendEl.hidden = true;
        document.querySelector('.map-wrapper').appendChild(legendEl);
      }
    }
    return legendEl;
  }

  function showLegend(zoneCount) {
    const el = legend();
    const rainy = season && season.active;
    el.innerHTML = `
      <span class="legend-title">💧 Riesgo de anegamiento</span>
      <span class="legend-sub">${rainy ? '🌧️ ' : '☀️ '}${esc(season ? season.label : '')} · ${zoneCount} punto${zoneCount === 1 ? '' : 's'}</span>
      <div class="legend-rows">
        <span><i style="background:${LEVELS.alto.color}"></i>Alto</span>
        <span><i style="background:${LEVELS.medio.color}"></i>Medio</span>
        <span><i style="background:${LEVELS.bajo.color}"></i>Bajo</span>
      </div>`;
    el.hidden = false;
  }

  async function show() {
    if (loading) return;
    loading = true;
    try {
      const res = await fetch(ENDPOINT, { headers: { Accept: 'application/json' } });
      const json = await res.json();
      const data = (json && json.data) || { zones: [] };
      season = data.season || null;
      const zones = data.zones || [];

      if (riskLayer) window.map.removeLayer(riskLayer);
      riskLayer = L.layerGroup().addTo(window.map);

      zones.forEach(z => {
        const level = LEVELS[z.risk] || LEVELS.bajo;
        L.circle([z.lat, z.lng], {
          radius: z.radius || 350,
          color: level.color,
          weight: 1.5,
          opacity: 0.8,
          fillColor: level.color,
          fillOpacity: season && season.active ? 0.18 : 0.1,
          interactive: true,
        })
        .bindPopup(`
          <div class="incident-popup">
            <div class="popup-header"><span class="popup-badge flood">${esc(level.label)}</span></div>
            <div class="popup-title">${esc(z.name)}</div>
            <div class="popup-desc">${esc(z.advice)}</div>
            ${z.reports > 0 ? `<div class="popup-pending">📍 ${z.reports} reporte${z.reports === 1 ? '' : 's'} histórico${z.reports === 1 ? '' : 's'}</div>` : ''}
          </div>`, { maxWidth: 260 })
        .addTo(riskLayer);
      });

      showLegend(zones.length);
      syncButton(true);

      if (season && season.active) {
        notify(`🌧️ Temporada de lluvias: ${zones.length} punto${zones.length === 1 ? '' : 's'} propensos a anegarse`, 'success');
      }
    } catch (err) {
      console.error('[SafeMap] Risk zones:', err);
      notify('No se pudieron cargar las zonas de riesgo.');
      syncButton(false);
    } finally {
      loading = false;
    }
  }

  function hide() {
    if (riskLayer && window.map.hasLayer(riskLayer)) window.map.removeLayer(riskLayer);
    const el = legend();
    if (el) el.hidden = true;
    syncButton(false);
  }

  function toggle() { if (isVisible()) hide(); else show(); }
  function isVisible() { return !!(riskLayer && window.map.hasLayer(riskLayer)); }

  function syncButton(active) {
    const btn = document.getElementById('layerRisk');
    if (btn) {
      btn.classList.toggle('is-active', !!active);
      btn.setAttribute('aria-pressed', String(!!active));
    }
  }

  function notify(msg, type) {
    if (window.SafeMapUX && window.SafeMapUX.showToastUX) window.SafeMapUX.showToastUX(msg, type);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('layerRisk');
    if (btn) btn.addEventListener('click', toggle);
  });

  window.SafeMapRisk = { show, hide, toggle, isVisible, season: () => season };
})();
