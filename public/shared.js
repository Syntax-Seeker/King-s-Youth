/* =============================================
   KING-YOUTH | GREATER — SHARED API CLIENT
   ============================================= */

// ── Config — change this to your server URL ───
const API_BASE = 'https://king-s-youth.onrender.com/api';

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
  getSlim: () => api('/events/slim'),
  getOne: (id) => api(`/events/${id}`),
  getCount: (id) => api(`/events/${id}/registration-count`),
  create: (data) => api('/events', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => api(`/events/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => api(`/events/${id}`, { method: 'DELETE' })
};

// ── Registrations API ─────────────────────────
const Registrations = {
  getAll: (event_id) => api('/registrations' + (event_id ? `?event_id=${event_id}` : '')),
  getSlim: () => api('/registrations/slim'),
  create: (data) => api('/registrations', { method: 'POST', body: JSON.stringify(data) }),
  delete: (id) => api(`/registrations/${id}`, { method: 'DELETE' }),
  exportURL: (event_id) => `${API_BASE}/registrations/export${event_id ? `?event_id=${event_id}` : ''}`,
  exportJson: (event_id) => api('/registrations/export-json' + (event_id ? `?event_id=${event_id}` : ''))
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


// ── Sessions API ──────────────────────────────
const Sessions = {
  getByEvent: (eventId) => api(`/events/${eventId}/sessions`),
  getCount:   (id)      => api(`/sessions/${id}/count`),
  create: (eventId, data) => api(`/events/${eventId}/sessions`, { method:'POST', body:JSON.stringify(data) }),
  update: (id, data) => api(`/sessions/${id}`, { method:'PUT', body:JSON.stringify(data) }),
  delete: (id) => api(`/sessions/${id}`, { method:'DELETE' }),
};

// \u2500\u2500 Event card HTML \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
function eventCardHTML(ev) {
  const maxP = parseInt(ev.max_participants) || 0;
  const reg  = parseInt(ev.registered) || 0;
  const spotsLeft = maxP > 0 ? maxP - reg : null;
  const pct = maxP > 0 ? Math.min(100, Math.round(reg / maxP * 100)) : 0;
  const statusClass = { open: 'success', upcoming: 'info', closed: 'danger' }[ev.status] || 'info';
  const m = Array.isArray(ev.media) ? ev.media[0] : (typeof ev.media === 'string' && ev.media.startsWith('data:') ? ev.media : null);
  const dateStr = ev.date ? String(ev.date).substring(0,10) : '';
  const endStr  = ev.end_date ? String(ev.end_date).substring(0,10) : '';
  const dateLabel = dateStr ? (endStr && endStr !== dateStr ? formatDate(dateStr) + ' \u2013 ' + formatDate(endStr) : formatDate(dateStr)) : '';
  const isFull = spotsLeft !== null && spotsLeft <= 0;
  const canReg = ev.status === 'open' && !isFull;
  return `
  <div class="event-card">
    <div class="event-img${m ? '' : ' event-img-placeholder'}" ${m ? `style="background-image:url('${m}')"` : ''}>
      ${m ? '' : '<span>\u{1F4C5}</span>'}
      ${dateLabel ? `<div class="event-date-badge">\u{1F4C5} ${dateLabel}</div>` : ''}
    </div>
    <div class="event-body">
      <div class="event-meta">
        <span class="badge badge-${statusClass}">${ev.status}</span>
        ${Number(ev.fee) > 0 ? `<span class="badge badge-gold">\u20B1${Number(ev.fee).toLocaleString()}</span>` : '<span class="badge badge-success">FREE</span>'}
      </div>
      <h3 class="event-title">${ev.name}</h3>
      ${ev.time ? `<p class="event-detail">\u{1F550} ${ev.time}</p>` : ''}
      ${ev.location ? `<p class="event-detail">\u{1F4CD} ${ev.location}</p>` : ''}
      ${spotsLeft !== null ? `
      <div class="event-spots-bar">
        <div class="capacity-bar"><div class="capacity-fill" style="width:${pct}%"></div></div>
        <span class="capacity-label" style="font-size:.78rem;color:var(--white-dim)">${isFull ? '\u26D4 FULL' : `${spotsLeft} spots left`}</span>
      </div>` : ''}
      <div class="event-card-footer">
        <button class="btn btn-outline btn-sm view-details-btn" data-id="${ev.id}">View Details</button>
        ${canReg
          ? `<a href="register.html?event=${ev.id}" class="btn btn-primary btn-sm">Register</a>`
          : `<span class="btn btn-sm" style="cursor:default;opacity:.5;border:1px solid var(--border)">${isFull ? 'Full' : 'Closed'}</span>`}
      </div>
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

// ── Footer dynamic loader ─────────────────────
// Call this after injecting footer.html into the DOM
async function loadFooterInfo() {
  try {
    const res = await fetch('https://king-s-youth.onrender.com/api/settings/public');
    if (!res.ok) return;
    const d = await res.json();

    // Ministry name
    const nameEl = document.getElementById('footerMinistryName');
    if (nameEl && d.ministry_name) nameEl.textContent = d.ministry_name;

    // Copyright line
    const copy = document.getElementById('footerCopyright');
    if (copy) copy.textContent = '© ' + new Date().getFullYear() + ' ' + (d.ministry_name || "King's Youth Ministry") + ' · GREATER · All Rights Reserved';

    // Contact info
    const emailEl = document.getElementById('footerEmail');
    if (emailEl && d.ministry_email) { emailEl.textContent = d.ministry_email; emailEl.href = 'mailto:' + d.ministry_email; }

    const phoneEl = document.getElementById('footerPhone');
    if (phoneEl && d.ministry_phone) phoneEl.textContent = d.ministry_phone;

    const addrEl = document.getElementById('footerAddress');
    if (addrEl && d.ministry_address) addrEl.textContent = d.ministry_address;

    // Logo
    const logoEl = document.getElementById('footerLogoIcon');
    if (logoEl && d.site_logo) {
      logoEl.style.cssText = 'width:44px;height:44px;overflow:hidden;clip-path:polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%);background:transparent;flex-shrink:0;';
      logoEl.innerHTML = '<img src="' + d.site_logo + '" style="width:100%;height:100%;object-fit:cover">';
    }
  } catch(e) { /* fail silently */ }
}

// ── Nav logo loader ───────────────────────────
// Called after nav.html is injected to load custom logo from settings
async function loadNavLogo() {
  try {
    const res = await fetch('https://king-s-youth.onrender.com/api/settings/public');
    if (!res.ok) return;
    const data = await res.json();
    if (data.site_logo) {
      const icon = document.getElementById('navLogoIcon');
      if (icon) {
        icon.style.cssText = 'width:40px;height:40px;overflow:hidden;background:transparent;clip-path:none;padding:0;flex-shrink:0';
        icon.innerHTML = '<img src="' + data.site_logo + '" style="width:100%;height:100%;object-fit:contain">';
      }
    }
  } catch(e) {}
}
