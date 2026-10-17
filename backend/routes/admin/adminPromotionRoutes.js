const express = require('express');
const promotionController = require('../../controllers/promotionController');
const { protectAdmin, restrictTo } = require('../../middleware/auth');

const router = express.Router();
router.use(protectAdmin, restrictTo('superadmin', 'manager'));

router.get('/', promotionController.adminGetAllPromotions);
router.post('/', promotionController.createPromotion);
router.put('/:id', promotionController.updatePromotion);
router.delete('/:id', promotionController.deletePromotion);

module.exports = router;
