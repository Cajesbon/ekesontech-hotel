const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Room = require('../models/Room');
const AppError = require('../utils/AppError');

// Booking statuses/payment states that count as "holding" a room against
// availability. Cancelled bookings never hold a room. Expired, unpaid
// pending bookings do not hold a room either (see the expiresAt check).
const BLOCKING_STATUSES = ['pending', 'confirmed', 'checked_in', 'checked_out'];

/**
 * Returns the number of units of `roomId` already booked for any date
 * range that overlaps [checkIn, checkOut).
 *
 * Overlap rule (industry standard): two ranges overlap when
 *   existing.checkIn < requested.checkOut AND existing.checkOut > requested.checkIn
 * A checkout on the same day as a new check-in does NOT count as an overlap.
 *
 * @param {String} roomId
 * @param {Date} checkIn
 * @param {Date} checkOut
 * @param {String} [excludeBookingId] - exclude a booking (e.g. when re-checking during an update)
 */
async function getBookedUnits(roomId, checkIn, checkOut, excludeBookingId = null) {
  const now = new Date();

  const match = {
    status: { $in: BLOCKING_STATUSES },
    checkIn: { $lt: checkOut },
    checkOut: { $gt: checkIn },
    $or: [
      { status: { $ne: 'pending' } },
      { status: 'pending', expiresAt: { $exists: false } },
      { status: 'pending', expiresAt: { $gt: now } }
    ]
  };

  if (excludeBookingId) {
    match._id = { $ne: new mongoose.Types.ObjectId(excludeBookingId) };
  }

  const result = await Booking.aggregate([
    { $match: match },
    { $unwind: '$rooms' },
    { $match: { 'rooms.room': new mongoose.Types.ObjectId(roomId) } },
    { $group: { _id: null, totalBooked: { $sum: '$rooms.quantity' } } }
  ]);

  return result.length ? result[0].totalBooked : 0;
}

/**
 * Checks whether `quantity` units of a room are available for the given
 * date range. Always hits the database — never trust client-supplied
 * availability claims.
 */
async function checkRoomAvailability(roomId, checkIn, checkOut, quantity = 1, excludeBookingId = null) {
  const room = await Room.findById(roomId);
  if (!room) throw new AppError('Room not found.', 404);
  if (room.status !== 'active') {
    return { available: false, room, reason: 'This room is not currently available for booking.' };
  }

  const bookedUnits = await getBookedUnits(roomId, checkIn, checkOut, excludeBookingId);
  const remaining = room.totalUnits - bookedUnits;
  const available = remaining >= quantity;

  return {
    available,
    room,
    remaining: Math.max(remaining, 0),
    reason: available ? null : 'Sorry, this room is no longer available for the selected dates.'
  };
}

function validateDateRange(checkInRaw, checkOutRaw) {
  const checkIn = new Date(checkInRaw);
  const checkOut = new Date(checkOutRaw);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) {
    throw new AppError('Please provide valid check-in and check-out dates.', 400);
  }
  if (checkIn < today) {
    throw new AppError('Check-in date cannot be in the past.', 400);
  }
  if (checkOut <= checkIn) {
    throw new AppError('Check-out date must be after the check-in date.', 400);
  }

  const nights = Math.round((checkOut - checkIn) / (1000 * 60 * 60 * 24));
  return { checkIn, checkOut, nights };
}

module.exports = { getBookedUnits, checkRoomAvailability, validateDateRange, BLOCKING_STATUSES };
