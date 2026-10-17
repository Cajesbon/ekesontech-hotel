const Promotion = require('../models/Promotion');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { logAction } = require('../utils/audit');

exports.adminGetAllPromotions = catchAsync(async (req, res) => {
  const promotions = await Promotion.find().sort({ createdAt: -1 });
  res.status(200).json({ success: true, promotions });
});

exports.createPromotion = catchAsync(async (req, res, next) => {
  const body = { ...req.body };
  if (body.discountType === 'percentage' && !body.percentageDiscount) {
    return next(new AppError('percentageDiscount is required for percentage promotions.', 400));
  }
  if (body.discountType === 'fixed' && !body.fixedDiscount) {
    return next(new AppError('fixedDiscount is required for fixed promotions.', 400));
  }
  const promotion = await Promotion.create(body);
  await logAction(req, { action: 'promotion_created', targetModel: 'Promotion', targetId: promotion._id, details: { code: promotion.code } });
  res.status(201).json({ success: true, promotion });
});

exports.updatePromotion = catchAsync(async (req, res, next) => {
  const promotion = await Promotion.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!promotion) return next(new AppError('Promotion not found.', 404));
  await logAction(req, { action: 'promotion_updated', targetModel: 'Promotion', targetId: promotion._id });
  res.status(200).json({ success: true, promotion });
});

exports.deletePromotion = catchAsync(async (req, res, next) => {
  const promotion = await Promotion.findByIdAndDelete(req.params.id);
  if (!promotion) return next(new AppError('Promotion not found.', 404));
  res.status(200).json({ success: true, message: 'Promotion deleted.' });
});
