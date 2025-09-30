const { doubleCsrf } = require('csrf-csrf');

// CSRF protection configuration
const csrfProtection = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET || 'your-secret-key',
  cookieName: 'XSRF-TOKEN',
  cookieOptions: {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  },
  size: 64, // Token size in bytes
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'], // Methods that don't need CSRF protection
  getTokenFromRequest: (req) => req.headers['x-csrf-token'] || req.body._csrf
});

// Extract the middleware functions
const { generateToken, validateRequest } = csrfProtection;

// Middleware to generate CSRF token
const generateCsrfToken = (req, res, next) => {
  try {
    // Check if CSRF_SECRET is set
    const secret = process.env.CSRF_SECRET || 'your-secret-key';
    console.log('CSRF_SECRET is set:', !!process.env.CSRF_SECRET);
    
    // Generate a simple token using crypto
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    
    console.log('CSRF token generated successfully');
    
    // Set the token in a cookie for the csrf-csrf library
    res.cookie('XSRF-TOKEN', token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
    
    // Return the token in response body for frontend to store in sessionStorage
    res.json({ 
      csrfToken: token,
      message: 'CSRF token generated successfully'
    });
  } catch (error) {
    console.error('CSRF token generation error:', error);
    res.status(500).json({ error: 'Failed to generate CSRF token', details: error.message });
  }
};

// Middleware to validate CSRF token
const validateCsrfToken = (req, res, next) => {
  try {
    validateRequest(req, res);
    next();
  } catch (error) {
    console.error('CSRF validation error:', error);
    res.status(403).json({ 
      error: 'CSRF token validation failed',
      message: 'Invalid or missing CSRF token'
    });
  }
};

// Middleware to handle CSRF errors
const handleCsrfError = (error, req, res, next) => {
  if (error.code === 'EBADCSRFTOKEN') {
    console.error('CSRF attack detected:', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.url,
      method: req.method
    });
    
    return res.status(403).json({
      error: 'CSRF attack detected',
      message: 'Invalid CSRF token'
    });
  }
  next(error);
};

module.exports = {
  csrfProtection,
  generateCsrfToken,
  validateCsrfToken,
  handleCsrfError
};
