const express = require('express');
const contactController = require('../../controllers/contactController');
const { protectAdmin } = require('../../middleware/auth');

const router = express.Router();
router.use(protectAdmin);

router.get('/', contactController.adminGetAllMessages);
router.patch('/:id/status', contactController.adminUpdateMessageStatus);
router.delete('/:id', contactController.adminDeleteMessage);

module.exports = router;
