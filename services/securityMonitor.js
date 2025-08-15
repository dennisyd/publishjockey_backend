const mongoose = require('mongoose');

// Security Event Schema
const SecurityEventSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['csp_violation', 'rate_limit_exceeded', 'suspicious_activity', 'authentication_failure', 'authorization_failure']
  },
  severity: {
    type: String,
    required: true,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'low'
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  requestId: String,
  userId: mongoose.Schema.Types.ObjectId,
  ip: String,
  userAgent: String,
  details: mongoose.Schema.Types.Mixed,
  resolved: {
    type: Boolean,
    default: false
  },
  resolvedAt: Date,
  resolvedBy: mongoose.Schema.Types.ObjectId
});

// Index for efficient querying
SecurityEventSchema.index({ type: 1, timestamp: -1 });
SecurityEventSchema.index({ severity: 1, timestamp: -1 });
SecurityEventSchema.index({ ip: 1, timestamp: -1 });

const SecurityEvent = mongoose.model('SecurityEvent', SecurityEventSchema);

class SecurityMonitor {
  constructor() {
    this.violationThresholds = {
      csp_violation: { count: 10, window: 3600000 }, // 10 violations per hour
      rate_limit_exceeded: { count: 5, window: 300000 }, // 5 violations per 5 minutes
      authentication_failure: { count: 3, window: 300000 } // 3 failures per 5 minutes
    };
  }

  // Log CSP violation
  async logCspViolation(violation, req) {
    try {
      const event = new SecurityEvent({
        type: 'csp_violation',
        severity: this.assessCspViolationSeverity(violation),
        requestId: req.id,
        userId: req.user?.userId,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        details: {
          documentUri: violation['csp-report']?.documentUri,
          blockedUri: violation['csp-report']?.blockedUri,
          violatedDirective: violation['csp-report']?.violatedDirective,
          sourceFile: violation['csp-report']?.sourceFile,
          lineNumber: violation['csp-report']?.lineNumber
        }
      });

      await event.save();
      
      // Check for threshold violations
      await this.checkViolationThresholds('csp_violation', req.ip);
      
      return event;
    } catch (error) {
      console.error('Error logging CSP violation:', error);
    }
  }

  // Log rate limit violation
  async logRateLimitViolation(req, limit) {
    try {
      const event = new SecurityEvent({
        type: 'rate_limit_exceeded',
        severity: 'medium',
        requestId: req.id,
        userId: req.user?.userId,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        details: {
          limit,
          path: req.path,
          method: req.method
        }
      });

      await event.save();
      await this.checkViolationThresholds('rate_limit_exceeded', req.ip);
      
      return event;
    } catch (error) {
      console.error('Error logging rate limit violation:', error);
    }
  }

  // Log authentication failure
  async logAuthFailure(req, details) {
    try {
      const event = new SecurityEvent({
        type: 'authentication_failure',
        severity: 'medium',
        requestId: req.id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        details
      });

      await event.save();
      await this.checkViolationThresholds('authentication_failure', req.ip);
      
      return event;
    } catch (error) {
      console.error('Error logging auth failure:', error);
    }
  }

  // Assess CSP violation severity
  assessCspViolationSeverity(violation) {
    const blockedUri = violation['csp-report']?.blockedUri;
    const violatedDirective = violation['csp-report']?.violatedDirective;

    // High severity for script injection attempts
    if (violatedDirective === 'script-src' && blockedUri) {
      return 'high';
    }

    // Medium severity for style injection
    if (violatedDirective === 'style-src' && blockedUri) {
      return 'medium';
    }

    // Low severity for image/font violations
    return 'low';
  }

  // Check violation thresholds and alert if exceeded
  async checkViolationThresholds(type, ip) {
    try {
      const threshold = this.violationThresholds[type];
      if (!threshold) return;

      const windowStart = new Date(Date.now() - threshold.window);
      
      const count = await SecurityEvent.countDocuments({
        type,
        ip,
        timestamp: { $gte: windowStart }
      });

      if (count >= threshold.count) {
        await this.alertThresholdExceeded(type, ip, count, threshold);
      }
    } catch (error) {
      console.error('Error checking violation thresholds:', error);
    }
  }

  // Alert on threshold exceeded
  async alertThresholdExceeded(type, ip, count, threshold) {
    console.error(`🚨 SECURITY ALERT: ${type} threshold exceeded`, {
      type,
      ip,
      count,
      threshold,
      timestamp: new Date().toISOString()
    });

    // In production, you might want to:
    // - Send email/SMS alerts
    // - Block IP temporarily
    // - Log to external monitoring service
    // - Create incident ticket
  }

  // Get security events for admin dashboard
  async getSecurityEvents(filters = {}, limit = 100) {
    try {
      const query = {};
      
      if (filters.type) query.type = filters.type;
      if (filters.severity) query.severity = filters.severity;
      if (filters.resolved !== undefined) query.resolved = filters.resolved;
      if (filters.ip) query.ip = filters.ip;
      
      if (filters.startDate || filters.endDate) {
        query.timestamp = {};
        if (filters.startDate) query.timestamp.$gte = new Date(filters.startDate);
        if (filters.endDate) query.timestamp.$lte = new Date(filters.endDate);
      }

      const events = await SecurityEvent.find(query)
        .sort({ timestamp: -1 })
        .limit(limit)
        .populate('userId', 'name email')
        .populate('resolvedBy', 'name email');

      return events;
    } catch (error) {
      console.error('Error fetching security events:', error);
      return [];
    }
  }

  // Get security statistics
  async getSecurityStats(days = 7) {
    try {
      const startDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
      
      const stats = await SecurityEvent.aggregate([
        {
          $match: {
            timestamp: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: {
              type: '$type',
              severity: '$severity'
            },
            count: { $sum: 1 }
          }
        }
      ]);

      const totalEvents = await SecurityEvent.countDocuments({
        timestamp: { $gte: startDate }
      });

      const unresolvedEvents = await SecurityEvent.countDocuments({
        timestamp: { $gte: startDate },
        resolved: false
      });

      return {
        totalEvents,
        unresolvedEvents,
        breakdown: stats,
        period: `${days} days`
      };
    } catch (error) {
      console.error('Error fetching security stats:', error);
      return { totalEvents: 0, unresolvedEvents: 0, breakdown: [], period: `${days} days` };
    }
  }

  // Resolve security event
  async resolveEvent(eventId, resolvedBy) {
    try {
      const event = await SecurityEvent.findByIdAndUpdate(
        eventId,
        {
          resolved: true,
          resolvedAt: new Date(),
          resolvedBy
        },
        { new: true }
      );

      return event;
    } catch (error) {
      console.error('Error resolving security event:', error);
      return null;
    }
  }
}

module.exports = {
  SecurityMonitor,
  SecurityEvent
};
