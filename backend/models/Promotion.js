const mongoose = require('mongoose');

const promotionSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: { type: String, trim: true },
    discountType: { type: String, enum: ['percentage', 'fixed'], required: true },
    percentageDiscount: { type: Number, min: 0, max: 100 },
    fixedDiscount: { type: Number, min: 0 },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    usageLimit: { type: Number, min: 0, default: 0 }, // 0 = unlimited
    usedCount: { type: Number, default: 0 },
    minimumBookingAmount: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

promotionSchema.methods.isValidNow = function isValidNow(amount) {
  const now = new Date();
  if (!this.isActive) return { ok: false, reason: 'This promo code is no longer active.' };
  if (now < this.startDate) return { ok: false, reason: 'This promo code is not active yet.' };
  if (now > this.endDate) return { ok: false, reason: 'This promo code has expired.' };
  if (this.usageLimit > 0 && this.usedCount >= this.usageLimit) {
    return { ok: false, reason: 'This promo code has reached its usage limit.' };
  }
  if (amount < this.minimumBookingAmount) {
    return { ok: false, reason: `A minimum booking amount of ${this.minimumBookingAmount} is required for this promo code.` };
  }
  return { ok: true };
};

module.exports = mongoose.model('Promotion', promotionSchema);
