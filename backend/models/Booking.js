const mongoose = require('mongoose');

const bookingRoomSchema = new mongoose.Schema(
  {
    room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
    roomNameSnapshot: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    guestsPerRoom: { type: Number, required: true, min: 1 },
    pricePerNightSnapshot: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const bookingSchema = new mongoose.Schema(
  {
    bookingReference: { type: String, required: true, unique: true, index: true },

    guest: {
      fullName: { type: String, required: true, trim: true },
      email: { type: String, required: true, trim: true, lowercase: true },
      phone: { type: String, required: true, trim: true },
      country: { type: String, trim: true },
      specialRequests: { type: String, trim: true, maxlength: 1000 },
      arrivalTime: { type: String, trim: true }
    },

    rooms: { type: [bookingRoomSchema], required: true, validate: v => Array.isArray(v) && v.length > 0 },

    checkIn: { type: Date, required: true },
    checkOut: { type: Date, required: true },
    nights: { type: Number, required: true, min: 1 },
    totalGuests: { type: Number, required: true, min: 1 },

    promoCode: { type: String, trim: true, uppercase: true },
    discountAmount: { type: Number, default: 0, min: 0 },

    subtotal: { type: Number, required: true, min: 0 },
    taxAmount: { type: Number, required: true, min: 0, default: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'NGN' },

    status: {
      type: String,
      enum: ['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'completed'],
      default: 'pending',
      index: true
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending',
      index: true
    },

    paymentReference: { type: String, index: true },
    paymentProvider: { type: String, enum: ['paystack', 'flutterwave', 'manual'], default: 'paystack' },

    cancellationReason: { type: String, trim: true },
    cancelledAt: { type: Date },

    // Pending bookings that never get paid are cleaned up after this time,
    // freeing the room back into availability.
    expiresAt: { type: Date, index: true },

    source: { type: String, default: 'website' }
  },
  { timestamps: true }
);

bookingSchema.index({ checkIn: 1, checkOut: 1 });
bookingSchema.index({ 'guest.email': 1 });
bookingSchema.index({ 'guest.phone': 1 });

module.exports = mongoose.model('Booking', bookingSchema);
