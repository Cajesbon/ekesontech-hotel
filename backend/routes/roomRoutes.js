const express = require('express');
const roomController = require('../controllers/roomController');

const router = express.Router();

// Public room browsing endpoints
router.get('/', roomController.getAllRooms);
router.get('/availability', roomController.checkAvailability);
router.get('/types/all', roomController.getRoomTypes);
router.get('/:id', roomController.getRoom);

module.exports = router;
