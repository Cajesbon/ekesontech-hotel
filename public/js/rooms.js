document.addEventListener('DOMContentLoaded', async () => {
  const settings = await getHotelSettings();

  const checkinInput = document.getElementById('f-checkin');
  const checkoutInput = document.getElementById('f-checkout');
  checkinInput.min = todayISO();
  checkoutInput.min = todayISO(1);

  // Pre-fill from query string (coming from the homepage search widget)
  const qCheckIn = getQueryParam('checkIn');
  const qCheckOut = getQueryParam('checkOut');
  const qGuests = getQueryParam('guests');
  if (qCheckIn) checkinInput.value = qCheckIn;
  if (qCheckOut) checkoutInput.value = qCheckOut;
  if (qGuests) document.getElementById('f-guests').value = Number(qGuests) >= 4 ? '4' : qGuests;

  checkinInput.addEventListener('change', () => {
    const next = new Date(checkinInput.value);
    next.setDate(next.getDate() + 1);
    checkoutInput.min = next.toISOString().slice(0, 10);
  });

  // Populate room type filter
  try {
    const { roomTypes } = await api.get('/rooms/types/all');
    const typeSelect = document.getElementById('f-type');
    roomTypes.forEach((t) => {
      const opt = document.createElement('option');
      opt.value = t._id;
      opt.textContent = t.name;
      typeSelect.appendChild(opt);
    });
  } catch (err) { /* non-critical */ }

  document.getElementById('filter-form').addEventListener('submit', (e) => {
    e.preventDefault();
    loadRooms(settings);
  });

  loadRooms(settings);
});

async function loadRooms(settings) {
  const grid = document.getElementById('rooms-grid');
  const countEl = document.getElementById('results-count');
  grid.innerHTML = '<div class="room-card"><div class="room-card__image skeleton"></div></div>'.repeat(3);

  const params = new URLSearchParams();
  const checkIn = document.getElementById('f-checkin').value;
  const checkOut = document.getElementById('f-checkout').value;
  const type = document.getElementById('f-type').value;
  const guests = document.getElementById('f-guests').value;
  const price = document.getElementById('f-price').value;

  if (checkIn) params.set('checkIn', checkIn);
  if (checkOut) params.set('checkOut', checkOut);
  if (type) params.set('type', type);
  if (guests) params.set('guests', guests);
  if (price) params.set('maxPrice', price);
  params.set('limit', '24');

  try {
    const { rooms, total } = await api.get(`/rooms?${params.toString()}`);
    countEl.textContent = `${total} room type${total === 1 ? '' : 's'} found${checkIn && checkOut ? ` for ${formatDate(checkIn)} – ${formatDate(checkOut)}` : ''}`;

    if (!rooms.length) {
      grid.innerHTML = '<p class="empty-state">No rooms match your search. Try adjusting your dates or filters.</p>';
      return;
    }

    grid.innerHTML = rooms.map((room) => `
      <div class="room-card">
        <div class="room-card__image">
          <img src="${room.images?.[0]?.url || 'https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=800&q=80'}" alt="${room.name}" loading="lazy" />
          ${room.isFeatured ? '<span class="room-card__tag">Featured</span>' : ''}
        </div>
        <div class="room-card__body">
          <h3>${room.name}</h3>
          <p>${room.shortDescription || ''}</p>
          <div class="room-card__meta">
            <span>👤 Up to ${room.maxGuests}</span>
            <span>🛏️ ${room.bedType}</span>
            ${room.sizeSqm ? `<span>📐 ${room.sizeSqm} m²</span>` : ''}
          </div>
          <div class="room-card__price">${formatCurrency(room.pricePerNight, settings.currencySymbol)} <small>/ night</small></div>
          <div class="room-card__actions">
            <a href="/room-details.html?id=${room.slug || room._id}${checkIn ? `&checkIn=${checkIn}&checkOut=${checkOut}` : ''}" class="btn btn-outline">View Details</a>
            <a href="/booking.html?roomId=${room._id}${checkIn ? `&checkIn=${checkIn}&checkOut=${checkOut}` : ''}" class="btn btn-primary">Book Now</a>
          </div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    grid.innerHTML = `<p class="empty-state">${err.message}</p>`;
  }
}
