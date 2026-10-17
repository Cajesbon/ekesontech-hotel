const express = require('express');
const bookingController = require('../controllers/bookingController');

const router = express.Router();

router.post('/validate', bookingController.validatePromo);

module.exports = router;
