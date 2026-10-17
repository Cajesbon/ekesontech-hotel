const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');

const { generalApiLimiter } = require('./middleware/rateLimiters');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// Public routes
const roomRoutes = require('./routes/roomRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const promotionRoutes = require('./routes/promotionRoutes');
const amenityRoutes = require('./routes/amenityRoutes');
const galleryRoutes = require('./routes/galleryRoutes');
const facilityRoutes = require('./routes/facilityRoutes');
const testimonialRoutes = require('./routes/testimonialRoutes');
const contactRoutes = require('./routes/contactRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const authRoutes = require('./routes/authRoutes');

// Admin routes
const adminRoomRoutes = require('./routes/admin/adminRoomRoutes');
const adminBookingRoutes = require('./routes/admin/adminBookingRoutes');
const adminDashboardRoutes = require('./routes/admin/adminDashboardRoutes');
const adminPaymentRoutes = require('./routes/admin/adminPaymentRoutes');
const adminPromotionRoutes = require('./routes/admin/adminPromotionRoutes');
const adminAmenityRoutes = require('./routes/admin/adminAmenityRoutes');
const adminGalleryRoutes = require('./routes/admin/adminGalleryRoutes');
const adminFacilityRoutes = require('./routes/admin/adminFacilityRoutes');
const adminTestimonialRoutes = require('./routes/admin/adminTestimonialRoutes');
const adminContactRoutes = require('./routes/admin/adminContactRoutes');
const adminSettingsRoutes = require('./routes/admin/adminSettingsRoutes');

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: false // relaxed for a static frontend that loads its own assets; tighten in production behind a CDN/CSP config
  })
);
app.use(
  cors({
    origin: process.env.CLIENT_URL || true,
    credentials: true
  })
);

// The Paystack webhook needs the raw request body to validate the HMAC
// signature, so it must be captured BEFORE express.json() parses it.
app.use(
  '/api/payments/webhook',
  express.raw({ type: 'application/json' }),
  (req, res, next) => {
    req.rawBody = req.body;
    try {
      req.body = JSON.parse(req.body.toString('utf8'));
    } catch (err) {
      req.body = {};
    }
    next();
  }
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(mongoSanitize());
app.use(xss());

app.use('/api', generalApiLimiter);

// ---------- Public API ----------
app.use('/api/rooms', roomRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/amenities', amenityRoutes);
app.use('/api/gallery', galleryRoutes);
app.use('/api/facilities', facilityRoutes);
app.use('/api/testimonials', testimonialRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/admin/auth', authRoutes);

// ---------- Admin API ----------
app.use('/api/admin/rooms', adminRoomRoutes);
app.use('/api/admin/bookings', adminBookingRoutes);
app.use('/api/admin/dashboard', adminDashboardRoutes);
app.use('/api/admin/payments', adminPaymentRoutes);
app.use('/api/admin/promotions', adminPromotionRoutes);
app.use('/api/admin/amenities', adminAmenityRoutes);
app.use('/api/admin/gallery', adminGalleryRoutes);
app.use('/api/admin/facilities', adminFacilityRoutes);
app.use('/api/admin/testimonials', adminTestimonialRoutes);
app.use('/api/admin/messages', adminContactRoutes);
app.use('/api/admin/settings', adminSettingsRoutes);

// ---------- Static frontend ----------
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/admin', express.static(path.join(__dirname, '..', 'admin')));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send('User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: /sitemap.xml');
});

app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return notFoundHandler(req, res, next);
  next();
});

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
