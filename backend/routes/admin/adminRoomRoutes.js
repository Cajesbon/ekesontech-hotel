const express = require('express');
const roomController = require('../../controllers/roomController');
const { protectAdmin, restrictTo } = require('../../middleware/auth');
const upload = require('../../middleware/upload');

const router = express.Router();
router.use(protectAdmin);

router.get('/', roomController.adminGetAllRooms);
router.get('/:id', roomController.getRoom);
router.post('/', restrictTo('superadmin', 'manager'), upload.array('images', 10), roomController.createRoom);
router.put('/:id', restrictTo('superadmin', 'manager'), upload.array('images', 10), roomController.updateRoom);
router.delete('/:id', restrictTo('superadmin', 'manager'), roomController.deleteRoom);
router.patch('/:id/status', restrictTo('superadmin', 'manager'), roomController.setRoomStatus);

router.post('/types', restrictTo('superadmin', 'manager'), roomController.createRoomType);
router.put('/types/:id', restrictTo('superadmin', 'manager'), roomController.updateRoomType);
router.delete('/types/:id', restrictTo('superadmin', 'manager'), roomController.deleteRoomType);

module.exports = router;
