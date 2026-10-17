const express = require('express');
const galleryController = require('../../controllers/galleryController');
const { protectAdmin, restrictTo } = require('../../middleware/auth');
const upload = require('../../middleware/upload');

const router = express.Router();
router.use(protectAdmin, restrictTo('superadmin', 'manager'));

router.get('/', galleryController.adminGetAllImages);
router.post('/', upload.array('images', 12), galleryController.uploadImages);
router.delete('/:id', galleryController.deleteImage);

module.exports = router;
