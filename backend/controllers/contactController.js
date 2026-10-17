const ContactMessage = require('../models/ContactMessage');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { sendMail } = require('../services/emailService');
const HotelSettings = require('../models/HotelSettings');

// POST /api/contact — public
exports.submitContactMessage = catchAsync(async (req, res, next) => {
  const { name, email, phone, subject, message } = req.body;
  if (!name || !email || !message) {
    return next(new AppError('Name, email, and message are required.', 400));
  }

  const contact = await ContactMessage.create({ name, email, phone, subject, message });

  const settings = await HotelSettings.getSingleton();
  const notifyTo = settings.email || process.env.HOTEL_EMAIL;
  if (notifyTo) {
    await sendMail({
      to: notifyTo,
      subject: `New Contact Message: ${subject || 'General Inquiry'}`,
      html: `<p><strong>${name}</strong> (${email}${phone ? `, ${phone}` : ''}) wrote:</p><p>${message}</p>`
    });
  }

  res.status(201).json({ success: true, message: 'Thank you for reaching out. We will get back to you shortly.', contact });
});

// ---------- Admin ----------

exports.adminGetAllMessages = catchAsync(async (req, res) => {
  const { page = 1, limit = 20, status } = req.query;
  const filter = {};
  if (status) filter.status = status;
  const skip = (Number(page) - 1) * Number(limit);
  const messages = await ContactMessage.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit));
  const total = await ContactMessage.countDocuments(filter);
  res.status(200).json({ success: true, count: messages.length, total, page: Number(page), pages: Math.ceil(total / limit), messages });
});

exports.adminUpdateMessageStatus = catchAsync(async (req, res, next) => {
  const { status } = req.body;
  if (!['new', 'read', 'resolved'].includes(status)) return next(new AppError('Invalid status.', 400));
  const message = await ContactMessage.findByIdAndUpdate(req.params.id, { status }, { new: true });
  if (!message) return next(new AppError('Message not found.', 404));
  res.status(200).json({ success: true, message: message });
});

exports.adminDeleteMessage = catchAsync(async (req, res, next) => {
  const message = await ContactMessage.findByIdAndDelete(req.params.id);
  if (!message) return next(new AppError('Message not found.', 404));
  res.status(200).json({ success: true, message: 'Message deleted.' });
});
