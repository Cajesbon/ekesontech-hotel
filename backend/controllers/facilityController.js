const Facility = require('../models/Facility');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const upload = require('../middleware/upload');
const { logAction } = require('../utils/audit');

// GET /api/facilities — public, active only, ordered for display
exports.getAllFacilities = catchAsync(async (req, res) => {
  const facilities = await Facility.find({ isActive: true }).sort({ displayOrder: 1, createdAt: 1 });
  res.status(200).json({ success: true, facilities });
});

// ---------- Admin ----------

exports.adminGetAllFacilities = catchAsync(async (req, res) => {
  const facilities = await Facility.find().sort({ displayOrder: 1, createdAt: 1 });
  res.status(200).json({ success: true, facilities });
});

// POST /api/admin/facilities (multipart, field name "image", single file)
exports.createFacility = catchAsync(async (req, res, next) => {
  const { name, description, icon, displayOrder } = req.body;
  if (!name || !description) return next(new AppError('Name and description are required.', 400));
  if (!req.file) return next(new AppError('Please upload an image for this facility.', 400));

  const facility = await Facility.create({
    name,
    description,
    icon,
    displayOrder: Number(displayOrder) || 0,
    image: { url: upload.fileUrl(req.file), publicId: req.file.filename }
  });

  await logAction(req, { action: 'facility_created', targetModel: 'Facility', targetId: facility._id, details: { name } });
  res.status(201).json({ success: true, facility });
});

// PUT /api/admin/facilities/:id (multipart, image optional on update)
exports.updateFacility = catchAsync(async (req, res, next) => {
  const facility = await Facility.findById(req.params.id);
  if (!facility) return next(new AppError('Facility not found.', 404));

  const { name, description, icon, displayOrder, isActive } = req.body;
  if (name !== undefined) facility.name = name;
  if (description !== undefined) facility.description = description;
  if (icon !== undefined) facility.icon = icon;
  if (displayOrder !== undefined) facility.displayOrder = Number(displayOrder) || 0;
  if (isActive !== undefined) facility.isActive = isActive === 'true' || isActive === true;
  if (req.file) facility.image = { url: upload.fileUrl(req.file), publicId: req.file.filename };

  await facility.save();
  await logAction(req, { action: 'facility_updated', targetModel: 'Facility', targetId: facility._id });
  res.status(200).json({ success: true, facility });
});

exports.deleteFacility = catchAsync(async (req, res, next) => {
  const facility = await Facility.findByIdAndDelete(req.params.id);
  if (!facility) return next(new AppError('Facility not found.', 404));
  await logAction(req, { action: 'facility_deleted', targetModel: 'Facility', targetId: facility._id, details: { name: facility.name } });
  res.status(200).json({ success: true, message: 'Facility deleted.' });
});
