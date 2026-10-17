const express = require('express');
const amenityController = require('../../controllers/amenityController');
const { protectAdmin, restrictTo } = require('../../middleware/auth');

const router = express.Router();
router.use(protectAdmin, restrictTo('superadmin', 'manager'));

router.get('/', amenityController.getAllAmenities);
router.post('/', amenityController.createAmenity);
router.put('/:id', amenityController.updateAmenity);
router.delete('/:id', amenityController.deleteAmenity);

module.exports = router;
