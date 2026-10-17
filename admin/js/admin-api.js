/* Shared admin API helper + auth guard + layout utilities. */
const ADMIN_API_BASE = '/api/admin';

async function adminRequest(path, method = 'GET', body) {
  const isForm = body instanceof FormData;
  const res = await fetch(`${ADMIN_API_BASE}${path}`, {
    method,
    credentials: 'include',
    headers: isForm ? {} : { 'Content-Type': 'application/json' },
    body: isForm ? body : body ? JSON.stringify(body) : undefined
  });

  let data;
  try {
    data = await res.json();
  } catch (err) {
    data = { success: false, message: 'Unexpected server response.' };
  }

  if (res.status === 401 && !path.startsWith('/auth/login')) {
    window.location.href = '/admin/login.html';
    throw new Error('Session expired.');
  }
  if (!res.ok || data.success === false) {
    throw new Error(data.message || 'Something went wrong.');
  }
  return data;
}

const adminApi = {
  get: (path) => adminRequest(path, 'GET'),
  post: (path, body) => adminRequest(path, 'POST', body),
  put: (path, body) => adminRequest(path, 'PUT', body),
  patch: (path, body) => adminRequest(path, 'PATCH', body),
  del: (path) => adminRequest(path, 'DELETE')
};

function formatCurrency(amount, symbol = '₦') {
  const n = Number(amount) || 0;
  return `${symbol}${n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function badgeHtml(value) {
  return `<span class="badge badge-${value}">${String(value).replace('_', ' ')}</span>`;
}
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:10px;';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  const colors = { info: '#211c16', error: '#a13f34', success: '#3d6b4f' };
  toast.textContent = message;
  toast.style.cssText = `background:${colors[type] || colors.info};color:#f7f2e8;padding:13px 18px;border-radius:6px;font-family:Inter,sans-serif;font-size:0.88rem;box-shadow:0 12px 30px rgba(0,0,0,0.25);max-width:340px;`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s ease';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Auth guard: run on every admin page except login. Redirects to login if
// the session is invalid, and populates the admin name in the sidebar.
async function requireAdmin() {
  try {
    const res = await fetch('/api/admin/auth/me', { credentials: 'include' });
    if (!res.ok) throw new Error('unauthenticated');
    const data = await res.json();
    document.querySelectorAll('[data-admin-name]').forEach((el) => { el.textContent = data.admin.name; });
    document.querySelectorAll('[data-admin-role]').forEach((el) => { el.textContent = data.admin.role; });

    // Superadmin-only sidebar links / sections are hidden for everyone else.
    // The backend enforces this for real; this is purely a UI convenience.
    if (data.admin.role !== 'superadmin') {
      document.querySelectorAll('[data-superadmin-only]').forEach((el) => { el.style.display = 'none'; });
    }

    initNotificationBell();

    return data.admin;
  } catch (err) {
    window.location.href = '/admin/login.html';
    return null;
  }
}

function attachSidebarBehavior() {
  const toggle = document.getElementById('mobile-menu-btn');
  const sidebar = document.querySelector('.sidebar');
  if (toggle && sidebar) toggle.addEventListener('click', () => sidebar.classList.toggle('open'));

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try { await fetch('/api/admin/auth/logout', { method: 'POST', credentials: 'include' }); } catch (e) { /* noop */ }
      window.location.href = '/admin/login.html';
    });
  }
}

document.addEventListener('DOMContentLoaded', attachSidebarBehavior);

/* ==========================================================================
   Notification bell — polls the server for new bookings, contact messages,
   and pending testimonials, and surfaces them as: an in-page dropdown with
   an unread badge, a toast, and (if the browser grants permission) a native
   OS-level browser notification. No websocket/push infra required — this
   is a simple periodic poll, which is enough for a small hotel admin team.
   Call initNotificationBell() once, after requireAdmin() has succeeded, on
   any page whose topbar should show the bell (i.e. every dashboard page
   except login/signup).
   ========================================================================== */
const NOTIF_POLL_INTERVAL_MS = 45000;
const NOTIF_SINCE_KEY = 'admin_notif_since';
const NOTIF_SEEN_KEY = 'admin_notif_seen_items';

function notifTimeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return formatDate(dateStr);
}

