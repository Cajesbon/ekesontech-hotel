let hotelSettings = { currencySymbol: '₦' };
let currentPage = 1;

document.addEventListener('DOMContentLoaded', async () => {
  const admin = await requireAdmin();
  if (!admin) return;

  try {
    const res = await fetch('/api/settings');
    hotelSettings = (await res.json()).settings;
  } catch (err) { /* fallback default */ }

  const refFromUrl = new URLSearchParams(window.location.search).get('ref');
  if (refFromUrl) document.getElementById('search-input').value = refFromUrl;

  document.getElementById('search-btn').addEventListener('click', () => { currentPage = 1; loadBookings(); });
  document.getElementById('search-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') { currentPage = 1; loadBookings(); } });
  document.getElementById('close-modal').addEventListener('click', closeModal);
  document.getElementById('booking-modal').addEventListener('click', (e) => { if (e.target.id === 'booking-modal') closeModal(); });

  loadBookings();
});

function closeModal() { document.getElementById('booking-modal').style.display = 'none'; }

async function loadBookings() {
  const body = document.getElementById('bookings-body');
  body.innerHTML = '<tr class="skeleton-row"><td colspan="9"></td></tr>'.repeat(4);

  const params = new URLSearchParams({ page: currentPage, limit: 15 });
  const search = document.getElementById('search-input').value.trim();
  const status = document.getElementById('status-filter').value;
  const paymentStatus = document.getElementById('payment-filter').value;
  if (search) params.set('search', search);
  if (status) params.set('status', status);
  if (paymentStatus) params.set('paymentStatus', paymentStatus);

  try {
    const { bookings, total, pages } = await adminApi.get(`/bookings?${params.toString()}`);
    if (!bookings.length) {
      body.innerHTML = '<tr><td colspan="9" class="empty-state">No bookings found.</td></tr>';
      renderPagination(0);
      return;
    }
    body.innerHTML = bookings.map((b) => `
      <tr>
        <td><strong>${b.bookingReference}</strong></td>
        <td>${b.guest.fullName}</td>
        <td>${b.guest.email}<br/><span style="color:var(--text-muted);">${b.guest.phone}</span></td>
        <td>${formatDate(b.checkIn)} → ${formatDate(b.checkOut)}</td>
        <td>${b.totalGuests}</td>
        <td>${badgeHtml(b.status)}</td>
        <td>${badgeHtml(b.paymentStatus)}</td>
        <td>${formatCurrency(b.totalAmount, hotelSettings.currencySymbol)}</td>
        <td><button class="btn btn-outline btn-sm" data-id="${b._id}">Manage</button></td>
      </tr>
    `).join('');

    body.querySelectorAll('[data-id]').forEach((btn) => btn.addEventListener('click', () => openBookingModal(btn.dataset.id)));

    renderPagination(pages);
  } catch (err) {
    body.innerHTML = `<tr><td colspan="9" class="empty-state">${err.message}</td></tr>`;
  }
}

function renderPagination(pages) {
  const el = document.getElementById('pagination');
  if (pages <= 1) { el.innerHTML = ''; return; }
  el.innerHTML = `
    <button class="btn btn-outline btn-sm" ${currentPage <= 1 ? 'disabled' : ''} id="prev-page">Previous</button>
    <span style="font-size:0.85rem;color:var(--text-muted);">Page ${currentPage} of ${pages}</span>
    <button class="btn btn-outline btn-sm" ${currentPage >= pages ? 'disabled' : ''} id="next-page">Next</button>
  `;
  document.getElementById('prev-page')?.addEventListener('click', () => { currentPage -= 1; loadBookings(); });
  document.getElementById('next-page')?.addEventListener('click', () => { currentPage += 1; loadBookings(); });
}

