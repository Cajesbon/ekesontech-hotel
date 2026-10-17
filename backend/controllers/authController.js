const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');
const { logAction } = require('../utils/audit');

function signToken(id) {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d'
  });
}

function sendTokenResponse(admin, statusCode, res) {
  const token = signToken(admin._id);

  res.cookie('adminToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  });

  res.status(statusCode).json({
    success: true,
    token,
    admin: {
      id: admin._id,
      name: admin.name,
      email: admin.email,
      role: admin.role
    }
  });
}

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return next(new AppError('Please provide email and password.', 400));
  }

  const admin = await Admin.findOne({ email: email.toLowerCase() }).select('+password');
  if (!admin || !(await admin.comparePassword(password))) {
    return next(new AppError('Incorrect email or password.', 401));
  }

  if (admin.status === 'pending') {
    return next(new AppError('Your account is awaiting approval from a super admin. You will be able to log in once approved.', 403));
  }
  if (admin.status === 'rejected') {
    return next(new AppError('Your access request was not approved. Please contact a super admin for help.', 403));
  }
  if (!admin.isActive) {
    return next(new AppError('This account has been suspended. Please contact a super admin.', 403));
  }

  admin.lastLoginAt = new Date();
  await admin.save({ validateBeforeSave: false });

  await logAction(req, { action: 'admin_login', targetModel: 'Admin', targetId: admin._id });

  sendTokenResponse(admin, 200, res);
});

exports.logout = (req, res) => {
  res.clearCookie('adminToken');
  res.status(200).json({ success: true, message: 'Logged out successfully.' });
};

exports.getMe = catchAsync(async (req, res) => {
  res.status(200).json({ success: true, admin: req.admin });
});

// Public self-registration for staff/receptionist/manager accounts. The
// account is created as 'pending' and cannot log in until a superadmin
// approves it — see login() above and the approve/reject endpoints below.
exports.signup = catchAsync(async (req, res, next) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) {
    return next(new AppError('Name, email, and password are required.', 400));
  }
  const requestedRole = ['manager', 'staff'].includes(role) ? role : 'staff';

  const admin = await Admin.create({
    name,
    email: email.toLowerCase(),
    password,
    role: requestedRole,
    status: 'pending'
  });

  await logAction(req, { action: 'admin_signup_requested', targetModel: 'Admin', targetId: admin._id, details: { email: admin.email, role: admin.role } });

  res.status(201).json({
    success: true,
    message: 'Your request has been submitted. A super admin will review and approve your account before you can log in.'
  });
});

// Allows a superadmin to create an already-approved admin account directly,
// bypassing the request/approval flow.
exports.createAdmin = catchAsync(async (req, res, next) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) {
    return next(new AppError('Name, email, and password are required.', 400));
  }
  const admin = await Admin.create({
    name,
    email,
    password,
    role: role || 'staff',
    status: 'approved',
    approvedBy: req.admin._id,
    approvedAt: new Date()
  });
  await logAction(req, { action: 'admin_created', targetModel: 'Admin', targetId: admin._id });
  res.status(201).json({
    success: true,
    admin: { id: admin._id, name: admin.name, email: admin.email, role: admin.role }
  });
});

exports.updatePassword = catchAsync(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;
  const admin = await Admin.findById(req.admin._id).select('+password');
  if (!(await admin.comparePassword(currentPassword))) {
    return next(new AppError('Current password is incorrect.', 401));
  }
  admin.password = newPassword;
  await admin.save();
  await logAction(req, { action: 'admin_password_changed', targetModel: 'Admin', targetId: admin._id });
  sendTokenResponse(admin, 200, res);
});

// ---------- Superadmin: staff account management ----------

exports.getPendingAdmins = catchAsync(async (req, res) => {
  const pending = await Admin.find({ status: 'pending' }).sort({ createdAt: -1 });
  res.status(200).json({ success: true, admins: pending });
});

exports.getAllAdmins = catchAsync(async (req, res) => {
  const admins = await Admin.find().sort({ createdAt: -1 });
  res.status(200).json({ success: true, admins });
});

exports.approveAdmin = catchAsync(async (req, res, next) => {
  const admin = await Admin.findById(req.params.id);
  if (!admin) return next(new AppError('Account not found.', 404));
  if (admin.status === 'approved') return next(new AppError('This account is already approved.', 400));

  admin.status = 'approved';
  admin.isActive = true;
  admin.approvedBy = req.admin._id;
  admin.approvedAt = new Date();
  await admin.save();

  await logAction(req, { action: 'admin_account_approved', targetModel: 'Admin', targetId: admin._id, details: { email: admin.email } });
  res.status(200).json({ success: true, admin });
});

exports.rejectAdmin = catchAsync(async (req, res, next) => {
  const admin = await Admin.findById(req.params.id);
  if (!admin) return next(new AppError('Account not found.', 404));

  admin.status = 'rejected';
  admin.isActive = false;
  await admin.save();

  await logAction(req, { action: 'admin_account_rejected', targetModel: 'Admin', targetId: admin._id, details: { email: admin.email } });
  res.status(200).json({ success: true, admin });
});

// PATCH /:id/active { isActive: true|false } — suspend or reactivate an
// already-approved staff account.
exports.setAdminActive = catchAsync(async (req, res, next) => {
  const { isActive } = req.body;
  if (String(req.params.id) === String(req.admin._id)) {
    return next(new AppError('You cannot change your own active status.', 400));
  }
  const admin = await Admin.findById(req.params.id);
  if (!admin) return next(new AppError('Account not found.', 404));

  admin.isActive = Boolean(isActive);
  await admin.save();

  await logAction(req, { action: 'admin_active_status_changed', targetModel: 'Admin', targetId: admin._id, details: { isActive: admin.isActive } });
  res.status(200).json({ success: true, admin });
});

// PATCH /:id/role { role }
exports.updateAdminRole = catchAsync(async (req, res, next) => {
  const { role } = req.body;
  if (!['superadmin', 'manager', 'staff'].includes(role)) {
    return next(new AppError('Invalid role.', 400));
  }
  if (String(req.params.id) === String(req.admin._id)) {
    return next(new AppError('You cannot change your own role.', 400));
  }
  const admin = await Admin.findById(req.params.id);
  if (!admin) return next(new AppError('Account not found.', 404));

  admin.role = role;
  await admin.save();

  await logAction(req, { action: 'admin_role_changed', targetModel: 'Admin', targetId: admin._id, details: { role } });
  res.status(200).json({ success: true, admin });
});

exports.deleteAdminAccount = catchAsync(async (req, res, next) => {
  if (String(req.params.id) === String(req.admin._id)) {
    return next(new AppError('You cannot delete your own account.', 400));
  }
  const target = await Admin.findById(req.params.id);
  if (!target) return next(new AppError('Account not found.', 404));

  if (target.role === 'superadmin') {
    const superadminCount = await Admin.countDocuments({ role: 'superadmin' });
    if (superadminCount <= 1) {
      return next(new AppError('Cannot delete the last remaining super admin account.', 400));
    }
  }

  await Admin.findByIdAndDelete(req.params.id);
  await logAction(req, { action: 'admin_account_deleted', targetModel: 'Admin', targetId: req.params.id, details: { email: target.email } });
  res.status(200).json({ success: true, message: 'Account deleted.' });
});
