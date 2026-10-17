const mongoose = require('mongoose');

const testimonialSchema = new mongoose.Schema(
  {
    guestName: { type: String, required: true, trim: true },
    guestCountry: { type: String, trim: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    message: { type: String, required: true, trim: true, maxlength: 1000 },
    avatarUrl: { type: String },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Testimonial', testimonialSchema);
