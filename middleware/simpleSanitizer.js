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
  
  // Preserve HTML comments in image tags (for image scaling)
  const imageCommentRegex = /(<!--\s*scale:\s*[\d.]+?\s*-->)/g;
  const imageComments = [];
  let commentIndex = 0;
  
  // Temporarily replace image comments with placeholders
  sanitized = sanitized.replace(imageCommentRegex, (match) => {
    const placeholder = `__IMAGE_COMMENT_${commentIndex}__`;
    imageComments[commentIndex] = match;
    commentIndex++;
    return placeholder;
  });
  
  // Preserve markdown headers (# ## ### etc.)
  const markdownHeaderRegex = /^(#{1,6})\s+(.+)$/gm;
  const markdownHeaders = [];
  let headerIndex = 0;
  
  // Temporarily replace markdown headers with placeholders
  sanitized = sanitized.replace(markdownHeaderRegex, (match, hashes, text) => {
    const placeholder = `__MARKDOWN_HEADER_${headerIndex}__`;
    markdownHeaders[headerIndex] = { hashes, text };
    headerIndex++;
    return placeholder;
  });
  
  // Escape remaining angle brackets to prevent HTML injection
  sanitized = sanitized
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  // Restore markdown headers
  markdownHeaders.forEach((header, index) => {
    sanitized = sanitized.replace(`__MARKDOWN_HEADER_${index}__`, `${header.hashes} ${header.text}`);
  });
  
  // Restore image comments
  imageComments.forEach((comment, index) => {
    sanitized = sanitized.replace(`__IMAGE_COMMENT_${index}__`, comment);
  });
  
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
  if (req.body) {
    try {
      // Sanitize the request body
      req.body = sanitizeObject(req.body);
      next();
    } catch (error) {
      console.error('Sanitization error:', error);
      // If sanitization fails, continue without sanitizing (better than crashing)
      next();
    }
  } else {
    next();
  }
};

module.exports = {
  sanitizeText,
  sanitizeObject,
  simpleSanitizerMiddleware
}; 