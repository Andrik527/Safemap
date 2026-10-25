/* =============================================
   SafeMap — map.js
   Mapa Leaflet + lógica de reportes (Fase 1)
   ============================================= */

// ── Datos de demo ──
const DEMO_REPORTS = [
  {
    id: 1,
    type: 'fire',
    label: 'Incendio',
    emoji: '🔥',
    color: '#E84855',
    title: 'Incendio en Colonia Obrera',
    desc: 'Humo visible desde varias cuadras, posible incendio en bodega.',
    lat: 19.5438,
    lng: -96.9172,
    time: 'Hace 12 min',
  },
  {
    id: 2,
    type: 'landslide',
    label: 'Deslave',
    emoji: '⛰️',
    color: '#F2A65A',
    title: 'Deslave en carretera Xalapa-Coatepec',
    desc: 'Tramo bloqueado, se recomienda tomar ruta alterna.',
    lat: 19.4780,
    lng: -96.9440,
    time: 'Hace 35 min',
  },
  {
    id: 3,
    type: 'flood',
    label: 'Inundación',
    emoji: '🌊',
    color: '#3BB6D8',
    title: 'Calle inundada en Las Ánimas',
    desc: 'Agua llegando hasta la banqueta, evitar el área.',
    lat: 19.5590,
    lng: -96.9355,
    time: 'Hace 1 hr',
  },
];

// ── Estado ──
let activeFilter = 'all';
let selectedReportId = null;
let isGuest = true; // cambiar a false cuando haya sesión real
let markers = {};

// ── Inicializar mapa (Xalapa) ──
const map = L.map('map', {
  center: [19.543, -96.927],
  zoom: 13,
  zoomControl: true,
});

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  maxZoom: 19,
}).addTo(map);

