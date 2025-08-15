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

// Middleware to generate CSRF token
const generateCsrfToken = (req, res, next) => {
  try {
    const token = csrfProtection.generateToken(req, res);
    res.locals.csrfToken = token;
    next();
  } catch (error) {
    console.error('CSRF token generation error:', error);
    res.status(500).json({ error: 'Failed to generate CSRF token' });
  }
};

// Middleware to validate CSRF token
const validateCsrfToken = (req, res, next) => {
  try {
    csrfProtection.validateRequest(req, res);
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
