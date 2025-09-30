const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

// Create DOMPurify instance for server-side use
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

/**
 * Sanitize HTML content to prevent XSS attacks
 * @param {string} content - Raw HTML content
 * @returns {string} - Sanitized HTML content
 */
const sanitizeHtml = (content) => {
  if (typeof content !== 'string') {
    return content;
  }
  
  // Configure DOMPurify for strict sanitization
  const config = {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote'],
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true,
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    RETURN_DOM_IMPORT: false
  };
  
  return DOMPurify.sanitize(content, config);
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
    return sanitizeHtml(obj);
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
const htmlSanitizerMiddleware = (req, res, next) => {
  if (req.body) {
    // Log original content for debugging
    if (req.body.title || req.body.content) {
      console.log('Sanitizing content:', {
        title: req.body.title,
        content: req.body.content?.substring(0, 100) + '...'
      });
    }
    
    // Sanitize the request body
    req.body = sanitizeObject(req.body);
    
    // Log sanitized content
    if (req.body.title || req.body.content) {
      console.log('After sanitization:', {
        title: req.body.title,
        content: req.body.content?.substring(0, 100) + '...'
      });
    }
  }
  
  next();
};

module.exports = {
  sanitizeHtml,
  sanitizeObject,
  htmlSanitizerMiddleware
}; 