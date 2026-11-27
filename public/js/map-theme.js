/**
 * SafeMap — map-theme.js   (Idea 2: modo automático día/noche)
 * ------------------------------------------------------------------
 * Se carga en el <head> (antes de pintar) para evitar el "flash" blanco de noche.
 *
 * Reglas:
 *   · 06:00 – 17:59  → modo claro.
 *   · 18:00 – 05:59  → modo oscuro real (filtro de inversión CSS sobre las teselas).
 *   · Interruptor manual que cicla: automático → oscuro → claro → automático.
 *   · La preferencia se guarda en localStorage ('safemap_theme').
 *
 * Aplica el tema con [data-theme="dark|light"] en <html>, que es lo que
 * consume public/css/dark-mode.css (incluido el filtro de .leaflet-tile-pane).
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'safemap_theme';   // 'auto' | 'light' | 'dark'
  const DAY_START   = 6;                 // 06:00 → claro
  const NIGHT_START = 18;                // 18:00 → oscuro

  const root = document.documentElement;

  /* ── preferencia y resolución ── */

  function storedPref() {
    const value = localStorage.getItem(STORAGE_KEY);
    return (value === 'auto' || value === 'light' || value === 'dark') ? value : 'auto';
  }

  function isDaytime() {
    const h = new Date().getHours();
    return h >= DAY_START && h < NIGHT_START;
  }

  /** Resuelve la preferencia a un tema concreto ('light' | 'dark'). */
  function resolve(pref) {
    if (pref === 'light' || pref === 'dark') return pref;
    return isDaytime() ? 'light' : 'dark';   // 'auto'
  }

  /* ── aplicación visual ── */

  function paint(pref) {
    const resolved = resolve(pref);
    const previous = root.getAttribute('data-theme');
    root.setAttribute('data-theme', resolved);

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', resolved === 'dark' ? '#0A1520' : '#1B3A4B');

    updateButton(pref, resolved);
    if (previous !== resolved) {
      document.dispatchEvent(new CustomEvent('safemap:theme-changed', { detail: { theme: resolved } }));
    }
  }

  function updateButton(pref, resolved) {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;

    const dark = resolved === 'dark';
    // auto: icono según lo que toque ahora · manual: icono que indica a qué cambiará
    btn.textContent = pref === 'auto' ? (dark ? '🌗' : '🌤️') : (dark ? '☀️' : '🌙');
    btn.dataset.mode = pref;
    btn.setAttribute('aria-pressed', String(dark));
    btn.title = pref === 'auto'
      ? `Automático ahora en modo ${dark ? 'oscuro' : 'claro'} · clic para cambiar`
      : (dark ? 'Modo oscuro (manual) · clic para cambiar' : 'Modo claro (manual) · clic para cambiar');
    btn.setAttribute('aria-label', btn.title);
  }

  /* ── arranque inmediato (sin esperar al DOM) ── */

  let pref = storedPref();
  root.setAttribute('data-theme', resolve(pref));

  /* ── interruptor manual ── */

  function cycle(current) {
    if (current === 'auto') return 'dark';
    if (current === 'dark') return 'light';
    return 'auto';
  }

  document.addEventListener('DOMContentLoaded', () => {
    paint(pref);   // sincroniza icono/estado con el <button> ya presente

    const btn = document.getElementById('theme-toggle');
    if (btn && !btn.dataset.themeBound) {
      btn.dataset.themeBound = '1';
      btn.addEventListener('click', () => {
        pref = cycle(storedPref());
        localStorage.setItem(STORAGE_KEY, pref);
        paint(pref);
      });
    }
  });

  /* ── re-evaluar en automático (por si cruza las 06:00 / 18:00 con la página abierta) ── */

  setInterval(() => {
    if (storedPref() === 'auto') {
      pref = 'auto';
      paint('auto');
    }
  }, 60000);

  /* ── API pública (opcional, para otros módulos) ── */

  window.SafeMapTheme = {
    resolved:   () => resolve(storedPref()),
    preference: () => storedPref(),
    set: (value) => {
      pref = (value === 'auto' || value === 'light' || value === 'dark') ? value : 'auto';
      localStorage.setItem(STORAGE_KEY, pref);
      paint(pref);
    },
  };
})();
