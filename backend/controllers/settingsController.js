const HotelSettings = require('../models/HotelSettings');
const catchAsync = require('../utils/catchAsync');
const { logAction } = require('../utils/audit');
const upload = require('../middleware/upload');

// GET /api/settings — public (used to render hotel info across the site)
exports.getPublicSettings = catchAsync(async (req, res) => {
  const settings = await HotelSettings.getSingleton();
  res.status(200).json({ success: true, settings });
});

// PUT /api/admin/settings
exports.updateSettings = catchAsync(async (req, res) => {
  let settings = await HotelSettings.getSingleton();

  if (req.file) {
    req.body.logoUrl = upload.fileUrl(req.file);
  }

  Object.assign(settings, req.body);
  await settings.save();

  await logAction(req, { action: 'settings_updated', targetModel: 'HotelSettings', targetId: settings._id });
  res.status(200).json({ success: true, settings });
});
