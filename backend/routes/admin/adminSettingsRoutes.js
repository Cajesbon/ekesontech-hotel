const express = require('express');
const settingsController = require('../../controllers/settingsController');
const { protectAdmin, restrictTo } = require('../../middleware/auth');
const upload = require('../../middleware/upload');

const router = express.Router();
router.use(protectAdmin, restrictTo('superadmin', 'manager'));

router.get('/', settingsController.getPublicSettings);
router.put('/', upload.single('logo'), settingsController.updateSettings);

module.exports = router;
