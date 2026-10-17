const mongoose = require('mongoose');

const gallerySchema = new mongoose.Schema(
  {
    title: { type: String, trim: true },
    url: { type: String, required: true },
    publicId: { type: String },
    category: {
      type: String,
      enum: ['rooms', 'exterior', 'restaurant', 'pool', 'events', 'facilities'],
      default: 'rooms'
    },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Gallery', gallerySchema);
