const Booking = require('../models/Booking');
const ContactMessage = require('../models/ContactMessage');
const Testimonial = require('../models/Testimonial');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

// GET /api/admin/dashboard/notifications?since=<ISO timestamp>
// Returns anything admin-relevant created after `since`, so the dashboard
// can poll this periodically and surface browser notifications for new
// bookings, contact messages, and pending testimonial reviews without
// needing a websocket/push infrastructure.
exports.getRecentNotifications = catchAsync(async (req, res, next) => {
  const { since } = req.query;
  if (!since) return next(new AppError('A "since" timestamp is required.', 400));

  const sinceDate = new Date(since);
  if (Number.isNaN(sinceDate.getTime())) return next(new AppError('Invalid "since" timestamp.', 400));

  const [bookings, messages, testimonials] = await Promise.all([
    Booking.find({ createdAt: { $gt: sinceDate } })
      .select('bookingReference guest.fullName totalAmount status paymentStatus createdAt')
      .sort({ createdAt: -1 })
      .limit(20),
    ContactMessage.find({ createdAt: { $gt: sinceDate } })
      .select('name subject createdAt')
      .sort({ createdAt: -1 })
      .limit(20),
    Testimonial.find({ createdAt: { $gt: sinceDate }, status: 'pending' })
      .select('guestName rating createdAt')
      .sort({ createdAt: -1 })
      .limit(20)
  ]);

  res.status(200).json({
    success: true,
    serverTime: new Date().toISOString(),
    bookings,
    messages,
    testimonials
  });
});
