/**
 * SafeMap — map-search.js
 * Buscador de lugares en Xalapa usando Nominatim (OpenStreetMap, gratuito, sin API key).
 * Carga DESPUÉS de map.js (necesita window.map).
 *
 * HTML requerido (ya está en index.blade.php):
 *   .map-search > .map-search-box > #searchInput + .map-search-clear
 *   .map-search > #searchResults
 */
(function () {
  'use strict';

  if (!window.map) return;   // si el mapa no existe, no hay nada que hacer

  const NOMINATIM   = 'https://nominatim.openstreetmap.org/search';
  const XALAPA_BBOX = '-97.05,19.47,-96.77,19.63';   // oeste,sur,este,norte
  const DEBOUNCE_MS = 1000;
  const MIN_CHARS   = 3;
  const MAX_RESULTS = 6;

  const input    = document.getElementById('searchInput');
  const results  = document.getElementById('searchResults');
  const clearBtn = document.getElementById('searchClear');

  if (!input || !results) return;

  let debounceTimer = null;
  let activeIdx     = -1;
  let pinMarker     = null;
  let activeSearch  = null;
  let searchVersion = 0;

  function cancelSearch() {
    searchVersion++;
    if (activeSearch) activeSearch.abort();
    activeSearch = null;
    input.setAttribute('aria-busy', 'false');
  }

  /* ── utilidades ── */

  function esc(str) {
    return String(str ?? '').replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );
  }

  function dropPin(lat, lng, label) {
    if (pinMarker) window.map.removeLayer(pinMarker);
    pinMarker = L.marker([lat, lng], {
      icon: L.divIcon({
        className: '',
        html: `<div style="
          width:28px;height:28px;
          background:#2563a8;
          border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);
          border:2.5px solid rgba(255,255,255,.9);
          box-shadow:0 2px 8px rgba(0,0,0,.35);
        "></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
        popupAnchor: [0, -30],
      }),
    })
    .bindPopup(`<div style="font-family:var(--font-ui,sans-serif);font-size:.82rem;font-weight:600">${esc(label)}</div>`)
    .addTo(window.map)
    .openPopup();
  }

  /* ── renderizar resultados ── */

  function renderItems(items) {
    results.innerHTML = '';
    activeIdx = -1;
    items = items.filter(item => item && Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lon)));

    if (!items.length) {
      results.innerHTML = '<li class="map-search-empty" role="option">Sin resultados en Xalapa</li>';
      showResults(true);
      return;
    }

    items.forEach((item, i) => {
      const li = document.createElement('li');
      li.className = 'map-search-result';
      li.setAttribute('role', 'option');
      li.setAttribute('id', `sr-${i}`);
      li.setAttribute('aria-selected', 'false');

      // Nombre corto + dirección secundaria
      const parts = String(item.display_name || 'Destino').split(',');
      const name  = parts[0].trim();
      const sub   = parts.slice(1, 3).join(',').trim();

      li.innerHTML = `
        <span class="sr-icon" aria-hidden="true">📍</span>
        <span class="sr-body">
          <span class="sr-name">${esc(name)}</span>
          <span class="sr-sub">${esc(sub)}</span>
        </span>`;

      li.addEventListener('click', () => select(item));
      results.appendChild(li);
    });

    showResults(true);
  }

  function showResults(show) {
    results.hidden = !show;
    input.setAttribute('aria-expanded', String(show));
    if (!show) input.removeAttribute('aria-activedescendant');
  }

  function highlightItem(idx) {
    const items = results.querySelectorAll('.map-search-result');
    items.forEach((el, i) => {
      const active = i === idx;
      el.classList.toggle('is-active', active);
      el.setAttribute('aria-selected', String(active));
      if (active) input.setAttribute('aria-activedescendant', el.id);
    });
  }

  function select(item) {
    clearTimeout(debounceTimer);
    cancelSearch();
    const lat  = parseFloat(item.lat);
    const lng  = parseFloat(item.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const name = String(item.display_name || 'Destino').split(',')[0].trim();

    input.value = name;
    showResults(false);
    if (clearBtn) clearBtn.hidden = false;

    window.map.setView([lat, lng], 16, { animate: true });
    dropPin(lat, lng, name);

    document.dispatchEvent(new CustomEvent('safemap:destination', { detail: { lat, lng, name } }));
  }

  /* ── búsqueda en Nominatim ── */

  async function search(query) {
    const version = ++searchVersion;
    const controller = new AbortController();
    activeSearch = controller;
    input.setAttribute('aria-busy', 'true');
    results.innerHTML = '<li class="map-search-empty" role="option" aria-selected="false" aria-disabled="true">Buscando destinos…</li>';
    showResults(true);
    const url = new URL(NOMINATIM);
    url.searchParams.set('q',              query + ' Xalapa');
    url.searchParams.set('format',         'json');
    url.searchParams.set('limit',          MAX_RESULTS);
    url.searchParams.set('bounded',        '1');
    url.searchParams.set('viewbox',        XALAPA_BBOX);
    url.searchParams.set('addressdetails', '0');
    url.searchParams.set('accept-language','es');

    try {
      const res  = await fetch(url, { headers: { 'Accept-Language': 'es' }, signal: controller.signal });
      if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
      const data = await res.json();
      if (version === searchVersion) renderItems(Array.isArray(data) ? data : []);
    } catch (error) {
      if (error.name === 'AbortError' || version !== searchVersion) return;
      results.innerHTML = '<li class="map-search-empty" role="option">Error de conexión</li>';
      showResults(true);
    } finally {
      if (version === searchVersion) {
        activeSearch = null;
        input.setAttribute('aria-busy', 'false');
      }
    }
  }

  /* ── eventos ── */

  input.addEventListener('input', () => {
    const q = input.value.trim();
    if (clearBtn) clearBtn.hidden = !q;

    clearTimeout(debounceTimer);
    cancelSearch();

    if (q.length < MIN_CHARS) { showResults(false); return; }

    debounceTimer = setTimeout(() => search(q), DEBOUNCE_MS);
  });

  // Navegación con teclado
  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      clearTimeout(debounceTimer);
      cancelSearch();
      showResults(false);
      input.blur();
      return;
    }
    const items = results.querySelectorAll('.map-search-result');
    if (!items.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIdx = Math.min(activeIdx + 1, items.length - 1);
      highlightItem(activeIdx);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIdx = Math.max(activeIdx - 1, 0);
      highlightItem(activeIdx);
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      items[activeIdx].click();
    }
  });

  // Cerrar al hacer clic fuera
  document.addEventListener('click', e => {
    if (!e.target.closest('.map-search')) {
      clearTimeout(debounceTimer);
      cancelSearch();
      showResults(false);
    }
  });

  // Botón limpiar
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      clearTimeout(debounceTimer);
      cancelSearch();
      input.value = '';
      clearBtn.hidden = true;
      showResults(false);
      if (pinMarker) { window.map.removeLayer(pinMarker); pinMarker = null; }
      if (window.SafeMapRouting) window.SafeMapRouting.clear();
      input.focus();
    });
  }

})();