async function openBookingModal(id) {
  const modal = document.getElementById('booking-modal');
  const body = document.getElementById('modal-body');
  modal.style.display = 'flex';
  body.innerHTML = '<p class="empty-state">Loading…</p>';

  try {
    const { booking } = await adminApi.get(`/bookings/${id}`);
    body.innerHTML = `
      <div class="form-group"><label>Guest</label><div>${booking.guest.fullName} · ${booking.guest.email} · ${booking.guest.phone}</div></div>
      <div class="form-row">
        <div class="form-group"><label>Check-in</label><div>${formatDate(booking.checkIn)}</div></div>
        <div class="form-group"><label>Check-out</label><div>${formatDate(booking.checkOut)}</div></div>
      </div>
      <div class="form-group"><label>Rooms</label>
        <div>${booking.rooms.map((r) => `${r.roomNameSnapshot} × ${r.quantity} (${formatCurrency(r.pricePerNightSnapshot, hotelSettings.currencySymbol)}/night)`).join('<br/>')}</div>
      </div>
      ${booking.guest.specialRequests ? `<div class="form-group"><label>Special requests</label><div>${booking.guest.specialRequests}</div></div>` : ''}
      <div class="form-row">
        <div class="form-group"><label>Total</label><div><strong>${formatCurrency(booking.totalAmount, hotelSettings.currencySymbol)}</strong></div></div>
        <div class="form-group"><label>Reference</label><div>${booking.bookingReference}</div></div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="modal-status">Booking status</label>
          <select id="modal-status">
            ${['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'completed'].map((s) => `<option value="${s}" ${s === booking.status ? 'selected' : ''}>${s.replace('_', ' ')}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label for="modal-payment-status">Payment status</label>
          <select id="modal-payment-status">
            ${['pending', 'paid', 'failed', 'refunded'].map((s) => `<option value="${s}" ${s === booking.paymentStatus ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </div>
      </div>
      <div id="modal-alert"></div>
      <div style="display:flex;gap:10px;margin-top:10px;flex-wrap:wrap;">
        <button class="btn btn-primary" id="save-status-btn">Save Changes</button>
        ${booking.paymentStatus !== 'paid' && booking.paymentReference ? '<button class="btn btn-outline" id="reverify-payment-btn">Re-verify Payment with Gateway</button>' : ''}
        <button class="btn btn-danger" id="delete-booking-btn">Delete Booking</button>
      </div>
    `;

    document.getElementById('reverify-payment-btn')?.addEventListener('click', async () => {
      const alertEl = document.getElementById('modal-alert');
      const btn = document.getElementById('reverify-payment-btn');
      btn.disabled = true;
      btn.textContent = 'Checking with gateway...';
      try {
        const res = await adminApi.post(`/bookings/${id}/reverify-payment`, {});
        if (res.alreadyConfirmed) {
          alertEl.innerHTML = '<div class="alert alert-success">This booking was already confirmed.</div>';
        } else {
          showToast('Payment verified and booking confirmed.', 'success');
        }
        closeModal();
        loadBookings();
      } catch (err) {
        alertEl.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
        btn.disabled = false;
        btn.textContent = 'Re-verify Payment with Gateway';
      }
    });

    document.getElementById('save-status-btn').addEventListener('click', async () => {
      const alertEl = document.getElementById('modal-alert');
      try {
        const status = document.getElementById('modal-status').value;
        const paymentStatus = document.getElementById('modal-payment-status').value;
        if (status !== booking.status) await adminApi.patch(`/bookings/${id}/status`, { status });
        if (paymentStatus !== booking.paymentStatus) await adminApi.patch(`/bookings/${id}/payment-status`, { paymentStatus });
        showToast('Booking updated successfully.', 'success');
        closeModal();
        loadBookings();
      } catch (err) {
        alertEl.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
      }
    });

    document.getElementById('delete-booking-btn').addEventListener('click', async () => {
      if (!confirm('Delete this booking permanently? This cannot be undone.')) return;
      try {
        await adminApi.del(`/bookings/${id}`);
        showToast('Booking deleted.', 'success');
        closeModal();
        loadBookings();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  } catch (err) {
    body.innerHTML = `<p class="empty-state">${err.message}</p>`;
  }
}
