const express = require('express');
const { body } = require('express-validator');
const bookingController = require('../controllers/bookingController');
const validate = require('../middleware/validate');
const { bookingLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

router.post(
  '/',
  bookingLimiter,
  [
    body('guest.fullName').trim().notEmpty().withMessage('Full name is required.'),
    body('guest.email').isEmail().withMessage('A valid email is required.'),
    body('guest.phone').trim().notEmpty().withMessage('Phone number is required.'),
    body('checkIn').notEmpty().withMessage('Check-in date is required.'),
    body('checkOut').notEmpty().withMessage('Check-out date is required.'),
    body('rooms').isArray({ min: 1 }).withMessage('Please select at least one room.')
  ],
  validate,
  bookingController.createBooking
);

router.get('/:reference', bookingController.getBookingByReference);

module.exports = router;
