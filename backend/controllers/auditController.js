const AuditLog = require('../models/AuditLog');
const catchAsync = require('../utils/catchAsync');

exports.getAuditLogs = catchAsync(async (req, res) => {
  const { page = 1, limit = 30 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const logs = await AuditLog.find().sort({ createdAt: -1 }).skip(skip).limit(Number(limit));
  const total = await AuditLog.countDocuments();
  res.status(200).json({ success: true, count: logs.length, total, page: Number(page), pages: Math.ceil(total / limit), logs });
});
