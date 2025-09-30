const AuditLog = require('../models/AuditLog');

class AuditLogService {
  /**
   * Create an audit log entry
   * @param {Object} params
   * @param {string} params.userId - The ID of the user performing the action
   * @param {string} params.action - The action being performed
   * @param {Object} params.details - Additional details about the action
   * @param {string} params.ipAddress - IP address of the request
   * @param {string} params.userAgent - User agent of the request
   * @param {string} params.status - Status of the action (SUCCESS/FAILURE)
   */
  static async log({
    userId,
    action,
    details,
    ipAddress,
    userAgent,
    status
  }) {
    try {
      await AuditLog.create({
        userId,
        action,
        details,
        ipAddress,
        userAgent,
        status
      });
    } catch (error) {
      // Log to console but don't throw - audit logging should not break the main flow
      console.error('Audit logging failed:', error);
    }
  }

  /**
   * Get audit logs with pagination and filtering
   * @param {Object} params
   * @param {string} [params.userId] - Filter by user ID
   * @param {string} [params.action] - Filter by action
   * @param {string} [params.status] - Filter by status
   * @param {Date} [params.startDate] - Filter by start date
   * @param {Date} [params.endDate] - Filter by end date
   * @param {number} [params.page=1] - Page number
   * @param {number} [params.limit=50] - Items per page
   */
  static async getLogs({
    userId,
    action,
    status,
    startDate,
    endDate,
    page = 1,
    limit = 50
  }) {
    const query = {};

    if (userId) query.userId = userId;
    if (action) query.action = action;
    if (status) query.status = status;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = startDate;
      if (endDate) query.createdAt.$lte = endDate;
    }

    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('userId', 'name email'),
      AuditLog.countDocuments(query)
    ]);

    return {
      logs,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get audit logs for a specific user
   * @param {string} userId - The user ID
   * @param {Object} options - Pagination and filtering options
   */
  static async getUserLogs(userId, options = {}) {
    return this.getLogs({ userId, ...options });
  }

  /**
   * Get audit logs for admin actions
   * @param {Object} options - Pagination and filtering options
   */
  static async getAdminLogs(options = {}) {
    return this.getLogs({ action: 'ADMIN_ACTION', ...options });
  }
}

module.exports = AuditLogService; 