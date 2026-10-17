const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { protectAdmin, restrictTo } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

router.post(
  '/login',
  authLimiter,
  [body('email').isEmail().withMessage('A valid email is required.'), body('password').notEmpty().withMessage('Password is required.')],
  validate,
  authController.login
);

router.post(
  '/signup',
  authLimiter,
  [
    body('name').trim().notEmpty().withMessage('Name is required.'),
    body('email').isEmail().withMessage('A valid email is required.'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
    body('role').optional().isIn(['manager', 'staff']).withMessage('Role must be manager or staff.')
  ],
  validate,
  authController.signup
);

router.post('/logout', authController.logout);
router.get('/me', protectAdmin, authController.getMe);
router.put('/update-password', protectAdmin, authController.updatePassword);

router.post('/create-admin', protectAdmin, restrictTo('superadmin'), authController.createAdmin);

// Staff account management — superadmin only.
router.get('/pending', protectAdmin, restrictTo('superadmin'), authController.getPendingAdmins);
router.get('/all', protectAdmin, restrictTo('superadmin'), authController.getAllAdmins);
router.patch('/:id/approve', protectAdmin, restrictTo('superadmin'), authController.approveAdmin);
router.patch('/:id/reject', protectAdmin, restrictTo('superadmin'), authController.rejectAdmin);
router.patch('/:id/active', protectAdmin, restrictTo('superadmin'), authController.setAdminActive);
router.patch('/:id/role', protectAdmin, restrictTo('superadmin'), authController.updateAdminRole);
router.delete('/:id', protectAdmin, restrictTo('superadmin'), authController.deleteAdminAccount);

module.exports = router;
