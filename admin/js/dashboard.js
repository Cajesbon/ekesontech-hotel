let hotelSettings = { currencySymbol: '₦' };

document.addEventListener('DOMContentLoaded', async () => {
  const admin = await requireAdmin();
  if (!admin) return;

  try {
    const res = await fetch('/api/settings');
    const data = await res.json();
    hotelSettings = data.settings;
  } catch (err) { /* fall back to default symbol */ }

  loadStats();
  loadRevenueChart();
  loadRecentBookings();
});

async function loadStats() {
  const grid = document.getElementById('stats-grid');
  try {
    const { stats } = await adminApi.get('/dashboard/stats');
    const cards = [
      { label: 'Total Bookings', value: stats.totalBookings },
      { label: "Today's Bookings", value: stats.todaysBookings },
      { label: 'Upcoming Bookings', value: stats.upcomingBookings },
      { label: 'Pending Bookings', value: stats.pendingBookings },
      { label: 'Confirmed Bookings', value: stats.confirmedBookings },
      { label: 'Cancelled Bookings', value: stats.cancelledBookings },
      { label: 'Total Rooms', value: stats.totalRooms, sub: `${stats.availableRooms} available · ${stats.occupiedRooms} occupied` },
      { label: 'Total Revenue', value: formatCurrency(stats.totalRevenue, hotelSettings.currencySymbol), sub: `${formatCurrency(stats.monthlyRevenue, hotelSettings.currencySymbol)} this month` }
    ];
    grid.innerHTML = cards.map((c) => `
      <div class="stat-card">
        <div class="stat-label">${c.label}</div>
        <div class="stat-value">${c.value}</div>
        ${c.sub ? `<div class="stat-sub">${c.sub}</div>` : ''}
      </div>
    `).join('');
  } catch (err) {
    grid.innerHTML = `<p class="empty-state">${err.message}</p>`;
  }
}

async function loadRevenueChart() {
  const el = document.getElementById('revenue-chart');
  try {
    const { data } = await adminApi.get('/dashboard/revenue-chart?months=6');
    if (!data.length) {
      el.innerHTML = '<p class="empty-state">No revenue data yet.</p>';
      return;
    }
    const max = Math.max(...data.map((d) => d.revenue), 1);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    el.innerHTML = data.map((d) => `
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:8px;">
        <div style="width:100%;background:var(--brass);border-radius:4px 4px 0 0;height:${Math.max((d.revenue / max) * 170, 4)}px;" title="${formatCurrency(d.revenue, hotelSettings.currencySymbol)}"></div>
        <span style="font-size:0.75rem;color:var(--text-muted);">${monthNames[d._id.month - 1]}</span>
      </div>
    `).join('');
  } catch (err) {
    el.innerHTML = `<p class="empty-state">${err.message}</p>`;
  }
}

async function loadRecentBookings() {
  const body = document.getElementById('recent-bookings-body');
  try {
    const { bookings } = await adminApi.get('/bookings?limit=8');
    if (!bookings.length) {
      body.innerHTML = '<tr><td colspan="6" class="empty-state">No bookings yet.</td></tr>';
      return;
    }
    body.innerHTML = bookings.map((b) => `
      <tr>
        <td><a href="/admin/bookings.html?ref=${b.bookingReference}" class="btn-link" style="color:var(--brass);">${b.bookingReference}</a></td>
        <td>${b.guest.fullName}</td>
        <td>${formatDate(b.checkIn)} → ${formatDate(b.checkOut)}</td>
        <td>${badgeHtml(b.status)}</td>
        <td>${badgeHtml(b.paymentStatus)}</td>
        <td>${formatCurrency(b.totalAmount, hotelSettings.currencySymbol)}</td>
      </tr>
    `).join('');
  } catch (err) {
    body.innerHTML = `<tr><td colspan="6" class="empty-state">${err.message}</td></tr>`;
  }
}
