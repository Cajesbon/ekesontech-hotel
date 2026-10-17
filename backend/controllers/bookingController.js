const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Room = require('../models/Room');
const Promotion = require('../models/Promotion');
const HotelSettings = require('../models/HotelSettings');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { checkRoomAvailability, validateDateRange } = require('../services/availabilityService');
const { generateBookingReference } = require('../utils/generateReference');
const { sendMail, bookingConfirmationEmail, adminNewBookingEmail } = require('../services/emailService');
const { logAction } = require('../utils/audit');

const PENDING_BOOKING_TTL_MINUTES = 30;

async function createUniqueReference() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const ref = generateBookingReference();
    // eslint-disable-next-line no-await-in-loop
    const exists = await Booking.exists({ bookingReference: ref });
    if (!exists) return ref;
  }
  throw new AppError('Could not generate a unique booking reference. Please try again.', 500);
}

async function applyPromotion(promoCode, subtotal) {
  if (!promoCode) return { discountAmount: 0, promotion: null };

  const promotion = await Promotion.findOne({ code: promoCode.toUpperCase() });
  if (!promotion) throw new AppError('Invalid promo code.', 400);

  const validity = promotion.isValidNow(subtotal);
  if (!validity.ok) throw new AppError(validity.reason, 400);

  let discountAmount = 0;
  if (promotion.discountType === 'percentage') {
    discountAmount = (subtotal * (promotion.percentageDiscount || 0)) / 100;
  } else {
    discountAmount = promotion.fixedDiscount || 0;
  }
  discountAmount = Math.min(discountAmount, subtotal);

  return { discountAmount, promotion };
}

// POST /api/bookings
// Creates a PENDING booking after re-validating availability server-side.
// This is guest checkout — no authentication required.
exports.createBooking = catchAsync(async (req, res, next) => {
  const { guest, rooms, checkIn, checkOut, promoCode } = req.body;

  if (!guest || !guest.fullName || !guest.email || !guest.phone) {
    return next(new AppError('Full name, email, and phone number are required.', 400));
  }
  if (!Array.isArray(rooms) || rooms.length === 0) {
    return next(new AppError('Please select at least one room.', 400));
  }

  const { checkIn: ci, checkOut: co, nights } = validateDateRange(checkIn, checkOut);

  const settings = await HotelSettings.getSingleton();

  let subtotal = 0;
  let totalGuests = 0;
  const bookingRooms = [];

  // Re-check availability for every requested room against the database.
  // This is the authoritative check — the frontend's earlier check was
  // only a convenience for the user.
  for (const item of rooms) {
    const quantity = Number(item.quantity) || 1;
    const guestsPerRoom = Number(item.guests) || 1;

    // eslint-disable-next-line no-await-in-loop
    const availability = await checkRoomAvailability(item.roomId, ci, co, quantity);
    if (!availability.available) {
      return next(new AppError(`${availability.room.name}: ${availability.reason}`, 409));
    }
    if (guestsPerRoom > availability.room.maxGuests * quantity) {
      return next(new AppError(`${availability.room.name} cannot accommodate that many guests.`, 400));
    }

    subtotal += availability.room.pricePerNight * quantity * nights;
    totalGuests += guestsPerRoom;

    bookingRooms.push({
      room: availability.room._id,
      roomNameSnapshot: availability.room.name,
      quantity,
      guestsPerRoom,
      pricePerNightSnapshot: availability.room.pricePerNight
    });
  }

  const { discountAmount, promotion } = await applyPromotion(promoCode, subtotal);
  const taxableAmount = subtotal - discountAmount;
  const taxAmount = Math.round((taxableAmount * (settings.taxPercentage || 0)) / 100 * 100) / 100;
  const totalAmount = Math.round((taxableAmount + taxAmount) * 100) / 100;

  const bookingReference = await createUniqueReference();

  const booking = await Booking.create({
    bookingReference,
    guest: {
      fullName: guest.fullName,
      email: guest.email.toLowerCase(),
      phone: guest.phone,
      country: guest.country,
      specialRequests: guest.specialRequests,
      arrivalTime: guest.arrivalTime
    },
    rooms: bookingRooms,
    checkIn: ci,
    checkOut: co,
    nights,
    totalGuests,
    promoCode: promotion ? promotion.code : undefined,
    discountAmount,
    subtotal,
    taxAmount,
    totalAmount,
    currency: settings.currency,
    status: 'pending',
    paymentStatus: 'pending',
    expiresAt: new Date(Date.now() + PENDING_BOOKING_TTL_MINUTES * 60 * 1000)
  });

  if (promotion) {
    promotion.usedCount += 1;
    await promotion.save();
  }

  res.status(201).json({
    success: true,
    booking,
    message: 'Booking created. Please proceed to payment to confirm your reservation.'
  });
});