function buildNotificationBell() {
  const topbar = document.querySelector('.topbar');
  if (!topbar || document.getElementById('notif-bell-wrap')) return null;

  const wrap = document.createElement('div');
  wrap.className = 'notif-bell-wrap';
  wrap.id = 'notif-bell-wrap';
  wrap.innerHTML = `
    <button class="notif-bell-btn" id="notif-bell-btn" aria-label="Notifications">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
      <span class="notif-bell-badge" id="notif-bell-badge" style="display:none;">0</span>
    </button>
    <div class="notif-dropdown" id="notif-dropdown">
      <div class="notif-dropdown-header">
        <h4>Notifications</h4>
        <button type="button" id="notif-mark-read">Mark all read</button>
      </div>
      <div id="notif-list"><div class="notif-empty">No new notifications.</div></div>
    </div>
  `;

  // Topbars have either one child (just the title block) or two (title
  // block + an existing action button/div). Group the bell with whatever
  // action content already exists so it doesn't get stranded awkwardly by
  // justify-content: space-between when there are 3+ direct children.
  const existingChildren = Array.from(topbar.children);
  if (existingChildren.length >= 2) {
    const actionsEl = existingChildren[existingChildren.length - 1];
    const actionsRow = document.createElement('div');
    actionsRow.style.cssText = 'display:flex;align-items:center;gap:14px;flex-wrap:wrap;';
    actionsEl.parentNode.insertBefore(actionsRow, actionsEl);
    actionsRow.appendChild(actionsEl);
    actionsRow.appendChild(wrap);
  } else {
    topbar.appendChild(wrap);
  }

  document.getElementById('notif-bell-btn').addEventListener('click', () => {
    document.getElementById('notif-dropdown').classList.toggle('open');
    // Some browsers only honor a permission prompt when triggered directly
    // by a user gesture like this click, so we also try here in case the
    // automatic request on page load was silently ignored.
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => { /* ignore */ });
    }
  });
  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) document.getElementById('notif-dropdown').classList.remove('open');
  });
  document.getElementById('notif-mark-read').addEventListener('click', () => {
    document.getElementById('notif-bell-badge').style.display = 'none';
    document.getElementById('notif-bell-badge').textContent = '0';
  });

  return wrap;
}

function renderNotificationList(items) {
  const list = document.getElementById('notif-list');
  if (!list) return;
  if (!items.length) {
    list.innerHTML = '<div class="notif-empty">No new notifications.</div>';
    return;
  }
  list.innerHTML = items.map((item) => `
    <a class="notif-item" href="${item.href}">
      <span class="notif-title">${item.title}</span>
      <span>${item.body}</span><br/>
      <span class="notif-time">${notifTimeAgo(item.createdAt)}</span>
    </a>
  `).join('');
}

function bumpNotifBadge(count) {
  const badge = document.getElementById('notif-bell-badge');
  if (!badge) return;
  const current = Number(badge.textContent) || 0;
  const next = current + count;
  badge.textContent = String(next);
  badge.style.display = next > 0 ? 'flex' : 'none';
}

async function pollNotifications() {
  const since = sessionStorage.getItem(NOTIF_SINCE_KEY) || new Date().toISOString();
  try {
    const res = await fetch(`/api/admin/dashboard/notifications?since=${encodeURIComponent(since)}`, { credentials: 'include' });
    if (!res.ok) return;
    const data = await res.json();
    if (!data.success) return;

    const items = [];
    data.bookings.forEach((b) => items.push({
      title: 'New booking received',
      body: `${b.guest.fullName} — ${b.bookingReference}`,
      href: `/admin/bookings.html?ref=${b.bookingReference}`,
      createdAt: b.createdAt
    }));
    data.messages.forEach((m) => items.push({
      title: 'New contact message',
      body: `${m.name}${m.subject ? ` — ${m.subject}` : ''}`,
      href: '/admin/messages.html',
      createdAt: m.createdAt
    }));
    data.testimonials.forEach((t) => items.push({
      title: 'New review awaiting approval',
      body: `${t.guestName} — ${t.rating}★`,
      href: '/admin/testimonials.html',
      createdAt: t.createdAt
    }));

    if (items.length) {
      items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      const existingList = document.getElementById('notif-list');
      const prevItems = existingList && !existingList.querySelector('.notif-empty')
        ? Array.from(existingList.querySelectorAll('.notif-item')).map((el) => el.outerHTML)
        : [];
      renderNotificationList(items);
      if (prevItems.length) {
        document.getElementById('notif-list').innerHTML += prevItems.join('');
      }

      bumpNotifBadge(items.length);

      items.forEach((item) => {
        showToast(`${item.title}: ${item.body}`, 'info');
      });

      if ('Notification' in window && Notification.permission === 'granted') {
        items.forEach((item) => {
          try {
            const n = new Notification(item.title, { body: item.body, tag: item.href });
            n.onclick = () => { window.focus(); window.location.href = item.href; };
          } catch (err) { /* some browsers restrict Notification outside a user gesture context */ }
        });
      }
    }

    sessionStorage.setItem(NOTIF_SINCE_KEY, data.serverTime);
  } catch (err) {
    // Silent failure — notifications are a convenience, not core functionality.
    console.error('Notification poll failed:', err);
  }
}

function initNotificationBell() {
  const wrap = buildNotificationBell();
  if (!wrap) return;

  if (!sessionStorage.getItem(NOTIF_SINCE_KEY)) {
    sessionStorage.setItem(NOTIF_SINCE_KEY, new Date().toISOString());
  }

  if ('Notification' in window && Notification.permission === 'default') {
    // Ask once per session; browsers require this to come from a real
    // user gesture in some cases, but most allow it on page load too.
    Notification.requestPermission().catch(() => { /* ignore */ });
  }

  pollNotifications();
  setInterval(pollNotifications, NOTIF_POLL_INTERVAL_MS);
}
