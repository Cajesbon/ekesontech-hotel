const state = {
  checkIn: '',
  checkOut: '',
  nights: 0,
  totalGuests: 2,
  selectedRooms: [], // { roomId, name, price, maxGuests, quantity, guests }
  guest: {},
  promo: null,
  settings: null
};

document.addEventListener('DOMContentLoaded', async () => {
  state.settings = await getHotelSettings();

  const checkinInput = document.getElementById('b-checkin');
  const checkoutInput = document.getElementById('b-checkout');
  checkinInput.min = todayISO();
  checkoutInput.min = todayISO(1);
  checkinInput.value = getQueryParam('checkIn') || todayISO(1);
  checkoutInput.value = getQueryParam('checkOut') || todayISO(2);
  if (getQueryParam('guests')) document.getElementById('b-guests').value = Math.min(Number(getQueryParam('guests')), 5);

  checkinInput.addEventListener('change', () => {
    const next = new Date(checkinInput.value);
    next.setDate(next.getDate() + 1);
    const nextISO = next.toISOString().slice(0, 10);
    checkoutInput.min = nextISO;
    if (checkoutInput.value <= checkinInput.value) checkoutInput.value = nextISO;
  });

  document.getElementById('to-step-2').addEventListener('click', () => {
    if (!checkinInput.value || !checkoutInput.value) { showToast('Please select both dates.', 'error'); return; }
    if (checkoutInput.value <= checkinInput.value) { showToast('Check-out must be after check-in.', 'error'); return; }
    state.checkIn = checkinInput.value;
    state.checkOut = checkoutInput.value;
    state.nights = nightsBetween(state.checkIn, state.checkOut);
    state.totalGuests = Number(document.getElementById('b-guests').value);
    goToStep(2);
    loadAvailableRooms();
  });

  document.getElementById('back-to-1').addEventListener('click', () => goToStep(1));
  document.getElementById('back-to-2').addEventListener('click', () => goToStep(2));
  document.getElementById('back-to-3').addEventListener('click', () => goToStep(3));

  document.getElementById('to-step-3').addEventListener('click', () => {
    if (!state.selectedRooms.length) { showToast('Please select at least one room.', 'error'); return; }
    goToStep(3);
  });

  document.getElementById('guest-form').addEventListener('submit', (e) => {
    e.preventDefault();
    state.guest = {
      fullName: document.getElementById('g-name').value.trim(),
      email: document.getElementById('g-email').value.trim(),
      phone: document.getElementById('g-phone').value.trim(),
      country: document.getElementById('g-country').value.trim(),
      arrivalTime: document.getElementById('g-arrival').value,
      specialRequests: document.getElementById('g-requests').value.trim()
    };
    renderReview();
    goToStep(4);
  });

  document.getElementById('apply-promo').addEventListener('click', applyPromo);
  document.getElementById('pay-btn').addEventListener('click', submitBookingAndPay);

  // A room may have been preselected from a room-details/rooms page link.
  const presetRoomId = getQueryParam('roomId');
  if (presetRoomId) {
    window.__presetRoomId = presetRoomId;
  }
});

