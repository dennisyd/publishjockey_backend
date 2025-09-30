const Logger = require('../utils/logger');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');

// Create rate limiter at module initialization (not per request)
const projectRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // More generous limit for content operations
  message: {
    error: 'Too many project requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for GET requests (reading content)
    return req.method === 'GET';
  }
});

// Content-aware sanitization for project routes
// This middleware applies security measures while preserving content integrity
const projectRouteSecurity = (req, res, next) => {
  Logger.debug('Applying content-aware security for project route', { 
    path: req.path, 
    method: req.method 
  });

  // Apply mongo sanitization but preserve markdown content structure
  if (req.body && req.body.content) {
    // Store original content temporarily
    const originalContent = req.body.content;
    
    // Apply sanitization to the rest of the body
    const { content, ...otherFields } = req.body;
    req.body = { ...otherFields };
    mongoSanitize.sanitize(req.body);
    
    // Restore content but apply basic safety checks
    req.body.content = originalContent;
    
    // Basic content safety - remove script tags but preserve markdown
    if (typeof req.body.content === 'string') {
      req.body.content = req.body.content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    }
  } else {
    // For non-content requests, apply full sanitization
    mongoSanitize.sanitize(req.body);
    mongoSanitize.sanitize(req.query);
    mongoSanitize.sanitize(req.params);
  }

  // Apply the pre-created rate limiter
  projectRateLimit(req, res, (err) => {
    if (err) {
      Logger.security('Project route rate limit exceeded', { 
        ip: req.ip, 
        path: req.path,
        method: req.method 
      });
      return next(err);
    }

    Logger.debug('Content-aware security applied successfully', { 
      path: req.path,
      hasContent: !!(req.body && req.body.content)
    });
    
    next();
  });
};

module.exports = {
  projectRouteSecurity
};