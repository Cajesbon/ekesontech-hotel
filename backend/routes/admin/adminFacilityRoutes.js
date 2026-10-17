const express = require('express');
const facilityController = require('../../controllers/facilityController');
const { protectAdmin, restrictTo } = require('../../middleware/auth');
const upload = require('../../middleware/upload');

const router = express.Router();
router.use(protectAdmin, restrictTo('superadmin', 'manager'));

router.get('/', facilityController.adminGetAllFacilities);
router.post('/', upload.single('image'), facilityController.createFacility);
router.put('/:id', upload.single('image'), facilityController.updateFacility);
router.delete('/:id', facilityController.deleteFacility);

module.exports = router;
