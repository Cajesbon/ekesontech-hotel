const mongoose = require('mongoose');

// Singleton document (only ever one settings row).
const hotelSettingsSchema = new mongoose.Schema(
  {
    hotelName: { type: String, default: 'EK Hotel' },
    logoUrl: { type: String, default: '' },
    tagline: { type: String, default: 'Where Every Stay Feels Like Royalty' },
    description: { type: String, default: '' },
    address: { type: String, default: '' },
    phone: { type: String, default: '' },
    whatsappNumber: { type: String, default: '' },
    email: { type: String, default: '' },
    checkInTime: { type: String, default: '14:00' },
    checkOutTime: { type: String, default: '12:00' },
    currency: { type: String, default: 'NGN' },
    currencySymbol: { type: String, default: '₦' },
    taxPercentage: { type: Number, default: 7.5, min: 0, max: 100 },
    bookingPolicy: { type: String, default: 'Bookings are confirmed only after successful payment.' },
    cancellationPolicy: { type: String, default: 'Free cancellation up to 48 hours before check-in.' },
    socialLinks: {
      facebook: { type: String, default: '' },
      instagram: { type: String, default: '' },
      twitter: { type: String, default: '' },
      tiktok: { type: String, default: '' }
    },
    mapEmbedUrl: { type: String, default: '' },
    latitude: { type: Number },
    longitude: { type: Number }
  },
  { timestamps: true }
);

hotelSettingsSchema.statics.getSingleton = async function getSingleton() {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

module.exports = mongoose.model('HotelSettings', hotelSettingsSchema);
