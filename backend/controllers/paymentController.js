const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const HotelSettings = require('../models/HotelSettings');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const paymentService = require('../services/paymentService');
const { generatePaymentReference } = require('../utils/generateReference');
const { sendMail, bookingConfirmationEmail, adminNewBookingEmail } = require('../services/emailService');
const { checkRoomAvailability } = require('../services/availabilityService');

// POST /api/payments/initialize  { bookingReference }
exports.initializePayment = catchAsync(async (req, res, next) => {
  const { bookingReference } = req.body;
  if (!bookingReference) return next(new AppError('bookingReference is required.', 400));

  const booking = await Booking.findOne({ bookingReference });
  if (!booking) return next(new AppError('Booking not found.', 404));

  if (booking.status === 'cancelled') {
    return next(new AppError('This booking has been cancelled and cannot be paid for.', 400));
  }
  if (booking.paymentStatus === 'paid') {
    return next(new AppError('This booking has already been paid for.', 400));
  }
  if (booking.expiresAt && booking.expiresAt < new Date()) {
    return next(new AppError('This booking has expired. Please make a new booking.', 410));
  }

  // Re-verify availability one more time right before sending the guest
  // to the payment gateway, to minimize race conditions.
  for (const line of booking.rooms) {
    // eslint-disable-next-line no-await-in-loop
    const availability = await checkRoomAvailability(line.room, booking.checkIn, booking.checkOut, line.quantity);
    if (!availability.available) {
      return next(new AppError(`${line.roomNameSnapshot}: ${availability.reason}`, 409));
    }
  }

  const reference = generatePaymentReference();
  // Prefer an explicitly configured CLIENT_URL (recommended for production,
  // where the domain is fixed). If it isn't set, derive the origin from the
  // actual incoming request instead of hardcoding localhost — otherwise,
  // whenever the site is reached through anything other than the exact
  // machine running the server (a dev tunnel, ngrok, a phone on the same
  // network), the payment gateway would redirect back to a literal
  // "localhost" that the guest's own device can't connect to.
  const origin = process.env.CLIENT_URL || `${req.protocol}://${req.get('host')}`;
  const callbackUrl = `${origin}/confirmation.html?ref=${booking.bookingReference}`;

  const gatewayResult = await paymentService.initializePayment({
    email: booking.guest.email,
    amount: booking.totalAmount,
    reference,
    callbackUrl,
    currency: booking.currency,
    metadata: { bookingReference: booking.bookingReference }
  });

  await Payment.create({
    booking: booking._id,
    bookingReference: booking.bookingReference,
    provider: paymentService.PROVIDER,
    reference,
    amount: booking.totalAmount,
    currency: booking.currency,
    status: 'initialized'
  });

  booking.paymentReference = reference;
  booking.paymentProvider = paymentService.PROVIDER;
  await booking.save({ validateBeforeSave: false });

  res.status(200).json({
    success: true,
    authorizationUrl: gatewayResult.authorizationUrl,
    reference
  });
});

async function finalizeSuccessfulPayment(payment, booking) {
  if (booking.paymentStatus === 'paid') return; // idempotent: ignore duplicate webhooks/verifications

  // Final availability re-check before confirming, to guard against a
  // race where another guest booked the same room while this payment
  // was in flight.
  for (const line of booking.rooms) {
    // eslint-disable-next-line no-await-in-loop
    const availability = await checkRoomAvailability(line.room, booking.checkIn, booking.checkOut, line.quantity, booking._id);
    if (!availability.available) {
      booking.paymentStatus = 'failed';
      booking.status = 'cancelled';
      booking.cancellationReason = 'Room became unavailable during payment processing. Payment will be refunded.';
      await booking.save({ validateBeforeSave: false });
      payment.status = 'refunded';
      await payment.save();
      return;
    }
  }

  booking.paymentStatus = 'paid';
  booking.status = 'confirmed';
  await booking.save({ validateBeforeSave: false });

  payment.status = 'success';
  payment.paidAt = new Date();
  payment.verifiedAt = new Date();
  await payment.save();

  const settings = await HotelSettings.getSingleton();
  await sendMail({
    to: booking.guest.email,
    subject: `Booking Confirmed - ${booking.bookingReference}`,
    html: bookingConfirmationEmail(booking, settings)
  });
  if (settings.email || process.env.HOTEL_EMAIL) {
    await sendMail({
      to: settings.email || process.env.HOTEL_EMAIL,
      subject: `New Booking Received - ${booking.bookingReference}`,
      html: adminNewBookingEmail(booking, settings)
    });
  }
}

