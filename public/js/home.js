document.addEventListener('DOMContentLoaded', async () => {
  // ---- Search widget defaults ----
  const checkinInput = document.getElementById('s-checkin');
  const checkoutInput = document.getElementById('s-checkout');
  if (checkinInput && checkoutInput) {
    checkinInput.min = todayISO();
    checkinInput.value = todayISO(1);
    checkoutInput.min = todayISO(2);
    checkoutInput.value = todayISO(2);
    checkinInput.addEventListener('change', () => {
      const next = new Date(checkinInput.value);
      next.setDate(next.getDate() + 1);
      const nextISO = next.toISOString().slice(0, 10);
      checkoutInput.min = nextISO;
      if (checkoutInput.value <= checkinInput.value) {
        checkoutInput.value = nextISO;
      }
    });
  }

  document.getElementById('search-widget')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const params = new URLSearchParams({
      checkIn: checkinInput.value,
      checkOut: checkoutInput.value,
      guests: document.getElementById('s-guests').value,
      rooms: document.getElementById('s-rooms').value
    });
    window.location.href = `/rooms.html?${params.toString()}`;
  });

  document.getElementById('newsletter-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    showToast('Thanks for subscribing! Keep an eye on your inbox.', 'success');
    e.target.reset();
  });

  // ---- Featured rooms ----
  try {
    const settings = await getHotelSettings();
    const { rooms } = await api.get('/rooms?limit=6');
    const featured = rooms.filter((r) => r.isFeatured).slice(0, 3);
    const list = featured.length ? featured : rooms.slice(0, 3);
    renderRoomCards(list, settings);
  } catch (err) {
    document.getElementById('featured-rooms-grid').innerHTML = `<p>${err.message}</p>`;
  }

  // ---- Gallery preview ----
  try {
    const { images } = await api.get('/gallery');
    const grid = document.getElementById('home-gallery-grid');
    grid.innerHTML = images.slice(0, 8).map((img, i) => `<img class="${i === 0 || i === 5 ? 'tall' : ''}" src="${img.url}" alt="${img.title || 'Hotel gallery photo'}" loading="lazy" />`).join('');
  } catch (err) { /* gallery is optional decoration */ }

  // ---- Testimonials ----
  try {
    const { testimonials } = await api.get('/testimonials');
    const grid = document.getElementById('testimonial-grid');
    grid.innerHTML = testimonials.slice(0, 3).map((t) => `
      <div class="testimonial-card">
        <div class="stars">${'★'.repeat(t.rating)}${'☆'.repeat(5 - t.rating)}</div>
        <p>"${t.message}"</p>
        <div class="who">${t.guestName}<span>${t.guestCountry || ''}</span></div>
      </div>
    `).join('');
  } catch (err) { /* testimonials are optional */ }
});

function renderRoomCards(rooms, settings) {
  const grid = document.getElementById('featured-rooms-grid');
  if (!rooms.length) {
    grid.innerHTML = '<p class="empty-state">Rooms will appear here soon.</p>';
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
          <a href="/room-details.html?id=${room.slug || room._id}" class="btn btn-outline">View Details</a>
          <a href="/booking.html?roomId=${room._id}" class="btn btn-primary">Book Now</a>
        </div>
      </div>
    </div>
  `).join('');
}
