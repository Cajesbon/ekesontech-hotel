const mongoose = require('mongoose');

const amenitySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    icon: { type: String, trim: true, default: 'check' }, // icon keyword used by frontend
    scope: { type: String, enum: ['room', 'hotel', 'both'], default: 'both' },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Amenity', amenitySchema);