function goToStep(n) {
  // Steps 1-4 are inline panels on this page; step 5 (Confirmation) is a
  // separate page reached after the payment gateway redirects back, so
  // there is no #step-5 element here — only toggle the trackers for it.
  for (let i = 1; i <= 4; i += 1) {
    const stepEl = document.getElementById(`step-${i}`);
    if (stepEl) stepEl.style.display = i === n ? 'block' : 'none';
  }
  for (let i = 1; i <= 5; i += 1) {
    const tracker = document.getElementById(`tracker-${i}`);
    if (!tracker) continue;
    tracker.classList.toggle('active', i === n);
    tracker.classList.toggle('done', i < n);
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function loadAvailableRooms() {
  const grid = document.getElementById('room-select-grid');

  try {
    document.getElementById('dates-summary').textContent = `${formatDate(state.checkIn)} → ${formatDate(state.checkOut)} · ${state.nights} night${state.nights === 1 ? '' : 's'} · ${state.totalGuests} guest${state.totalGuests === 1 ? '' : 's'}`;
    grid.innerHTML = '<div class="room-card"><div class="room-card__image skeleton"></div></div>'.repeat(3);

    const params = new URLSearchParams({ checkIn: state.checkIn, checkOut: state.checkOut, limit: '24' });
    const { rooms } = await api.get(`/rooms?${params.toString()}`);

    if (!rooms.length) {
      grid.innerHTML = '<p class="empty-state">No rooms are available for these dates. Please try different dates, or contact us if you believe this is an error.</p>';
      return;
    }

    grid.innerHTML = rooms.map((room) => `
      <div class="room-card">
        <div class="room-card__image">
          <img src="${room.images?.[0]?.url || 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=800&q=80'}" alt="${room.name}" loading="lazy" />
        </div>
        <div class="room-card__body">
          <h3>${room.name}</h3>
          <div class="room-card__meta">
            <span>👤 Up to ${room.maxGuests}</span>
            <span>🛏️ ${room.bedType}</span>
            <span>${room.remainingUnits} left</span>
          </div>
          <div class="room-card__price">${formatCurrency(room.pricePerNight, state.settings.currencySymbol)} <small>/ night</small></div>
          <button class="btn btn-primary btn-block add-room-btn" data-room-id="${room._id}" data-room-name="${room.name}" data-room-price="${room.pricePerNight}" data-room-max="${room.maxGuests}" data-room-remaining="${room.remainingUnits}">Add This Room</button>
        </div>
      </div>
    `).join('');

    grid.querySelectorAll('.add-room-btn').forEach((btn) => {
      btn.addEventListener('click', () => addRoom(btn.dataset));
    });

    if (window.__presetRoomId) {
      const match = rooms.find((r) => r._id === window.__presetRoomId);
      if (match) addRoom({ roomId: match._id, roomName: match.name, roomPrice: match.pricePerNight, roomMax: match.maxGuests, roomRemaining: match.remainingUnits });
      window.__presetRoomId = null;
    }
  } catch (err) {
    console.error('loadAvailableRooms failed:', err);
    grid.innerHTML = `<p class="empty-state">${err.message}</p>`;
  }
}

function addRoom(data) {
  const existing = state.selectedRooms.find((r) => r.roomId === data.roomId);
  if (existing) {
    if (existing.quantity < Number(data.roomRemaining)) {
      existing.quantity += 1;
      showToast(`Added another ${data.roomName} to your booking (now ${existing.quantity}).`, 'success');
    } else {
      showToast('No more units of this room are available.', 'error');
    }
  } else {
    state.selectedRooms.push({
      roomId: data.roomId,
      name: data.roomName,
      price: Number(data.roomPrice),
      maxGuests: Number(data.roomMax),
      remaining: Number(data.roomRemaining),
      quantity: 1,
      guests: Math.min(Number(data.roomMax), state.totalGuests)
    });
    showToast(`${data.roomName} added to your booking.`, 'success');
  }
  renderSelectedRooms();
}

function renderSelectedRooms() {
  const panel = document.getElementById('selected-rooms-panel');
  const continueBtn = document.getElementById('to-step-3');

  if (!state.selectedRooms.length) {
    panel.innerHTML = '';
    continueBtn.disabled = true;
    return;
  }
  continueBtn.disabled = false;

  panel.innerHTML = `
    <div class="summary-card">
      <h3>Your selection</h3>
      ${state.selectedRooms.map((r, i) => `
        <div class="summary-row" style="align-items:center;">
          <span>${r.name} × ${r.quantity} (${r.guests} guests/room)</span>
          <span style="display:flex;align-items:center;gap:10px;">
            ${formatCurrency(r.price * r.quantity * state.nights, state.settings.currencySymbol)}
            <button type="button" class="btn btn-outline" data-remove="${i}" style="padding:6px 10px;font-size:0.75rem;">Remove</button>
          </span>
        </div>
      `).join('')}
      <div class="summary-row total"><span>Estimated subtotal</span><span>${formatCurrency(subtotal(), state.settings.currencySymbol)}</span></div>
    </div>
  `;

  panel.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const removed = state.selectedRooms[Number(btn.dataset.remove)];
      state.selectedRooms.splice(Number(btn.dataset.remove), 1);
      renderSelectedRooms();
      if (removed) showToast(`${removed.name} removed from your booking.`, 'info');
    });
  });
}

