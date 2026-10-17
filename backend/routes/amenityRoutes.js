const express = require('express');
const amenityController = require('../controllers/amenityController');

const router = express.Router();
router.get('/', amenityController.getAllAmenities);

module.exports = router;