// GET /api/bookings/:reference  (guest lookup, public — reference acts as the secret)
exports.getBookingByReference = catchAsync(async (req, res, next) => {
  const booking = await Booking.findOne({ bookingReference: req.params.reference }).populate('rooms.room', 'name images');
  if (!booking) return next(new AppError('Booking not found. Please check your booking reference.', 404));
  res.status(200).json({ success: true, booking });
});

// POST /api/promotions/validate  { code, amount }
exports.validatePromo = catchAsync(async (req, res, next) => {
  const { code, amount } = req.body;
  if (!code) return next(new AppError('Please enter a promo code.', 400));

  const promotion = await Promotion.findOne({ code: code.toUpperCase() });
  if (!promotion) return next(new AppError('Invalid promo code.', 400));

  const validity = promotion.isValidNow(Number(amount) || 0);
  if (!validity.ok) return next(new AppError(validity.reason, 400));

  let discountAmount = 0;
  if (promotion.discountType === 'percentage') {
    discountAmount = ((Number(amount) || 0) * (promotion.percentageDiscount || 0)) / 100;
  } else {
    discountAmount = promotion.fixedDiscount || 0;
  }

  res.status(200).json({
    success: true,
    valid: true,
    discountType: promotion.discountType,
    discountAmount: Math.min(discountAmount, Number(amount) || 0)
  });
});

// ---------- Admin ----------

// GET /api/admin/bookings
exports.adminGetAllBookings = catchAsync(async (req, res) => {
  const {
    page = 1, limit = 20, status, paymentStatus, search, from, to
  } = req.query;

  const filter = {};
  if (status) filter.status = status;
  if (paymentStatus) filter.paymentStatus = paymentStatus;
  if (from || to) {
    filter.checkIn = {};
    if (from) filter.checkIn.$gte = new Date(from);
    if (to) filter.checkIn.$lte = new Date(to);
  }
  if (search) {
    filter.$or = [
      { bookingReference: { $regex: search, $options: 'i' } },
      { 'guest.fullName': { $regex: search, $options: 'i' } },
      { 'guest.email': { $regex: search, $options: 'i' } },
      { 'guest.phone': { $regex: search, $options: 'i' } }
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);
  const bookings = await Booking.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit));
  const total = await Booking.countDocuments(filter);

  res.status(200).json({
    success: true,
    count: bookings.length,
    total,
    page: Number(page),
    pages: Math.ceil(total / limit),
    bookings
  });
});

// GET /api/admin/bookings/:id
exports.adminGetBooking = catchAsync(async (req, res, next) => {
  const booking = await Booking.findById(req.params.id).populate('rooms.room');
  if (!booking) return next(new AppError('Booking not found.', 404));
  res.status(200).json({ success: true, booking });
});

// PUT /api/admin/bookings/:id  (general update: guest info, special requests, etc.)
exports.adminUpdateBooking = catchAsync(async (req, res, next) => {
  const allowedFields = ['guest', 'checkIn', 'checkOut'];
  const updates = {};
  allowedFields.forEach((f) => {
    if (req.body[f] !== undefined) updates[f] = req.body[f];
  });

  const booking = await Booking.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
  if (!booking) return next(new AppError('Booking not found.', 404));

  await logAction(req, { action: 'booking_updated', targetModel: 'Booking', targetId: booking._id });
  res.status(200).json({ success: true, booking });
});

