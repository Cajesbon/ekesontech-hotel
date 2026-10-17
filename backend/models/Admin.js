const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const adminSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 8, select: false },
    role: { type: String, enum: ['superadmin', 'manager', 'staff'], default: 'staff' },

    // Self-registered staff/manager accounts start as 'pending' and cannot log
    // in until a superadmin approves them (set explicitly in the signup
    // controller). Every other creation path (seed script, direct creation
    // by a superadmin, or any account that existed before this field was
    // added to the schema) defaults to 'approved' so existing accounts are
    // never accidentally locked out. 'rejected' accounts are kept for
    // record-keeping but can never log in.
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    approvedAt: { type: Date },

    // isActive lets a superadmin suspend an already-approved account
    // without deleting it or losing its history.
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date }
  },
  { timestamps: true }
);

adminSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

adminSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('Admin', adminSchema);