function subtotal() {
  return state.selectedRooms.reduce((sum, r) => sum + r.price * r.quantity * state.nights, 0);
}

function renderReview() {
  document.getElementById('review-guest').innerHTML = `
    <div class="summary-row"><span>Guest</span><span>${state.guest.fullName}</span></div>
    <div class="summary-row"><span>Email</span><span>${state.guest.email}</span></div>
    <div class="summary-row"><span>Phone</span><span>${state.guest.phone}</span></div>
    <div class="summary-row"><span>Dates</span><span>${formatDate(state.checkIn)} → ${formatDate(state.checkOut)}</span></div>
    <div class="summary-row"><span>Nights</span><span>${state.nights}</span></div>
  `;
  document.getElementById('review-rooms').innerHTML = state.selectedRooms.map((r) => `
    <div class="summary-row"><span>${r.name} × ${r.quantity}</span><span>${formatCurrency(r.price * r.quantity * state.nights, state.settings.currencySymbol)}</span></div>
  `).join('');
  updateTotals();
}

function updateTotals() {
  const sub = subtotal();
  const discount = state.promo ? state.promo.discountAmount : 0;
  const taxable = sub - discount;
  const taxPct = state.settings.taxPercentage || 0;
  const tax = Math.round(taxable * taxPct) / 100;
  const total = taxable + tax;

  document.getElementById('rv-subtotal').textContent = formatCurrency(sub, state.settings.currencySymbol);
  document.getElementById('rv-tax').textContent = formatCurrency(tax, state.settings.currencySymbol);
  document.getElementById('rv-total').textContent = formatCurrency(total, state.settings.currencySymbol);
  const discountRow = document.getElementById('rv-discount-row');
  if (discount > 0) {
    discountRow.style.display = 'flex';
    document.getElementById('rv-discount').textContent = `-${formatCurrency(discount, state.settings.currencySymbol)}`;
  } else {
    discountRow.style.display = 'none';
  }
}

async function applyPromo() {
  const code = document.getElementById('promo-input').value.trim();
  const messageEl = document.getElementById('promo-message');
  if (!code) return;

  try {
    const res = await api.post('/promotions/validate', { code, amount: subtotal() });
    state.promo = { code: code.toUpperCase(), discountAmount: res.discountAmount };
    messageEl.textContent = `Promo applied: -${formatCurrency(res.discountAmount, state.settings.currencySymbol)}`;
    messageEl.style.color = 'var(--success)';
    updateTotals();
  } catch (err) {
    state.promo = null;
    messageEl.textContent = err.message;
    messageEl.style.color = 'var(--error)';
    updateTotals();
  }
}

async function submitBookingAndPay() {
  const payBtn = document.getElementById('pay-btn');
  const errorEl = document.getElementById('payment-error');
  errorEl.innerHTML = '';
  payBtn.disabled = true;
  payBtn.textContent = 'Processing...';

  try {
    const payload = {
      guest: state.guest,
      checkIn: state.checkIn,
      checkOut: state.checkOut,
      rooms: state.selectedRooms.map((r) => ({ roomId: r.roomId, quantity: r.quantity, guests: r.guests })),
      promoCode: state.promo ? state.promo.code : undefined
    };

    const { booking } = await api.post('/bookings', payload);

    const paymentRes = await api.post('/payments/initialize', { bookingReference: booking.bookingReference });
    sessionStorage.setItem('pendingBookingReference', booking.bookingReference);
    window.location.href = paymentRes.authorizationUrl;
  } catch (err) {
    errorEl.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    payBtn.disabled = false;
    payBtn.textContent = 'Proceed to Payment';
  }
}
