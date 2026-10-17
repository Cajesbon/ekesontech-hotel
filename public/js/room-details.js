document.addEventListener('DOMContentLoaded', async () => {
  const settings = await getHotelSettings();
  const container = document.getElementById('room-content');
  const id = getQueryParam('id');

  if (!id) {
    container.innerHTML = '<p class="empty-state">No room specified. <a href="/rooms.html" class="btn-link">Browse all rooms</a></p>';
    return;
  }

  try {
    const { room } = await api.get(`/rooms/${id}`);
    document.getElementById('page-title').textContent = `${room.name} — EK Hotel`;
    renderRoom(room, settings);
  } catch (err) {
    container.innerHTML = `<p class="empty-state">${err.message} <a href="/rooms.html" class="btn-link">Browse all rooms</a></p>`;
  }
});

function renderRoom(room, settings) {
  const container = document.getElementById('room-content');
  const images = room.images && room.images.length ? room.images : [{ url: 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1200&q=80' }];
  // Default to tomorrow/day-after when the page is opened without dates
  // (e.g. a direct "View Details" link) so "Book This Room" always carries
  // a valid date range through to the booking flow.
  const checkIn = getQueryParam('checkIn') || todayISO(1);
  const checkOut = getQueryParam('checkOut') || todayISO(2);

  container.innerHTML = `
    <div style="margin-bottom:28px;">
      <img id="hero-image" src="${images[0].url}" alt="${room.name}" style="width:100%;max-height:480px;object-fit:cover;border-radius:6px;" />
      ${images.length > 1 ? `<div style="display:flex;gap:10px;margin-top:10px;overflow-x:auto;">
        ${images.map((img, i) => `<img data-idx="${i}" class="thumb" src="${img.url}" alt="${room.name} photo ${i + 1}" style="width:110px;height:80px;object-fit:cover;border-radius:4px;cursor:pointer;border:2px solid ${i === 0 ? 'var(--brass)' : 'transparent'};" />`).join('')}
      </div>` : ''}
    </div>

    <div class="grid grid-2" style="align-items:start;gap:48px;">
      <div>
        <span class="label">${room.roomType?.name || 'Room'}</span>
        <h1 style="font-size:clamp(1.8rem,3vw,2.6rem);">${room.name}</h1>
        <p>${room.description}</p>

        <h3 style="margin-top:32px;">Room facilities</h3>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:20px;">
          ${(room.facilities || []).map((f) => `<span class="amenity-pill">${f}</span>`).join('') || '<p class="muted">No additional facilities listed.</p>'}
        </div>

        <h3>Amenities</h3>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          ${(room.amenities || []).map((a) => `<span class="amenity-pill">${a.name}</span>`).join('') || '<p class="muted">Standard amenities included.</p>'}
        </div>
      </div>

      <div class="summary-card" style="position:sticky;top:110px;">
        <div class="room-card__price" style="margin-bottom:16px;">${formatCurrency(room.pricePerNight, settings.currencySymbol)} <small>/ night</small></div>
        <div class="summary-row"><span>Max occupancy</span><span>${room.maxGuests} guests</span></div>
        <div class="summary-row"><span>Bed type</span><span>${room.bedType}</span></div>
        ${room.sizeSqm ? `<div class="summary-row"><span>Room size</span><span>${room.sizeSqm} m²</span></div>` : ''}

        <form id="avail-form" style="margin-top:20px;">
          <div class="field" style="margin-bottom:14px;">
            <label for="d-checkin">Check-in</label>
            <input type="date" id="d-checkin" value="${checkIn}" required />
          </div>
          <div class="field" style="margin-bottom:14px;">
            <label for="d-checkout">Check-out</label>
            <input type="date" id="d-checkout" value="${checkOut}" required />
          </div>
          <div class="field" style="margin-bottom:18px;">
            <label for="d-guests">Guests</label>
            <select id="d-guests">
              ${Array.from({ length: room.maxGuests }, (_, i) => `<option value="${i + 1}">${i + 1} Guest${i > 0 ? 's' : ''}</option>`).join('')}
            </select>
          </div>
          <div id="avail-result" style="margin-bottom:14px;"></div>
          <button type="submit" class="btn btn-outline btn-block" style="margin-bottom:10px;">Check Availability</button>
          <a id="book-btn" href="/booking.html?roomId=${room._id}" class="btn btn-primary btn-block">Book This Room</a>
        </form>
      </div>
    </div>
  `;

  container.querySelectorAll('.thumb').forEach((thumb) => {
    thumb.addEventListener('click', () => {
      document.getElementById('hero-image').src = thumb.src;
      container.querySelectorAll('.thumb').forEach((t) => { t.style.borderColor = 'transparent'; });
      thumb.style.borderColor = 'var(--brass)';
    });
  });

  const checkinInput = document.getElementById('d-checkin');
  const checkoutInput = document.getElementById('d-checkout');
  checkinInput.min = todayISO();
  checkoutInput.min = todayISO(1);

  function syncBookLink() {
    const params = new URLSearchParams({ roomId: room._id });
    if (checkinInput.value) params.set('checkIn', checkinInput.value);
    if (checkoutInput.value) params.set('checkOut', checkoutInput.value);
    if (document.getElementById('d-guests').value) params.set('guests', document.getElementById('d-guests').value);
    document.getElementById('book-btn').href = `/booking.html?${params.toString()}`;
  }
  checkinInput.addEventListener('change', syncBookLink);
  checkoutInput.addEventListener('change', syncBookLink);
  document.getElementById('d-guests').addEventListener('change', syncBookLink);
  syncBookLink();

  document.getElementById('avail-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const resultEl = document.getElementById('avail-result');
    resultEl.innerHTML = '<p class="muted">Checking...</p>';
    try {
      const params = new URLSearchParams({
        roomId: room._id,
        checkIn: checkinInput.value,
        checkOut: checkoutInput.value,
        quantity: 1
      });
      const res = await api.get(`/rooms/availability?${params.toString()}`);
      if (res.available) {
        resultEl.innerHTML = `<div class="alert alert-success">Available for ${res.nights} night${res.nights === 1 ? '' : 's'} — ${res.remainingUnits} room(s) left.</div>`;
      } else {
        resultEl.innerHTML = `<div class="alert alert-error">${res.reason || 'Not available for these dates.'}</div>`;
      }
    } catch (err) {
      resultEl.innerHTML = `<div class="alert alert-error">${err.message}</div>`;
    }
  });
}
