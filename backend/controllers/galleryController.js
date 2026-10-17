const Gallery = require('../models/Gallery');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { logAction } = require('../utils/audit');
const upload = require('../middleware/upload');

exports.getAllImages = catchAsync(async (req, res) => {
  const filter = { isActive: true };
  if (req.query.category) filter.category = req.query.category;
  const images = await Gallery.find(filter).sort({ createdAt: -1 });
  res.status(200).json({ success: true, images });
});

exports.adminGetAllImages = catchAsync(async (req, res) => {
  const filter = {};
  if (req.query.category) filter.category = req.query.category;
  const images = await Gallery.find(filter).sort({ createdAt: -1 });
  res.status(200).json({ success: true, images });
});

exports.uploadImages = catchAsync(async (req, res, next) => {
  if (!req.files || !req.files.length) return next(new AppError('Please select at least one image.', 400));

  const category = req.body.category || 'rooms';
  const docs = await Gallery.insertMany(
    req.files.map((f) => ({
      title: req.body.title || '',
      url: upload.fileUrl(f),
      publicId: f.filename,
      category
    }))
  );

  await logAction(req, { action: 'gallery_images_uploaded', targetModel: 'Gallery', details: { count: docs.length } });
  res.status(201).json({ success: true, images: docs });
});

exports.deleteImage = catchAsync(async (req, res, next) => {
  const image = await Gallery.findByIdAndDelete(req.params.id);
  if (!image) return next(new AppError('Image not found.', 404));
  await logAction(req, { action: 'gallery_image_deleted', targetModel: 'Gallery', targetId: image._id });
  res.status(200).json({ success: true, message: 'Image deleted.' });
});
