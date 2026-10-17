document.addEventListener('DOMContentLoaded', async () => {
  const admin = await requireAdmin();
  if (!admin) return;

  await loadSettings();
  document.getElementById('settings-form').addEventListener('submit', saveSettings);
  document.getElementById('password-form').addEventListener('submit', updatePassword);
});

async function loadSettings() {
  try {
    const { settings } = await adminApi.get('/settings');
    document.getElementById('s-name').value = settings.hotelName || '';
    document.getElementById('s-tagline').value = settings.tagline || '';
    document.getElementById('s-description').value = settings.description || '';
    document.getElementById('s-address').value = settings.address || '';
    document.getElementById('s-phone').value = settings.phone || '';
    document.getElementById('s-whatsapp').value = settings.whatsappNumber || '';
    document.getElementById('s-email').value = settings.email || '';
    document.getElementById('s-checkin').value = settings.checkInTime || '';
    document.getElementById('s-checkout').value = settings.checkOutTime || '';
    document.getElementById('s-currency').value = settings.currency || '';
    document.getElementById('s-symbol').value = settings.currencySymbol || '';
    document.getElementById('s-tax').value = settings.taxPercentage ?? '';
    document.getElementById('s-booking-policy').value = settings.bookingPolicy || '';
    document.getElementById('s-cancellation-policy').value = settings.cancellationPolicy || '';
    document.getElementById('s-facebook').value = settings.socialLinks?.facebook || '';
    document.getElementById('s-instagram').value = settings.socialLinks?.instagram || '';
    document.getElementById('s-twitter').value = settings.socialLinks?.twitter || '';
    document.getElementById('s-map').value = settings.mapEmbedUrl || '';
  } catch (err) {
    document.getElementById('settings-alert').innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}

async function saveSettings(e) {
  e.preventDefault();
  const alertEl = document.getElementById('settings-alert');
  const payload = {
    hotelName: document.getElementById('s-name').value,
    tagline: document.getElementById('s-tagline').value,
    description: document.getElementById('s-description').value,
    address: document.getElementById('s-address').value,
    phone: document.getElementById('s-phone').value,
    whatsappNumber: document.getElementById('s-whatsapp').value,
    email: document.getElementById('s-email').value,
    checkInTime: document.getElementById('s-checkin').value,
    checkOutTime: document.getElementById('s-checkout').value,
    currency: document.getElementById('s-currency').value,
    currencySymbol: document.getElementById('s-symbol').value,
    taxPercentage: Number(document.getElementById('s-tax').value) || 0,
    bookingPolicy: document.getElementById('s-booking-policy').value,
    cancellationPolicy: document.getElementById('s-cancellation-policy').value,
    socialLinks: {
      facebook: document.getElementById('s-facebook').value,
      instagram: document.getElementById('s-instagram').value,
      twitter: document.getElementById('s-twitter').value
    },
    mapEmbedUrl: document.getElementById('s-map').value
  };

  try {
    await adminApi.put('/settings', payload);
    alertEl.innerHTML = '<div class="alert alert-success">Settings saved successfully.</div>';
    showToast('Settings updated.', 'success');
  } catch (err) {
    alertEl.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}

async function updatePassword(e) {
  e.preventDefault();
  const alertEl = document.getElementById('password-alert');
  const currentPassword = document.getElementById('current-password').value;
  const newPassword = document.getElementById('new-password').value;
  try {
    await fetch('/api/admin/auth/update-password', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword })
    }).then(async (res) => {
      const data = await res.json();
      if (!res.ok || data.success === false) throw new Error(data.message || 'Could not update password.');
    });
    alertEl.innerHTML = '<div class="alert alert-success">Password updated successfully.</div>';
    document.getElementById('password-form').reset();
  } catch (err) {
    alertEl.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
  }
}