// POST /api/payments/verify  { reference }
// Called from the frontend after the gateway redirects back. The backend
// re-verifies with the gateway directly — the frontend's own belief that
// payment succeeded is never trusted on its own.
exports.verifyPayment = catchAsync(async (req, res, next) => {
  const { reference } = req.body;
  if (!reference) return next(new AppError('reference is required.', 400));

  const payment = await Payment.findOne({ reference });
  if (!payment) return next(new AppError('Payment record not found.', 404));

  const booking = await Booking.findById(payment.booking);
  if (!booking) return next(new AppError('Associated booking not found.', 404));

  if (booking.paymentStatus === 'paid') {
    return res.status(200).json({ success: true, alreadyConfirmed: true, booking });
  }

  const verification = await paymentService.verifyPayment({ provider: payment.provider, reference });
  payment.gatewayResponse = verification.raw;
  payment.channel = verification.channel;

  if (!verification.success) {
    payment.status = 'failed';
    await payment.save();
    booking.paymentStatus = 'failed';
    await booking.save({ validateBeforeSave: false });
    return next(new AppError('Your payment could not be completed. Please try again.', 402));
  }

  await finalizeSuccessfulPayment(payment, booking);

  const refreshed = await Booking.findById(booking._id);
  res.status(200).json({ success: true, booking: refreshed });
});

// POST /api/payments/webhook (Paystack webhook)
// This is the authoritative source of truth for payment confirmation in
// production — the redirect-based /verify flow is a convenience for the
// browser, but the webhook is what we should ultimately trust.
exports.paystackWebhook = catchAsync(async (req, res) => {
  const signature = req.headers['x-paystack-signature'];
  const isValid = paymentService.verifyPaystackWebhookSignature(req.rawBody, signature);

  // Always respond 200 quickly to acknowledge receipt, even on invalid
  // signature, to avoid leaking verification details and to satisfy the
  // gateway's retry expectations. We simply skip processing if invalid.
  if (!isValid) {
    console.warn('Received Paystack webhook with invalid signature.');
    return res.sendStatus(200);
  }

  const event = req.body;
  if (event.event === 'charge.success') {
    const reference = event.data.reference;
    const payment = await Payment.findOne({ reference });
    if (payment && payment.status !== 'success') {
      const booking = await Booking.findById(payment.booking);
      if (booking) {
        payment.gatewayResponse = event.data;
        payment.channel = event.data.channel;
        await finalizeSuccessfulPayment(payment, booking);
      }
    }
  }

  res.sendStatus(200);
});

// GET /api/admin/payments
exports.adminGetAllPayments = catchAsync(async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  const filter = {};
  if (status) filter.status = status;

  const skip = (Number(page) - 1) * Number(limit);
  const payments = await Payment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit));
  const total = await Payment.countDocuments(filter);

  res.status(200).json({ success: true, count: payments.length, total, page: Number(page), pages: Math.ceil(total / limit), payments });
});

// POST /api/admin/bookings/:id/reverify-payment
// Lets an admin manually re-check a booking's payment against the gateway
// directly — useful when a guest's browser never made it back to the
// confirmation page (a broken redirect, a closed tab, a flaky connection)
// and the webhook either isn't configured or hasn't fired yet, leaving a
// booking stuck on "pending" even though the guest may have actually paid.
exports.adminReverifyPayment = catchAsync(async (req, res, next) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) return next(new AppError('Booking not found.', 404));

  if (booking.paymentStatus === 'paid') {
    return res.status(200).json({ success: true, alreadyConfirmed: true, booking });
  }
  if (!booking.paymentReference) {
    return next(new AppError('This booking has no payment reference to verify — no payment was ever initialized for it.', 400));
  }

  const payment = await Payment.findOne({ reference: booking.paymentReference });
  if (!payment) return next(new AppError('No payment record found for this booking\'s reference.', 404));

  const verification = await paymentService.verifyPayment({ provider: payment.provider, reference: payment.reference });
  payment.gatewayResponse = verification.raw;
  payment.channel = verification.channel;

  if (!verification.success) {
    payment.status = 'failed';
    await payment.save();
    return next(new AppError('The payment gateway reports this transaction was not successful.', 402));
  }

  await finalizeSuccessfulPayment(payment, booking);

  const refreshed = await Booking.findById(booking._id);
  res.status(200).json({ success: true, booking: refreshed });
});
