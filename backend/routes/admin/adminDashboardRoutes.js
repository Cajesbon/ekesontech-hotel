const express = require('express');
const bookingController = require('../../controllers/bookingController');
const auditController = require('../../controllers/auditController');
const notificationController = require('../../controllers/notificationController');
const { protectAdmin } = require('../../middleware/auth');

const router = express.Router();
router.use(protectAdmin);

router.get('/stats', bookingController.getDashboardStats);
router.get('/revenue-chart', bookingController.getRevenueChart);
router.get('/audit-logs', auditController.getAuditLogs);
router.get('/notifications', notificationController.getRecentNotifications);

module.exports = router;
