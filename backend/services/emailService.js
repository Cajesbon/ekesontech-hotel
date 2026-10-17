const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    console.warn('SMTP credentials are not fully configured. Emails will be logged instead of sent.');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    }
  });

  return transporter;
}

async function sendMail({ to, subject, html }) {
  const t = getTransporter();
  const fromName = process.env.SMTP_FROM_NAME || 'Hotel Booking';
  const fromAddress = process.env.SMTP_USER || 'no-reply@example.com';

  if (!t) {
    console.log(`[EMAIL - NOT SENT, SMTP NOT CONFIGURED] To: ${to} | Subject: ${subject}`);
    return { simulated: true };
  }

  try {
    const info = await t.sendMail({
      from: `"${fromName}" <${fromAddress}>`,
      to,
      subject,
      html
    });
    return info;
  } catch (err) {
    console.error('Failed to send email:', err.message);
    // Emails should never crash the booking flow.
    return { error: err.message };
  }
}

function currency(amount, symbol = '₦') {
  return `${symbol}${Number(amount).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(date) {
  return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function baseTemplate({ title, bodyHtml, hotel }) {
  return `
  <div style="background:#f4f1ea;padding:32px 16px;font-family:Georgia, 'Times New Roman', serif;color:#2b241c;">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 4px 18px rgba(0,0,0,0.08);">
      <div style="background:#1c1a17;padding:28px 32px;text-align:center;">
        <h1 style="margin:0;color:#d4af6a;font-size:22px;letter-spacing:2px;text-transform:uppercase;">${hotel.hotelName || 'Hotel'}</h1>
        <p style="margin:6px 0 0;color:#cfc9bd;font-size:12px;letter-spacing:1px;">${hotel.tagline || ''}</p>
      </div>
      <div style="padding:32px;">
        <h2 style="font-size:18px;color:#1c1a17;margin-top:0;">${title}</h2>
        ${bodyHtml}
      </div>
      <div style="background:#f4f1ea;padding:20px 32px;font-size:12px;color:#6b6255;text-align:center;">
        <p style="margin:0;">${hotel.address || ''}</p>
        <p style="margin:4px 0 0;">${hotel.phone || ''} &middot; ${hotel.email || ''}</p>
      </div>
    </div>
  </div>`;
}

function bookingConfirmationEmail(booking, hotel) {
  const roomRows = booking.rooms
    .map(
      (r) => `<tr>
        <td style="padding:8px 0;border-bottom:1px solid #eee;">${r.roomNameSnapshot} &times; ${r.quantity}</td>
        <td style="padding:8px 0;border-bottom:1px solid #eee;text-align:right;">${currency(r.pricePerNightSnapshot, hotel.currencySymbol)}/night</td>
      </tr>`
    )
    .join('');

  const bodyHtml = `
    <p>Dear ${booking.guest.fullName},</p>
    <p>Thank you for your booking. Here are your reservation details:</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
      <tr><td style="padding:6px 0;color:#6b6255;">Booking Reference</td><td style="padding:6px 0;text-align:right;font-weight:bold;">${booking.bookingReference}</td></tr>
      <tr><td style="padding:6px 0;color:#6b6255;">Check-in</td><td style="padding:6px 0;text-align:right;">${formatDate(booking.checkIn)}</td></tr>
      <tr><td style="padding:6px 0;color:#6b6255;">Check-out</td><td style="padding:6px 0;text-align:right;">${formatDate(booking.checkOut)}</td></tr>
      <tr><td style="padding:6px 0;color:#6b6255;">Nights</td><td style="padding:6px 0;text-align:right;">${booking.nights}</td></tr>
      <tr><td style="padding:6px 0;color:#6b6255;">Guests</td><td style="padding:6px 0;text-align:right;">${booking.totalGuests}</td></tr>
    </table>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      ${roomRows}
      <tr><td style="padding:8px 0;">Subtotal</td><td style="padding:8px 0;text-align:right;">${currency(booking.subtotal, hotel.currencySymbol)}</td></tr>
      ${booking.discountAmount ? `<tr><td style="padding:8px 0;color:#8a6d3b;">Discount</td><td style="padding:8px 0;text-align:right;color:#8a6d3b;">-${currency(booking.discountAmount, hotel.currencySymbol)}</td></tr>` : ''}
      <tr><td style="padding:8px 0;">Taxes &amp; Fees</td><td style="padding:8px 0;text-align:right;">${currency(booking.taxAmount, hotel.currencySymbol)}</td></tr>
      <tr><td style="padding:12px 0;font-weight:bold;border-top:2px solid #1c1a17;">Total</td><td style="padding:12px 0;text-align:right;font-weight:bold;border-top:2px solid #1c1a17;">${currency(booking.totalAmount, hotel.currencySymbol)}</td></tr>
    </table>
    <p style="margin-top:16px;">Payment status: <strong style="text-transform:capitalize;">${booking.paymentStatus}</strong></p>
    <p>Check-in time: ${hotel.checkInTime || '14:00'} &middot; Check-out time: ${hotel.checkOutTime || '12:00'}</p>
    <p style="margin-top:24px;color:#6b6255;font-size:13px;">Please have a valid ID ready at check-in. If you have any questions, reply to this email or contact us directly.</p>
  `;

  return baseTemplate({ title: 'Your Booking is Confirmed', bodyHtml, hotel });
}

function adminNewBookingEmail(booking, hotel) {
  const bodyHtml = `
    <p>A new booking has been received.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      <tr><td style="padding:6px 0;color:#6b6255;">Reference</td><td style="padding:6px 0;text-align:right;">${booking.bookingReference}</td></tr>
      <tr><td style="padding:6px 0;color:#6b6255;">Guest</td><td style="padding:6px 0;text-align:right;">${booking.guest.fullName}</td></tr>
      <tr><td style="padding:6px 0;color:#6b6255;">Email</td><td style="padding:6px 0;text-align:right;">${booking.guest.email}</td></tr>
      <tr><td style="padding:6px 0;color:#6b6255;">Phone</td><td style="padding:6px 0;text-align:right;">${booking.guest.phone}</td></tr>
      <tr><td style="padding:6px 0;color:#6b6255;">Dates</td><td style="padding:6px 0;text-align:right;">${formatDate(booking.checkIn)} - ${formatDate(booking.checkOut)}</td></tr>
      <tr><td style="padding:6px 0;color:#6b6255;">Total</td><td style="padding:6px 0;text-align:right;font-weight:bold;">${currency(booking.totalAmount, hotel.currencySymbol)}</td></tr>
      <tr><td style="padding:6px 0;color:#6b6255;">Payment Status</td><td style="padding:6px 0;text-align:right;text-transform:capitalize;">${booking.paymentStatus}</td></tr>
    </table>
    <p style="margin-top:16px;">View it in the admin dashboard for more details.</p>
  `;
  return baseTemplate({ title: 'New Booking Received', bodyHtml, hotel });
}

module.exports = { sendMail, bookingConfirmationEmail, adminNewBookingEmail };
