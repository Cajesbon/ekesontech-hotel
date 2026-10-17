const mongoose = require('mongoose');

// Room types are admin-managed rather than hardcoded, per requirements.
const roomTypeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, trim: true },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('RoomType', roomTypeSchema);
