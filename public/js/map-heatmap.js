/**
 * SafeMap — map-heatmap.js   (Idea 6: mapa de calor de siniestralidad)
 * --------------------------------------------------------------------
 * Pinta la concentración HISTÓRICA de incidentes en las calles de Xalapa
 * con Leaflet.heat. Los datos vienen ponderados por antigüedad desde
 * GET /api/analytics/heatmap (los reportes recientes pesan más).
 *
 * Leaflet.heat se carga de forma diferida (unpkg) la primera vez que se activa.
 */
(function () {
  'use strict';

  if (!window.map) return;

  const ENDPOINT = (window.SAFEMAP && window.SAFEMAP.analytics && window.SAFEMAP.analytics.heatmap) ||
    '/api/analytics/heatmap';
  const CDN = 'https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js';

  let heatLayer = null;
  let legendEl  = null;
  let loading   = false;
  let loaded    = false;

  const GRADIENT = {
    0.2: '#3BB6D8', 0.4: '#3BB273', 0.55: '#F2C15A',
    0.75: '#F2A65A', 0.9: '#E84855', 1.0: '#8B1A25',
  };

  /* ── cargar Leaflet.heat bajo demanda ── */

  function loadHeatPlugin() {
    return new Promise((resolve, reject) => {
      if (typeof L.heatLayer === 'function') return resolve();
      const s = document.createElement('script');
      s.src = CDN;
      s.async = true;
      s.onload = () => (typeof L.heatLayer === 'function' ? resolve() : reject(new Error('leaflet.heat no expone L.heatLayer')));
      s.onerror = () => reject(new Error('No se pudo cargar leaflet.heat'));
      document.head.appendChild(s);
    });
  }

  /* ── leyenda ── */

  function legend() {
    if (!legendEl) {
      legendEl = document.getElementById('heatLegend');
      if (!legendEl) {
        legendEl = document.createElement('div');
        legendEl.id = 'heatLegend';
        legendEl.className = 'map-legend';
        legendEl.hidden = true;
        document.querySelector('.map-wrapper').appendChild(legendEl);
      }
    }
    return legendEl;
  }

  function showLegend(total, active) {
    const el = legend();
    el.innerHTML = `
      <span class="legend-title">🔥 Mapa de calor</span>
      <span class="legend-sub">${total} reporte${total === 1 ? '' : 's'} históricos</span>
      <div class="legend-bar"></div>
      <div class="legend-scale"><span>Menos</span><span>Más</span></div>`;
    el.hidden = false;
    if (active) el.style.display = '';
  }

  /* ── activar / desactivar ── */

  async function show() {
    if (loading) return;
    loading = true;
    try {
      await loadHeatPlugin();

      if (!loaded) {
        const res = await fetch(ENDPOINT, { headers: { Accept: 'application/json' } });
        const json = await res.json();
        const data = (json && json.data) || {};
        const points = data.points || [];

        if (!points.length) {
          notify('Todavía no hay suficientes datos para el mapa de calor.');
          return;
        }

        heatLayer = L.heatLayer(points, {
          radius: 26,
          blur: 20,
          maxZoom: 17,
          max: 1.0,
          minOpacity: 0.35,
          gradient: GRADIENT,
        });
        heatLayer._total = data.total || points.length;
        loaded = true;
      }

      heatLayer.addTo(window.map);
      showLegend(heatLayer._total, true);
      syncButton(true);
    } catch (err) {
      console.error('[SafeMap] Heatmap:', err);
      notify('No se pudo cargar el mapa de calor.');
      syncButton(false);
    } finally {
      loading = false;
    }
  }

  function hide() {
    if (heatLayer && window.map.hasLayer(heatLayer)) window.map.removeLayer(heatLayer);
    const el = legend();
    if (el) el.hidden = true;
    syncButton(false);
  }

  function toggle() {
    if (isVisible()) hide();
    else show();
  }

  function isVisible() {
    return !!(heatLayer && window.map.hasLayer(heatLayer));
  }

  function syncButton(active) {
    const btn = document.getElementById('layerHeat');
    if (btn) {
      btn.classList.toggle('is-active', !!active);
      btn.setAttribute('aria-pressed', String(!!active));
    }
  }

  function notify(msg, type) {
    if (window.SafeMapUX && window.SafeMapUX.showToastUX) window.SafeMapUX.showToastUX(msg, type);
  }

  /* ── evento del botón ── */

  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('layerHeat');
    if (btn) btn.addEventListener('click', toggle);
  });

  window.SafeMapHeat = { show, hide, toggle, isVisible };
})();
