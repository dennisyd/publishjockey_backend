const AuditLogService = require('../services/auditLogService');

/**
 * Middleware to log actions to audit log
 * @param {string} action - The action to log
 * @param {Function} [detailsExtractor] - Optional function to extract details from request/response
 */
const auditLog = (action, detailsExtractor = null) => {
  return async (req, res, next) => {
    // Store original end function
    const originalEnd = res.end;

    // Override end function to capture response
    res.end = function (chunk, encoding) {
      // Restore original end
      res.end = originalEnd;

      // Get response body if it exists
      let responseBody;
      if (chunk) {
        try {
          responseBody = JSON.parse(chunk.toString());
        } catch (e) {
          responseBody = chunk.toString();
        }
      }

      // Determine status
      const status = res.statusCode >= 200 && res.statusCode < 400 ? 'SUCCESS' : 'FAILURE';

      // Extract details if extractor provided
      const details = detailsExtractor ? detailsExtractor(req, responseBody) : {};

      // Add request details
      details.requestBody = req.body;
      details.responseStatus = res.statusCode;

      // Log the action
      AuditLogService.log({
        userId: req.user?.userId,
        action,
        details,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        status
      });

      // Call original end
      return originalEnd.call(this, chunk, encoding);
    };

    next();
  };
};

module.exports = auditLog; 