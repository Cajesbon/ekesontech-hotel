const mongoose = require('mongoose');

const imageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String }, // Cloudinary public_id, for deletion
    altText: { type: String, default: '' }
  },
  { _id: false }
);

const roomSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, index: true },
    roomType: { type: mongoose.Schema.Types.ObjectId, ref: 'RoomType', required: true },
    description: { type: String, required: true },
    shortDescription: { type: String, trim: true, maxlength: 220 },
    pricePerNight: { type: Number, required: true, min: 0 },
    maxGuests: { type: Number, required: true, min: 1 },
    bedType: { type: String, required: true, trim: true },
    sizeSqm: { type: Number, min: 0 },
    totalUnits: { type: Number, required: true, min: 1, default: 1 }, // how many physical rooms of this type
    amenities: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Amenity' }],
    facilities: [{ type: String, trim: true }],
    images: [imageSchema],
    status: { type: String, enum: ['active', 'disabled', 'maintenance'], default: 'active' },
    isFeatured: { type: Boolean, default: false },
    ratingAverage: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0 }
  },
  { timestamps: true }
);

roomSchema.index({ pricePerNight: 1 });
roomSchema.index({ roomType: 1 });
roomSchema.index({ status: 1 });

roomSchema.pre('validate', function generateSlug(next) {
  if (this.name && (!this.slug || this.isModified('name'))) {
    this.slug = this.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') + '-' + Math.random().toString(36).slice(2, 7);
  }
  next();
});

module.exports = mongoose.model('Room', roomSchema);
