/* =============================================
   KING-YOUTH | GREATER — SHARED API CLIENT
   ============================================= */

// ── Config — change this to your server URL ───
const API_BASE = 'https://king-s-youth-production.up.railway.app/api';

// ── Cart (stays in memory/sessionStorage) ─────
const CART = JSON.parse(sessionStorage.getItem('greater_cart') || '[]');

function saveCart() {
  sessionStorage.setItem('greater_cart', JSON.stringify(CART));
}

// ── Auth token ────────────────────────────────
function getToken() { return sessionStorage.getItem('greater_token'); }
function setToken(t) { sessionStorage.setItem('greater_token', t); }
function clearToken() { sessionStorage.removeItem('greater_token'); sessionStorage.removeItem('greater_admin'); }
function isLoggedIn() { return !!getToken(); }

// ── API Helper ────────────────────────────────
async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) }
  });

  if (res.status === 401) {
    clearToken();
    window.location.href = 'admin-login.html';
    return;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ── Auth ──────────────────────────────────────
async function adminLogin(username, password) {
  const data = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
  setToken(data.token);
  sessionStorage.setItem('greater_admin', username);
  return true;
}

function adminLogout() {
  clearToken();
  window.location.href = 'index.html';
}

function requireAdmin() {
  if (!isLoggedIn()) window.location.href = 'admin-login.html';
}

// ── Events API ────────────────────────────────
const Events = {
  getAll: () => api('/events'),
  getOne: (id) => api(`/events/${id}`),
  getCount: (id) => api(`/events/${id}/registration-count`),
  create: (data) => api('/events', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => api(`/events/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => api(`/events/${id}`, { method: 'DELETE' })
};

// ── Registrations API ─────────────────────────
const Registrations = {
  getAll: (event_id) => api('/registrations' + (event_id ? `?event_id=${event_id}` : '')),
  create: (data) => api('/registrations', { method: 'POST', body: JSON.stringify(data) }),
  delete: (id) => api(`/registrations/${id}`, { method: 'DELETE' }),
  exportURL: (event_id) => `${API_BASE}/registrations/export${event_id ? `?event_id=${event_id}` : ''}`
};

// ── Products API ──────────────────────────────
const Products = {
  getAll: () => api('/products'),
  create: (data) => api('/products', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => api(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => api(`/products/${id}`, { method: 'DELETE' })
};

// ── Orders API ────────────────────────────────
const Orders = {
  getAll: () => api('/orders'),
  create: (data) => api('/orders', { method: 'POST', body: JSON.stringify(data) }),
  updateStatus: (id, status) => api(`/orders/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  delete: (id) => api(`/orders/${id}`, { method: 'DELETE' }),
  exportURL: () => `${API_BASE}/orders/export`
};

// ── Settings API ──────────────────────────────
const Settings = {
  get: () => api('/settings'),
  update: (data) => api('/settings', { method: 'PUT', body: JSON.stringify(data) })
};

// ── Stats API ─────────────────────────────────
const Stats = {
  get: () => api('/stats')
};

// ── Toast ─────────────────────────────────────
function toast(msg, type = 'info') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const div = document.createElement('div');
  div.className = 'toast ' + type;
  div.innerHTML = `<span>${icons[type]||'ℹ️'}</span><span>${msg}</span>`;
  container.appendChild(div);
  setTimeout(() => {
    div.style.cssText += 'opacity:0;transform:translateX(20px);transition:all .3s';
    setTimeout(() => div.remove(), 300);
  }, 3500);
}

// ── Modal helpers ─────────────────────────────
function openModal(id)  { document.getElementById(id)?.classList.add('active'); }
function closeModal(id) { document.getElementById(id)?.classList.remove('active'); }

function initModalOverlayClose() {
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('active'); });
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape')
      document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
  });
}

// ── Upload helper ─────────────────────────────
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function initUploadZones() {
  document.querySelectorAll('.upload-zone').forEach(zone => {
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const input = zone.querySelector('input[type=file]');
      if (input) { input.files = e.dataTransfer.files; input.dispatchEvent(new Event('change')); }
    });
    zone.addEventListener('click', () => zone.querySelector('input[type=file]')?.click());
  });
}