// ── Marcadores custom ──
function createMarkerIcon(report) {
  return L.divIcon({
    className: '',
    html: `
      <div style="
        width:32px; height:32px;
        background:${report.color};
        border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        border:2.5px solid rgba(255,255,255,0.9);
        box-shadow:0 2px 8px rgba(0,0,0,0.3);
        display:flex; align-items:center; justify-content:center;
      ">
        <span style="transform:rotate(45deg); font-size:14px; line-height:1;">${report.emoji}</span>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -34],
  });
}

// ── Construir popup ──
function buildPopup(r) {
  return `
    <div class="incident-popup">
      <div class="popup-type" style="color:${r.color}">${r.label}</div>
      <div class="popup-title">${r.title}</div>
      <div class="popup-desc">${r.desc}</div>
      <div class="popup-time">${r.time}</div>
    </div>
  `;
}

// ── Renderizar marcadores ──
function renderMarkers() {
  // Limpiar previos
  Object.values(markers).forEach(m => map.removeLayer(m));
  markers = {};

  const filtered = DEMO_REPORTS.filter(r =>
    activeFilter === 'all' || r.type === activeFilter
  );

  filtered.forEach(r => {
    const marker = L.marker([r.lat, r.lng], { icon: createMarkerIcon(r) })
      .bindPopup(buildPopup(r), { maxWidth: 260 })
      .addTo(map);

    marker.on('click', () => selectReport(r.id));
    markers[r.id] = marker;
  });
}

// ── Renderizar lista ──
function renderList() {
  const list = document.getElementById('reportList');
  const empty = document.getElementById('emptyState');
  const countEl = document.getElementById('activeCount');

  const filtered = DEMO_REPORTS.filter(r =>
    activeFilter === 'all' || r.type === activeFilter
  );

  countEl.textContent = filtered.length;

  // Limpiar tarjetas previas
  list.querySelectorAll('.report-card').forEach(el => el.remove());

  if (filtered.length === 0) {
    empty.hidden = false;
    showToast('Sin reportes en este filtro');
    return;
  }

  empty.hidden = true;
  hideToast();

  filtered.forEach(r => {
    const card = document.createElement('div');
    card.className = 'report-card';
    card.dataset.id = r.id;
    card.innerHTML = `
      <div class="report-type-dot" style="background:${r.color}"></div>
      <div class="report-card-body">
        <div class="report-card-title">${r.title}</div>
        <div class="report-card-desc">${r.desc}</div>
        <div class="report-card-meta">${r.emoji} ${r.label} &middot; ${r.time}</div>
      </div>
    `;
    card.addEventListener('click', () => selectReport(r.id));
    list.appendChild(card);
  });
}

// ── Seleccionar reporte ──
function selectReport(id) {
  selectedReportId = id;

  // Actualizar tarjetas
  document.querySelectorAll('.report-card').forEach(el => {
    el.classList.toggle('is-selected', parseInt(el.dataset.id) === id);
  });

  // Mostrar popup en mapa
  const marker = markers[id];
  const report = DEMO_REPORTS.find(r => r.id === id);
  if (marker && report) {
    map.setView([report.lat, report.lng], 15, { animate: true });
    marker.openPopup();
  }
}

// ── Filtros ──
document.querySelectorAll('.filter-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('filter-chip--active'));
    chip.classList.add('filter-chip--active');
    activeFilter = chip.dataset.filter;
    renderMarkers();
    renderList();
  });
});

// ── Ubicarme ──
document.getElementById('locateMe').addEventListener('click', () => {
  if (!navigator.geolocation) {
    showToast('Tu navegador no soporta geolocalización');
    return;
  }
  navigator.geolocation.getCurrentPosition(
    pos => {
      map.setView([pos.coords.latitude, pos.coords.longitude], 15, { animate: true });
    },
    () => showToast('No se pudo obtener tu ubicación')
  );
});

// ── Toast ──
function showToast(msg) {
  const toast = document.getElementById('mapToast');
  document.getElementById('toastMsg').textContent = msg;
  toast.hidden = false;
}

function hideToast() {
  document.getElementById('mapToast').hidden = true;
}

// ── Sidebar mobile ──
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');

sidebarToggle.addEventListener('click', () => {
  sidebar.classList.toggle('is-open');
});

// Cerrar sidebar al click en el mapa (mobile)
map.on('click', () => {
  if (window.innerWidth <= 768) {
    sidebar.classList.remove('is-open');
  }
});

// ── Modal de reporte ──
const overlay  = document.getElementById('modalOverlay');
const modalClose = document.getElementById('modalClose');
const cancelBtn  = document.getElementById('cancelReport');
const submitBtn  = document.getElementById('submitReport');
const guestNotice = document.getElementById('modalGuestNotice');
const modalFooter = document.getElementById('modalFooter');
const descField  = document.getElementById('descField');
const locField   = document.getElementById('locField');
let selectedType = null;
let reportLat = null, reportLng = null;

document.getElementById('reportFab').addEventListener('click', openModal);

function openModal() {
  overlay.hidden = false;
  selectedType = null;
  document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('is-selected'));
  descField.hidden = true;
  locField.hidden = true;
  modalFooter.hidden = true;
  guestNotice.hidden = !isGuest;
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  overlay.hidden = true;
  document.body.style.overflow = '';
}

modalClose.addEventListener('click', closeModal);
cancelBtn.addEventListener('click', closeModal);

overlay.addEventListener('click', e => {
  if (e.target === overlay) closeModal();
});

// Selección de tipo
document.querySelectorAll('.type-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (isGuest) return; // invitados no pueden reportar
    document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('is-selected'));
    btn.classList.add('is-selected');
    selectedType = btn.dataset.type;
    descField.hidden = false;
    locField.hidden = false;
    modalFooter.hidden = false;
  });
});

// Usar mi ubicación
document.getElementById('useMyLoc').addEventListener('click', () => {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(pos => {
    reportLat = pos.coords.latitude;
    reportLng = pos.coords.longitude;
    document.getElementById('locText').textContent =
      `${reportLat.toFixed(5)}, ${reportLng.toFixed(5)}`;
  });
});

// Publicar reporte (demo)
submitBtn.addEventListener('click', () => {
  const desc = document.getElementById('reportDesc').value.trim();
  if (!selectedType) { alert('Selecciona un tipo de incidente.'); return; }
  if (!desc) { alert('Agrega una descripción.'); return; }

  // Demo: agregar marcador localmente
  const typeMap = {
    fire:      { label:'Incendio',    emoji:'🔥', color:'#E84855' },
    landslide: { label:'Deslave',     emoji:'⛰️', color:'#F2A65A' },
    flood:     { label:'Inundación',  emoji:'🌊', color:'#3BB6D8' },
    accident:  { label:'Accidente',   emoji:'🚨', color:'#6B8F71' },
    other:     { label:'Otro',        emoji:'⚠️', color:'#697A84' },
  };

  const t = typeMap[selectedType];
  const center = map.getCenter();
  const newReport = {
    id: Date.now(),
    type: selectedType,
    ...t,
    title: `${t.label} reportado`,
    desc,
    lat: reportLat || center.lat,
    lng: reportLng || center.lng,
    time: 'Ahora',
  };

  DEMO_REPORTS.unshift(newReport);
  renderMarkers();
  renderList();
  closeModal();
  selectReport(newReport.id);
  showToast('Reporte publicado');
  setTimeout(hideToast, 3000);
});

// ── Init ──
renderMarkers();
renderList();
