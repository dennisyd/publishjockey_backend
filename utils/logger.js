const isDevelopment = process.env.NODE_ENV !== 'production';
const isTest = process.env.NODE_ENV === 'test';

/**
 * Secure logging utility that prevents sensitive data exposure in production
 */
class Logger {
  /**
   * Debug logging - only in development
   */
  static debug(...args) {
    if (isDevelopment && !isTest) {
      console.log('[DEBUG]', ...args);
    }
  }

  /**
   * Info logging - always enabled but sanitized in production
   */
  static info(...args) {
    if (isDevelopment || isTest) {
      console.log('[INFO]', ...args);
    } else {
      // In production, log without sensitive details
      const sanitizedArgs = args.map(arg => this.sanitizeForProduction(arg));
      console.log('[INFO]', ...sanitizedArgs);
    }
  }

  /**
   * Warning logging - always enabled
   */
  static warn(...args) {
    console.warn('[WARN]', ...args);
  }

  /**
   * Error logging - always enabled
   */
  static error(...args) {
    console.error('[ERROR]', ...args);
  }

  /**
   * Security-focused logging for authentication events
   */
  static security(event, details = {}) {
    const timestamp = new Date().toISOString();
    
    if (isDevelopment) {
      console.log(`[SECURITY] ${timestamp} - ${event}:`, details);
    } else {
      // In production, log security events but sanitize sensitive data
      const sanitizedDetails = {
        userId: details.userId ? this.maskId(details.userId) : undefined,
        email: details.email ? this.maskEmail(details.email) : undefined,
        ip: details.ip || 'unknown',
        userAgent: details.userAgent ? details.userAgent.substring(0, 50) + '...' : undefined,
        success: details.success,
        reason: details.reason
      };
      
      console.log(`[SECURITY] ${timestamp} - ${event}:`, sanitizedDetails);
    }
  }

  /**
   * Sanitize data for production logging
   */
  static sanitizeForProduction(data) {
    if (typeof data === 'string') {
      return data;
    }
    
    if (typeof data === 'object' && data !== null) {
      const sanitized = { ...data };
      
      // Remove or mask sensitive fields
      const sensitiveFields = [
        'password', 'token', 'secret', 'key', 'authorization',
        'email', 'phone', 'ssn', 'creditCard', 'bankAccount'
      ];
      
      sensitiveFields.forEach(field => {
        if (sanitized[field]) {
          if (field === 'email') {
            sanitized[field] = this.maskEmail(sanitized[field]);
          } else if (field === 'token') {
            sanitized[field] = this.maskToken(sanitized[field]);
          } else {
            sanitized[field] = '[REDACTED]';
          }
        }
      });
      
      return sanitized;
    }
    
    return data;
  }

  /**
   * Mask email addresses for production logging
   */
  static maskEmail(email) {
    if (!email || typeof email !== 'string') return '[REDACTED]';
    const [local, domain] = email.split('@');
    if (!domain) return '[REDACTED]';
    return `${local.charAt(0)}***@${domain}`;
  }

  /**
   * Mask tokens for production logging
   */
  static maskToken(token) {
    if (!token || typeof token !== 'string') return '[REDACTED]';
    if (token.length < 10) return '[REDACTED]';
    return `${token.substring(0, 4)}...${token.substring(token.length - 4)}`;
  }

  /**
   * Mask user IDs for production logging
   */
  static maskId(id) {
    if (!id || typeof id !== 'string') return '[REDACTED]';
    if (id === 'anonymous') return 'anonymous';
    if (id.length < 8) return '[REDACTED]';
    return `${id.substring(0, 4)}...${id.substring(id.length - 4)}`;
  }

  /**
   * Request logging middleware
   */
  static requestMiddleware() {
    return (req, res, next) => {
      const start = Date.now();
      const timestamp = new Date().toISOString();
      
      // Log request start (minimal info in production)
      if (isDevelopment) {
        console.log(`[${timestamp}] ${req.method} ${req.url} - Started`);
      }
      
      // Log response when finished
      res.on('finish', () => {
        const duration = Date.now() - start;
        const logData = {
          method: req.method,
          url: req.url,
          status: res.statusCode,
          duration: `${duration}ms`,
          ip: req.ip || req.connection.remoteAddress,
          userAgent: isDevelopment ? req.get('User-Agent') : undefined
        };
        
        if (res.statusCode >= 400) {
          Logger.warn('Request failed:', logData);
        } else if (isDevelopment) {
          Logger.debug('Request completed:', logData);
        }
      });
      
      next();
    };
  }
}

module.exports = Logger;
