const mongoose = require('mongoose');

// Hotel-wide facilities (gym, pool, spa, conference room, parking, etc.),
// each shown publicly with a photo and description — distinct from Amenity
// (a short tag list attached to rooms/hotel) and Gallery (unlabeled photos).
const facilitySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true, maxlength: 1000 },
    image: {
      url: { type: String, required: true },
      publicId: { type: String }
    },
    icon: { type: String, trim: true, default: '' }, // optional short emoji/label shown alongside the name
    displayOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

facilitySchema.index({ displayOrder: 1 });

module.exports = mongoose.model('Facility', facilitySchema);
