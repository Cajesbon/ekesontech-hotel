/* Shared fetch helper for the public site. */
const API_BASE = '/api';

async function apiRequest(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  let data;
  try {
    data = await res.json();
  } catch (err) {
    data = { success: false, message: 'Unexpected server response.' };
  }

  if (!res.ok || data.success === false) {
    throw new Error(data.message || 'Something went wrong. Please try again.');
  }
  return data;
}

const api = {
  get: (path) => apiRequest(path, { method: 'GET' }),
  post: (path, body) => apiRequest(path, { method: 'POST', body }),
  put: (path, body) => apiRequest(path, { method: 'PUT', body }),
  patch: (path, body) => apiRequest(path, { method: 'PATCH', body }),
  del: (path) => apiRequest(path, { method: 'DELETE' })
};

function formatCurrency(amount, symbol = '₦') {
  const n = Number(amount) || 0;
  return `${symbol}${n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function nightsBetween(checkIn, checkOut) {
  const a = new Date(checkIn);
  const b = new Date(checkOut);
  return Math.max(Math.round((b - a) / 86400000), 0);
}

function todayISO(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
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
  toast.style.cssText = `background:${colors[type] || colors.info};color:#f7f2e8;padding:14px 20px;border-radius:6px;font-family:Inter,sans-serif;font-size:0.9rem;box-shadow:0 12px 30px rgba(0,0,0,0.25);max-width:340px;`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s ease';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 4200);
}

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

// Shared hotel settings cache so every page can render the hotel name,
// address, WhatsApp number, etc. without duplicating fetch calls.
let __settingsCache = null;
async function getHotelSettings() {
  if (__settingsCache) return __settingsCache;
  try {
    const { settings } = await api.get('/settings');
    __settingsCache = settings;
    return settings;
  } catch (err) {
    return {
      hotelName: 'EK Hotel',
      currencySymbol: '₦',
      whatsappNumber: '',
      phone: '',
      email: '',
      address: ''
    };
  }
}

function applySettingsToDom(settings) {
  document.querySelectorAll('[data-hotel-name]').forEach((el) => { el.textContent = settings.hotelName; });
  document.querySelectorAll('[data-hotel-tagline]').forEach((el) => { el.textContent = settings.tagline; });
  document.querySelectorAll('[data-hotel-address]').forEach((el) => { el.textContent = settings.address; });
  document.querySelectorAll('[data-hotel-phone]').forEach((el) => { el.textContent = settings.phone; el.href = `tel:${settings.phone}`; });
  document.querySelectorAll('[data-hotel-email]').forEach((el) => { el.textContent = settings.email; el.href = `mailto:${settings.email}`; });
  document.querySelectorAll('[data-hotel-checkin]').forEach((el) => { el.textContent = settings.checkInTime; });
  document.querySelectorAll('[data-hotel-checkout]').forEach((el) => { el.textContent = settings.checkOutTime; });
  document.querySelectorAll('[data-hotel-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });

  const wa = document.getElementById('whatsapp-float');
  if (wa && settings.whatsappNumber) {
    const msg = encodeURIComponent('Hello, I would like to make an inquiry about booking a room.');
    wa.href = `https://wa.me/${settings.whatsappNumber}?text=${msg}`;
  }

  document.querySelectorAll('[data-social-facebook]').forEach((el) => { if (settings.socialLinks?.facebook) el.href = settings.socialLinks.facebook; });
  document.querySelectorAll('[data-social-instagram]').forEach((el) => { if (settings.socialLinks?.instagram) el.href = settings.socialLinks.instagram; });
  document.querySelectorAll('[data-social-twitter]').forEach((el) => { if (settings.socialLinks?.twitter) el.href = settings.socialLinks.twitter; });
}

// Surface any uncaught client-side error as a visible toast instead of
// leaving the page silently blank/stuck — makes real bugs diagnosable
// instead of invisible.
window.addEventListener('error', (event) => {
  console.error('Uncaught error:', event.error || event.message);
  showToast(`Something went wrong on this page (${event.message || 'unknown error'}). Please refresh and try again.`, 'error');
});
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  const message = event.reason && event.reason.message ? event.reason.message : 'unknown error';
  showToast(`Something went wrong (${message}). Please refresh and try again.`, 'error');
});

document.addEventListener('DOMContentLoaded', async () => {
  const settings = await getHotelSettings();
  applySettingsToDom(settings);

  const navToggle = document.querySelector('.nav-toggle');
  const mainNav = document.querySelector('.main-nav');
  if (navToggle && mainNav) {
    navToggle.addEventListener('click', () => mainNav.classList.toggle('open'));
    mainNav.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => mainNav.classList.remove('open')));
  }
});
