const express = require('express');
const paymentController = require('../controllers/paymentController');

const router = express.Router();

router.post('/initialize', paymentController.initializePayment);
router.post('/verify', paymentController.verifyPayment);
// Webhook uses express.raw() body parsing, applied in app.js before json parsing for this path.
router.post('/webhook', paymentController.paystackWebhook);

module.exports = router;
