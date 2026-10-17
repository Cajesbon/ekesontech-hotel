const AuditLog = require('../models/AuditLog');

// Best-effort audit logging — never let a logging failure break the
// actual admin action that triggered it.
async function logAction(req, { action, targetModel, targetId, details }) {
  try {
    await AuditLog.create({
      admin: req.admin ? req.admin._id : undefined,
      adminName: req.admin ? req.admin.name : 'system',
      action,
      targetModel,
      targetId,
      details,
      ipAddress: req.ip
    });
  } catch (err) {
    console.error('Failed to write audit log:', err.message);
  }
}

module.exports = { logAction };
