const express = require('express');
const testimonialController = require('../controllers/testimonialController');

const router = express.Router();
router.get('/', testimonialController.getApprovedTestimonials);
router.post('/', testimonialController.submitTestimonial);

module.exports = router;
