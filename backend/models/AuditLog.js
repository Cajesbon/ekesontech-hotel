const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    adminName: { type: String },
    action: { type: String, required: true },
    targetModel: { type: String },
    targetId: { type: mongoose.Schema.Types.ObjectId },
    details: { type: mongoose.Schema.Types.Mixed },
    ipAddress: { type: String }
  },
  { timestamps: true }
);

module.exports = mongoose.model('AuditLog', auditLogSchema);
