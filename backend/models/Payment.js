const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    bookingReference: { type: String, required: true, index: true },
    provider: { type: String, enum: ['paystack', 'flutterwave', 'manual'], required: true },
    reference: { type: String, required: true, unique: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'NGN' },
    status: { type: String, enum: ['initialized', 'success', 'failed', 'refunded'], default: 'initialized' },
    channel: { type: String, trim: true },
    gatewayResponse: { type: mongoose.Schema.Types.Mixed },
    paidAt: { type: Date },
    verifiedAt: { type: Date }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);
