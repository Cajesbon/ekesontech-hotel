const express = require('express');
const paymentController = require('../../controllers/paymentController');
const { protectAdmin } = require('../../middleware/auth');

const router = express.Router();
router.use(protectAdmin);

router.get('/', paymentController.adminGetAllPayments);

module.exports = router;
