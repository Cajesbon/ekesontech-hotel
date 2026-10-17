const express = require('express');
const bookingController = require('../../controllers/bookingController');
const paymentController = require('../../controllers/paymentController');
const { protectAdmin, restrictTo } = require('../../middleware/auth');

const router = express.Router();
router.use(protectAdmin);

router.get('/', bookingController.adminGetAllBookings);
router.get('/:id', bookingController.adminGetBooking);
router.put('/:id', bookingController.adminUpdateBooking);
router.patch('/:id/status', bookingController.adminUpdateStatus);
router.patch('/:id/payment-status', restrictTo('superadmin', 'manager'), bookingController.adminUpdatePaymentStatus);
router.post('/:id/reverify-payment', restrictTo('superadmin', 'manager'), paymentController.adminReverifyPayment);
router.delete('/:id', restrictTo('superadmin'), bookingController.adminDeleteBooking);

module.exports = router;
