const express = require('express');
const testimonialController = require('../../controllers/testimonialController');
const { protectAdmin, restrictTo } = require('../../middleware/auth');

const router = express.Router();
router.use(protectAdmin, restrictTo('superadmin', 'manager'));

router.get('/', testimonialController.adminGetAllTestimonials);
router.post('/', testimonialController.createTestimonial);
router.put('/:id', testimonialController.updateTestimonial);
router.patch('/:id/status', testimonialController.setTestimonialStatus);
router.delete('/:id', testimonialController.deleteTestimonial);

module.exports = router;
