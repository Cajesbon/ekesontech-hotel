const Testimonial = require('../models/Testimonial');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { logAction } = require('../utils/audit');

// GET /api/testimonials — public, approved only
exports.getApprovedTestimonials = catchAsync(async (req, res) => {
  const testimonials = await Testimonial.find({ status: 'approved' }).sort({ createdAt: -1 }).limit(20);
  res.status(200).json({ success: true, testimonials });
});

// POST /api/testimonials — guests can submit; goes to pending for review
exports.submitTestimonial = catchAsync(async (req, res, next) => {
  const { guestName, guestCountry, rating, message } = req.body;
  if (!guestName || !rating || !message) {
    return next(new AppError('Name, rating, and message are required.', 400));
  }
  const testimonial = await Testimonial.create({ guestName, guestCountry, rating, message, status: 'pending' });
  res.status(201).json({ success: true, message: 'Thank you! Your review will appear after it is approved.', testimonial });
});

// ---------- Admin ----------

exports.adminGetAllTestimonials = catchAsync(async (req, res) => {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  const testimonials = await Testimonial.find(filter).sort({ createdAt: -1 });
  res.status(200).json({ success: true, testimonials });
});

exports.createTestimonial = catchAsync(async (req, res) => {
  const testimonial = await Testimonial.create({ ...req.body, status: req.body.status || 'approved' });
  res.status(201).json({ success: true, testimonial });
});

exports.updateTestimonial = catchAsync(async (req, res, next) => {
  const testimonial = await Testimonial.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!testimonial) return next(new AppError('Testimonial not found.', 404));
  res.status(200).json({ success: true, testimonial });
});

exports.setTestimonialStatus = catchAsync(async (req, res, next) => {
  const { status } = req.body;
  if (!['pending', 'approved', 'rejected'].includes(status)) return next(new AppError('Invalid status.', 400));
  const testimonial = await Testimonial.findByIdAndUpdate(req.params.id, { status }, { new: true });
  if (!testimonial) return next(new AppError('Testimonial not found.', 404));
  await logAction(req, { action: 'testimonial_status_changed', targetModel: 'Testimonial', targetId: testimonial._id, details: { status } });
  res.status(200).json({ success: true, testimonial });
});

exports.deleteTestimonial = catchAsync(async (req, res, next) => {
  const testimonial = await Testimonial.findByIdAndDelete(req.params.id);
  if (!testimonial) return next(new AppError('Testimonial not found.', 404));
  res.status(200).json({ success: true, message: 'Testimonial deleted.' });
});
