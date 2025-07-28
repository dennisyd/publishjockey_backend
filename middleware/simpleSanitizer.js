/**
 * Simple text sanitization to prevent XSS attacks
 * This approach removes/escapes dangerous content without DOM parsing
 */

// List of dangerous patterns to remove or escape
const DANGEROUS_PATTERNS = [
  /<script[^>]*>.*?<\/script>/gims,
  /<iframe[^>]*>.*?<\/iframe>/gims,
  /<object[^>]*>.*?<\/object>/gims,
  /<embed[^>]*>/gims,
  /<link[^>]*>/gims,
  /<meta[^>]*>/gims,
  /javascript:/gims,
  /vbscript:/gims,
  /data:text\/html/gims,
  /on\w+\s*=/gims, // Event handlers like onclick, onload, etc.
];

/**
 * Sanitize text content by removing dangerous patterns
 * @param {string} content - Raw content
 * @returns {string} - Sanitized content
 */
const sanitizeText = (content) => {
  if (typeof content !== 'string') {
    return content;
  }
  
  let sanitized = content;
  
  // Remove dangerous patterns
  DANGEROUS_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });
  
  // Escape remaining angle brackets to prevent HTML injection
  sanitized = sanitized
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  return sanitized;
};

/**
 * Recursively sanitize object properties
 * @param {any} obj - Object to sanitize
 * @returns {any} - Sanitized object
 */
const sanitizeObject = (obj) => {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'string') {
    return sanitizeText(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  if (typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }
  
  return obj;
};

/**
 * Express middleware to sanitize request body
 */
const simpleSanitizerMiddleware = (req, res, next) => {
  console.log(`🛡️ Sanitizer middleware hit: ${req.method} ${req.path}`);
  
  if (req.body) {
    try {
      // Log original content for debugging (only for title/content fields)
      if (req.body.title || req.body.content) {
        console.log('🚨 SANITIZING CONTENT:', {
          method: req.method,
          path: req.path,
          originalTitle: req.body.title,
          originalContent: req.body.content
        });
      }
      
      // Sanitize the request body
      req.body = sanitizeObject(req.body);
      
      // Log sanitized content
      if (req.body.title || req.body.content) {
        console.log('✅ AFTER SANITIZATION:', {
          sanitizedTitle: req.body.title,
          sanitizedContent: req.body.content
        });
      }
      
      next();
    } catch (error) {
      console.error('Sanitization error:', error);
      // If sanitization fails, continue without sanitizing (better than crashing)
      next();
    }
  } else {
    console.log(`🔹 No body to sanitize: ${req.method} ${req.path}`);
    next();
  }
};

module.exports = {
  sanitizeText,
  sanitizeObject,
  simpleSanitizerMiddleware
}; 