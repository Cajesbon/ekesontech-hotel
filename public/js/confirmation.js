document.addEventListener('DOMContentLoaded', async () => {
  const settings = await getHotelSettings();
  const container = document.getElementById('confirmation-content');

  const bookingRef = getQueryParam('ref') || sessionStorage.getItem('pendingBookingReference');
  if (!bookingRef) {
    container.innerHTML = renderLookupForm();
    attachLookupHandler(settings);
    return;
  }

  try {
    let { booking } = await api.get(`/bookings/${bookingRef}`);

    if (booking.paymentStatus !== 'paid' && booking.status !== 'cancelled') {
      const paymentReference = getQueryParam('reference') || getQueryParam('trxref') || booking.paymentReference;
      if (paymentReference) {
        container.innerHTML = '<p class="text-center muted">Verifying your payment…</p>';
        try {
          const verifyRes = await api.post('/payments/verify', { reference: paymentReference });
          booking = verifyRes.booking;
        } catch (err) {
          container.innerHTML = `<div class="alert alert-error">${err.message}</div>${renderLookupForm()}`;
          attachLookupHandler(settings);
          return;
        }
      }
    }

    sessionStorage.removeItem('pendingBookingReference');
    renderBooking(booking, settings);
  } catch (err) {
    container.innerHTML = `<div class="alert alert-error">${err.message}</div>${renderLookupForm()}`;
    attachLookupHandler(settings);
  }
});

function renderLookupForm() {
  return `
    <div class="summary-card" style="max-width:480px;margin:40px auto;" id="lookup-form-wrap">
      <h2 class="text-center">Find your booking</h2>
      <p class="muted text-center">Enter your booking reference to view your confirmation.</p>
      <form id="lookup-form">
        <div class="form-group">
          <label for="lookup-ref">Booking reference</label>
          <input type="text" id="lookup-ref" placeholder="HTL-2026-XXXXX" required />
        </div>
        <button type="submit" class="btn btn-primary btn-block">Find Booking</button>
      </form>
    </div>
  `;
}

function attachLookupHandler(settings) {
  document.getElementById('lookup-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const ref = document.getElementById('lookup-ref').value.trim().toUpperCase();
    if (!ref) return;
    try {
      const { booking } = await api.get(`/bookings/${ref}`);
      renderBooking(booking, settings);
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

function renderBooking(booking, settings) {
  const container = document.getElementById('confirmation-content');
  const isPaid = booking.paymentStatus === 'paid';
  const isCancelled = booking.status === 'cancelled';

  container.innerHTML = `
    <div class="text-center" style="margin-bottom:32px;">
      <div style="width:64px;height:64px;border-radius:50%;background:${isCancelled ? '#f7dfdb' : isPaid ? '#dcece0' : '#f4e6c9'};display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:1.8rem;">
        ${isCancelled ? '⚠️' : isPaid ? '✓' : '⏳'}
      </div>
      <h1 style="font-size:2rem;">${isCancelled ? 'Booking Cancelled' : isPaid ? 'Booking Confirmed' : 'Payment Pending'}</h1>
      <p>${isCancelled ? booking.cancellationReason || 'This booking was cancelled.' : isPaid ? 'A confirmation email has been sent to you.' : 'We are waiting for your payment to be confirmed.'}</p>
    </div>

    <div class="summary-card no-print">
      <div class="summary-row"><span>Booking Reference</span><span><strong>${booking.bookingReference}</strong></span></div>
      <div class="summary-row"><span>Status</span><span class="badge badge-${booking.status}">${booking.status.replace('_', ' ')}</span></div>
      <div class="summary-row"><span>Payment Status</span><span class="badge badge-${booking.paymentStatus}">${booking.paymentStatus}</span></div>
    </div>

    <div class="summary-card" style="margin-top:20px;" id="printable-summary">
      <h3 data-hotel-name>${settings.hotelName}</h3>
      <p data-hotel-address>${settings.address}</p>
      <div class="summary-row"><span>Guest</span><span>${booking.guest.fullName}</span></div>
      <div class="summary-row"><span>Email</span><span>${booking.guest.email}</span></div>
      <div class="summary-row"><span>Phone</span><span>${booking.guest.phone}</span></div>
      <div class="summary-row"><span>Check-in</span><span>${formatDate(booking.checkIn)}</span></div>
      <div class="summary-row"><span>Check-out</span><span>${formatDate(booking.checkOut)}</span></div>
      <div class="summary-row"><span>Nights</span><span>${booking.nights}</span></div>
      <div class="summary-row"><span>Guests</span><span>${booking.totalGuests}</span></div>
      ${booking.rooms.map((r) => `<div class="summary-row"><span>${r.roomNameSnapshot} × ${r.quantity}</span><span>${formatCurrency(r.pricePerNightSnapshot * r.quantity * booking.nights, settings.currencySymbol)}</span></div>`).join('')}
      <div class="summary-row"><span>Subtotal</span><span>${formatCurrency(booking.subtotal, settings.currencySymbol)}</span></div>
      ${booking.discountAmount ? `<div class="summary-row"><span>Discount</span><span>-${formatCurrency(booking.discountAmount, settings.currencySymbol)}</span></div>` : ''}
      <div class="summary-row"><span>Taxes &amp; fees</span><span>${formatCurrency(booking.taxAmount, settings.currencySymbol)}</span></div>
      <div class="summary-row total"><span>Total Amount</span><span>${formatCurrency(booking.totalAmount, settings.currencySymbol)}</span></div>
      <p class="form-hint" style="margin-top:16px;">Check-in from ${settings.checkInTime} · Check-out by ${settings.checkOutTime}. Please have a valid ID ready at check-in.</p>
    </div>

    <div class="text-center no-print" style="margin-top:28px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
      <button class="btn btn-outline" id="print-btn" onclick="window.print()">Download / Print Confirmation</button>
      <a href="/" class="btn btn-dark">Back to Home</a>
    </div>
  `;
}
