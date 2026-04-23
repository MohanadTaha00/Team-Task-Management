// Shared frontend helpers: API calls, toasts, session bootstrap, small UI bits.

async function api(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  let data = null;
  try { data = await res.json(); } catch (_) { /* no body */ }
  if (!res.ok) {
    const err = new Error((data && data.error) || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

function toast(message, type = '') {
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.className = `toast show ${type}`;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), 2500);
}

function initials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// Renders the app header. `active` is 'dashboard' or 'admin'.
function renderHeader(user, active) {
  const isAdmin = user.role === 'admin';
  return `
    <header class="app-header">
      <div class="brand">
        <span class="brand-mark">T</span>
        <span>Team Tasks</span>
      </div>
      <nav class="header-nav">
        <a href="/dashboard.html" class="${active === 'dashboard' ? 'active' : ''}">My Tasks</a>
        ${isAdmin ? `<a href="/admin.html" class="${active === 'admin' ? 'active' : ''}">Admin</a>` : ''}
      </nav>
      <div style="display:flex;align-items:center;gap:12px;">
        <div class="user-chip">
          <span class="avatar">${initials(user.full_name)}</span>
          <span>${escapeHtml(user.full_name)}</span>
          <span class="role-pill">${user.role}</span>
        </div>
        <button class="btn btn-secondary btn-sm" id="logoutBtn">Logout</button>
      </div>
    </header>
  `;
}

function attachLogout() {
  const btn = document.getElementById('logoutBtn');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    try { await api('/api/logout', { method: 'POST' }); } catch (_) {}
    window.location.href = '/';
  });
}

// Redirects to login if not authenticated; returns the user object otherwise.
async function requireSession(expectedRole) {
  try {
    const me = await api('/api/me');
    if (expectedRole && me.role !== expectedRole) {
      window.location.href = '/dashboard.html';
      return null;
    }
    return me;
  } catch (err) {
    if (err.status === 401) {
      window.location.href = '/';
      return null;
    }
    throw err;
  }
}
