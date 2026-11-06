/**
 * SafeMap — map-reputation.js
 * Chip de puntos en el topbar + panel con nivel, racha e insignias.
 * Solo se carga con sesión iniciada. Carga DESPUÉS de map-ux.js.
 */
(function () {
  'use strict';

  if (window.SAFEMAP && window.SAFEMAP.isGuest) return;

  const chip = document.getElementById('repChip');
  const panel = document.getElementById('repPanel');
  const pointsEl = document.getElementById('repPoints');
  if (!chip || !panel || !pointsEl) return;

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[ch]));
  }

  function render(d) {
    pointsEl.textContent = d.points;

    const next = d.level.next;
    const nextText = next
      ? `${next.min - d.points} puntos para ${esc(next.name)}`
      : 'Nivel máximo alcanzado';

    const badges = d.badges.map(b => `
      <li class="rep-badge ${b.earned ? 'is-earned' : 'is-locked'}" title="${esc(b.description)}">
        <span class="rep-badge-icon">${b.earned ? esc(b.icon) : '🔒'}</span>
        <span class="rep-badge-text">
          <strong>${esc(b.label)}</strong>
          <small>${esc(b.description)}</small>
        </span>
      </li>`).join('');

    panel.innerHTML = `
      <div class="rep-head">
        <span class="rep-level">${esc(d.level.icon)} ${esc(d.level.name)}</span>
        <span class="rep-total">${d.points} pts</span>
      </div>
      <div class="rep-progress" role="progressbar" aria-valuenow="${d.level.progress}" aria-valuemin="0" aria-valuemax="100">
        <div class="rep-progress-bar" style="width:${d.level.progress}%"></div>
      </div>
      <p class="rep-next">${nextText}</p>

      <div class="rep-stats">
        <span title="Reportes seguidos confirmados">🔥 Racha <strong>${d.streak}</strong></span>
        <span title="Reportes verificados">✔ <strong>${d.verified}</strong></span>
        <span title="Reportes rechazados">✕ <strong>${d.rejected}</strong></span>
      </div>

      <h4 class="rep-title">Insignias</h4>
      <ul class="rep-badges">${badges}</ul>

      <p class="rep-hint">Ganas puntos cuando otros ciudadanos confirman tus reportes y cuando validas los suyos.
      Los reportes falsos restan puntos.</p>
    `;
  }

  async function refresh() {
    try {
      const res = await fetch('/api/me/reputation', {
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
      });
      if (!res.ok) return;
      const { data } = await res.json();
      render(data);

      if (data.new_badges && data.new_badges.length && window.SafeMapUX) {
        window.SafeMapUX.showToastUX('🏅 Nueva insignia: ' + data.new_badges.join(', '), 'success');
      }
    } catch (err) {
      console.error('[SafeMap] Reputación:', err);
    }
  }

  function setOpen(open) {
    panel.hidden = !open;
    chip.setAttribute('aria-expanded', String(open));
  }

  chip.addEventListener('click', e => {
    e.stopPropagation();
    setOpen(panel.hidden);
  });
  document.addEventListener('click', e => {
    if (!panel.hidden && !e.target.closest('#repPanel')) setOpen(false);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') setOpen(false);
  });

  // Al volver a la pestaña se actualiza (por si otros confirmaron tus reportes)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refresh();
  });

  window.SafeMapRep = { refresh };
  refresh();
})();
