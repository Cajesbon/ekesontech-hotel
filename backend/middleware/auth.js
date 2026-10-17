const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

// Verifies the JWT (from an httpOnly cookie or Authorization header) and
// attaches the authenticated admin to req.admin. Never trusts a client
// claim of elevated permissions without a verified token.
const protectAdmin = catchAsync(async (req, res, next) => {
  let token;
  if (req.cookies && req.cookies.adminToken) {
    token = req.cookies.adminToken;
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new AppError('You are not logged in. Please log in to continue.', 401));
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return next(new AppError('Invalid or expired session. Please log in again.', 401));
  }

  const admin = await Admin.findById(decoded.id);
  if (!admin || !admin.isActive || admin.status !== 'approved') {
    return next(new AppError('This account no longer has access.', 401));
  }

  req.admin = admin;
  next();
});

// Role-based authorization: restrictTo('superadmin', 'manager')
function restrictTo(...roles) {
  return (req, res, next) => {
    if (!req.admin || !roles.includes(req.admin.role)) {
      return next(new AppError('You do not have permission to perform this action.', 403));
    }
    next();
  };
}

module.exports = { protectAdmin, restrictTo };