// ── Cart helpers ──────────────────────────────
function getCartTotal() {
  return CART.reduce((s, i) => s + i.price * i.qty, 0);
}
function getCartCount() {
  return CART.reduce((s, i) => s + i.qty, 0);
}
function updateCartBadge() {
  const badge = document.getElementById('cartBadge');
  const count = getCartCount();
  if (badge) { badge.textContent = count; badge.style.display = count ? 'flex' : 'none'; }
}

// ── Nav helpers ───────────────────────────────
function setActiveNav() {
  const page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.getAttribute('href') === page);
  });
}

// ── Event card HTML ───────────────────────────
function eventCardHTML(ev) {
  const spotsLeft = ev.max_participants - (ev.registered || 0);
  const pct = Math.round(((ev.registered || 0) / ev.max_participants) * 100);
  const statusClass = { open: 'success', upcoming: 'info', closed: 'danger' }[ev.status] || 'info';
  return `
  <div class="event-card">
    ${ev.media?.[0] ? `<div class="event-img" style="background-image:url('${ev.media[0]}')"></div>` : '<div class="event-img event-img-placeholder"><span>📅</span></div>'}
    <div class="event-body">
      <div class="event-meta">
        <span class="badge badge-${statusClass}">${ev.status}</span>
        ${ev.fee > 0 ? `<span class="badge badge-gold">₱${Number(ev.fee).toLocaleString()}</span>` : '<span class="badge badge-success">FREE</span>'}
      </div>
      <h3 class="event-title">${ev.name}</h3>
      <p class="event-detail">📅 ${formatDate(ev.date ? String(ev.date).substring(0,10) : ev.date)}${ev.end_date ? ' – ' + formatDate(ev.end_date ? String(ev.end_date).substring(0,10) : ev.end_date) : ''}</p>
      ${ev.time ? `<p class="event-detail">🕐 ${ev.time}</p>` : ''}
      ${ev.location ? `<p class="event-detail">📍 ${ev.location}</p>` : ''}
      ${ev.description ? `<p class="event-desc">${ev.description}</p>` : ''}
      <div class="capacity-bar-wrap">
        <div class="capacity-bar"><div class="capacity-fill" style="width:${pct}%"></div></div>
        <span class="capacity-label">${spotsLeft > 0 ? `${spotsLeft} spots left` : 'FULL'}</span>
      </div>
      ${ev.status === 'open' && spotsLeft > 0
        ? `<a href="register.html?event=${ev.id}" class="btn btn-primary btn-sm">Register Now</a>`
        : `<span class="btn btn-ghost btn-sm" style="cursor:default">${ev.status === 'open' ? 'Event Full' : 'Registration Closed'}</span>`}
    </div>
  </div>`;
}

function formatDate(d) {
  if (!d) return '';
  const s = typeof d === 'string' ? d.substring(0, 10) : String(d);
  const parts = s.split('-');
  if (parts.length !== 3) return '';
  return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])).toLocaleDateString('en-PH', { year:'numeric', month:'long', day:'numeric' });
}

// ── CSV download ──────────────────────────────
function downloadCSV(rows, filename) {
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

// ── Export with auth token appended to URL ────
function exportWithAuth(url) {
  // For CSV exports, we append the token as a query param since
  // fetch-based download is complex. Alternatively open in new tab.
  const token = getToken();
  const a = document.createElement('a');
  a.href = url + (url.includes('?') ? '&' : '?') + `token=${token}`;
  a.click();
}

async function loadNavLogo() {
  try {
    const res = await fetch(API_BASE.replace('/api', '') + '/api/settings/public');
    const data = await res.json();
      if (data.site_logo) {
        const icon = document.getElementById('navLogoIcon');
        if (icon) {
          icon.style.cssText = 'width:40px;height:40px;overflow:hidden;background:transparent;clip-path:none;padding:0';
          icon.innerHTML = `<img src="${data.site_logo}" style="width:100%;height:100%;object-fit:contain">`;
        }
      }
  } catch(e) {}
}