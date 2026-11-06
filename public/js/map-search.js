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
  const DEBOUNCE_MS = 380;
  const MIN_CHARS   = 3;
  const MAX_RESULTS = 6;

  const input    = document.getElementById('searchInput');
  const results  = document.getElementById('searchResults');
  const clearBtn = document.getElementById('searchClear');

  if (!input || !results) return;

  let debounceTimer = null;
  let activeIdx     = -1;
  let pinMarker     = null;

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
      const parts = item.display_name.split(',');
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
    const lat  = parseFloat(item.lat);
    const lng  = parseFloat(item.lon);
    const name = item.display_name.split(',')[0].trim();

    input.value = name;
    showResults(false);
    if (clearBtn) clearBtn.hidden = false;

    window.map.setView([lat, lng], 16, { animate: true });
    dropPin(lat, lng, name);
  }

  /* ── búsqueda en Nominatim ── */

  async function search(query) {
    const url = new URL(NOMINATIM);
    url.searchParams.set('q',              query + ' Xalapa');
    url.searchParams.set('format',         'json');
    url.searchParams.set('limit',          MAX_RESULTS);
    url.searchParams.set('bounded',        '1');
    url.searchParams.set('viewbox',        XALAPA_BBOX);
    url.searchParams.set('addressdetails', '0');
    url.searchParams.set('accept-language','es');

    try {
      const res  = await fetch(url, { headers: { 'Accept-Language': 'es' } });
      const data = await res.json();
      renderItems(data);
    } catch (_) {
      results.innerHTML = '<li class="map-search-empty" role="option">Error de conexión</li>';
      showResults(true);
    }
  }

  /* ── eventos ── */

  input.addEventListener('input', () => {
    const q = input.value.trim();
    if (clearBtn) clearBtn.hidden = !q;

    clearTimeout(debounceTimer);

    if (q.length < MIN_CHARS) { showResults(false); return; }

    debounceTimer = setTimeout(() => search(q), DEBOUNCE_MS);
  });

  // Navegación con teclado
  input.addEventListener('keydown', e => {
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
    } else if (e.key === 'Escape') {
      showResults(false);
      input.blur();
    }
  });

  // Cerrar al hacer clic fuera
  document.addEventListener('click', e => {
    if (!e.target.closest('.map-search')) showResults(false);
  });

  // Botón limpiar
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      input.value = '';
      clearBtn.hidden = true;
      showResults(false);
      if (pinMarker) { window.map.removeLayer(pinMarker); pinMarker = null; }
      input.focus();
    });
  }

  /* ── CSS inline para los resultados ── */
  // (el resto de estilos va en dark-mode.css / map.css)
  const style = document.createElement('style');
  style.textContent = `
    .map-search {
      position: absolute;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      width: min(92%, 360px);
      z-index: 800;
    }
    .map-search-box {
      display: flex;
      align-items: center;
      background: var(--white, #fff);
      border: 1.5px solid var(--border, #D6CFC4);
      border-radius: 12px;
      box-shadow: 0 2px 12px rgba(27,58,75,.12);
      overflow: hidden;
      padding: 0 0.65rem;
      gap: 0.4rem;
    }
    .map-search-icon { color: var(--muted, #697A84); display:flex; flex-shrink:0; }
    #searchInput {
      flex: 1;
      border: none;
      outline: none;
      font-family: var(--font-body, sans-serif);
      font-size: 0.88rem;
      color: var(--ink, #111C22);
      background: transparent;
      padding: 0.7rem 0;
    }
    #searchInput::placeholder { color: var(--muted, #697A84); }
    .map-search-clear {
      background: none; border: none; cursor: pointer;
      color: var(--muted, #697A84); font-size: 0.8rem; padding: 0.2rem;
      border-radius: 4px; flex-shrink: 0;
    }
    .map-search-clear:hover { color: var(--ink, #111C22); }
    .map-search-results {
      list-style: none;
      background: var(--white, #fff);
      border: 1.5px solid var(--border, #D6CFC4);
      border-top: none;
      border-radius: 0 0 12px 12px;
      box-shadow: 0 8px 24px rgba(27,58,75,.12);
      max-height: 260px;
      overflow-y: auto;
      margin: 0; padding: 0.3rem 0;
    }
    .map-search-result {
      display: flex;
      align-items: flex-start;
      gap: 0.6rem;
      padding: 0.6rem 1rem;
      cursor: pointer;
      transition: background 0.12s;
    }
    .map-search-result:hover,
    .map-search-result.is-active { background: var(--surface, #F7F5F1); }
    .sr-icon { flex-shrink:0; font-size: 0.9rem; margin-top: 1px; }
    .sr-body { display:flex; flex-direction:column; gap:0.1rem; min-width:0; }
    .sr-name { font-family: var(--font-ui, sans-serif); font-size: 0.82rem; font-weight:600; color: var(--ink, #111C22); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .sr-sub  { font-size: 0.72rem; color: var(--muted, #697A84); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .map-search-empty { padding: 0.75rem 1rem; font-size: 0.8rem; color: var(--muted, #697A84); }
  `;
  document.head.appendChild(style);
})();