// PATCH /api/admin/bookings/:id/status  { status }
exports.adminUpdateStatus = catchAsync(async (req, res, next) => {
  const { status, reason } = req.body;
  const validStatuses = ['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'completed'];
  if (!validStatuses.includes(status)) return next(new AppError('Invalid booking status.', 400));

  const booking = await Booking.findById(req.params.id);
  if (!booking) return next(new AppError('Booking not found.', 404));

  booking.status = status;
  if (status === 'cancelled') {
    booking.cancellationReason = reason || 'Cancelled by admin';
    booking.cancelledAt = new Date();
  }
  await booking.save();

  await logAction(req, { action: 'booking_status_changed', targetModel: 'Booking', targetId: booking._id, details: { status } });
  res.status(200).json({ success: true, booking });
});

// PATCH /api/admin/bookings/:id/payment-status  { paymentStatus }
exports.adminUpdatePaymentStatus = catchAsync(async (req, res, next) => {
  const { paymentStatus } = req.body;
  if (!['pending', 'paid', 'failed', 'refunded'].includes(paymentStatus)) {
    return next(new AppError('Invalid payment status.', 400));
  }
  const booking = await Booking.findByIdAndUpdate(req.params.id, { paymentStatus }, { new: true });
  if (!booking) return next(new AppError('Booking not found.', 404));

  await logAction(req, { action: 'payment_status_changed', targetModel: 'Booking', targetId: booking._id, details: { paymentStatus } });
  res.status(200).json({ success: true, booking });
});

// DELETE /api/admin/bookings/:id
exports.adminDeleteBooking = catchAsync(async (req, res, next) => {
  const booking = await Booking.findByIdAndDelete(req.params.id);
  if (!booking) return next(new AppError('Booking not found.', 404));
  await logAction(req, { action: 'booking_deleted', targetModel: 'Booking', targetId: booking._id });
  res.status(200).json({ success: true, message: 'Booking deleted.' });
});

// GET /api/admin/dashboard/stats
exports.getDashboardStats = catchAsync(async (req, res) => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const [
    totalBookings, todaysBookings, upcomingBookings, pendingBookings,
    confirmedBookings, cancelledBookings, totalRooms, activeRooms,
    revenueAgg, monthlyRevenueAgg
  ] = await Promise.all([
    Booking.countDocuments({}),
    Booking.countDocuments({ checkIn: { $gte: startOfToday, $lte: endOfToday } }),
    Booking.countDocuments({ checkIn: { $gt: endOfToday }, status: { $in: ['pending', 'confirmed'] } }),
    Booking.countDocuments({ status: 'pending' }),
    Booking.countDocuments({ status: 'confirmed' }),
    Booking.countDocuments({ status: 'cancelled' }),
    Room.countDocuments({}),
    Room.countDocuments({ status: 'active' }),
    Booking.aggregate([{ $match: { paymentStatus: 'paid' } }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
    Booking.aggregate([
      { $match: { paymentStatus: 'paid', createdAt: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ])
  ]);

  // "Occupied" rooms = active rooms with at least one currently checked-in
  // or confirmed booking overlapping today.
  const occupiedRoomIds = await Booking.aggregate([
    { $match: { status: { $in: ['confirmed', 'checked_in'] }, checkIn: { $lte: endOfToday }, checkOut: { $gt: startOfToday } } },
    { $unwind: '$rooms' },
    { $group: { _id: '$rooms.room' } }
  ]);

  res.status(200).json({
    success: true,
    stats: {
      totalBookings,
      todaysBookings,
      upcomingBookings,
      pendingBookings,
      confirmedBookings,
      cancelledBookings,
      totalRooms,
      availableRooms: Math.max(activeRooms - occupiedRoomIds.length, 0),
      occupiedRooms: occupiedRoomIds.length,
      totalRevenue: revenueAgg.length ? revenueAgg[0].total : 0,
      monthlyRevenue: monthlyRevenueAgg.length ? monthlyRevenueAgg[0].total : 0
    }
  });
});

// GET /api/admin/dashboard/revenue-chart?months=6
exports.getRevenueChart = catchAsync(async (req, res) => {
  const months = Number(req.query.months) || 6;
  const start = new Date();
  start.setMonth(start.getMonth() - (months - 1));
  start.setDate(1);
  start.setHours(0, 0, 0, 0);

  const data = await Booking.aggregate([
    { $match: { paymentStatus: 'paid', createdAt: { $gte: start } } },
    {
      $group: {
        _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
        revenue: { $sum: '$totalAmount' },
        bookings: { $sum: 1 }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } }
  ]);

  res.status(200).json({ success: true, data });
});

exports.PENDING_BOOKING_TTL_MINUTES = PENDING_BOOKING_TTL_MINUTES;
