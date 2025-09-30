const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  action: {
    type: String,
    required: true,
    enum: [
      'LOGIN', 'LOGOUT', 'REGISTER', 'PASSWORD_RESET',
      'VIEW_USERS', 'VIEW_USER_DETAILS', 'UPDATE_USER',
      'ADMIN_RESET_PASSWORD', 'IMPERSONATE_USER', 'EXPORT_USER_DATA',
      'SUSPEND_USER', 'UNSUSPEND_USER', 'CHANGE_USER_ROLE',
      'DELETE_USER', 'DELETE_BOOK', 'SEND_NOTIFICATION', 'BULK_SUSPEND',
      'BULK_UNSUSPEND', 'BULK_DELETE', 'BULK_CHANGEROLE',
      'VIEW_DASHBOARD_STATS'
    ]
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  targetUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  details: {
    type: mongoose.Schema.Types.Mixed
  },
  ipAddress: String,
  userAgent: String
});

// Index for faster queries
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ performedBy: 1, timestamp: -1 });
auditLogSchema.index({ targetUser: 1, timestamp: -1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog; 