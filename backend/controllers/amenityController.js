const Amenity = require('../models/Amenity');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { logAction } = require('../utils/audit');

exports.getAllAmenities = catchAsync(async (req, res) => {
  const filter = req.query.scope ? { scope: { $in: [req.query.scope, 'both'] } } : {};
  if (!req.admin) filter.isActive = true;
  const amenities = await Amenity.find(filter).sort('name');
  res.status(200).json({ success: true, amenities });
});

exports.createAmenity = catchAsync(async (req, res) => {
  const amenity = await Amenity.create(req.body);
  await logAction(req, { action: 'amenity_created', targetModel: 'Amenity', targetId: amenity._id });
  res.status(201).json({ success: true, amenity });
});

exports.updateAmenity = catchAsync(async (req, res, next) => {
  const amenity = await Amenity.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!amenity) return next(new AppError('Amenity not found.', 404));
  await logAction(req, { action: 'amenity_updated', targetModel: 'Amenity', targetId: amenity._id });
  res.status(200).json({ success: true, amenity });
});

exports.deleteAmenity = catchAsync(async (req, res, next) => {
  const amenity = await Amenity.findByIdAndDelete(req.params.id);
  if (!amenity) return next(new AppError('Amenity not found.', 404));
  await logAction(req, { action: 'amenity_deleted', targetModel: 'Amenity', targetId: amenity._id });
  res.status(200).json({ success: true, message: 'Amenity deleted.' });
});
