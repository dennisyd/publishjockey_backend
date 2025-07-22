const helmet = require('helmet');
const cors = require('cors');
const config = require('../config/config');

// CORS configuration
const corsOptions = {
  origin: config.cors.origin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 600 // Cache preflight requests for 10 minutes
};

// Security middleware configuration
const securityMiddleware = [
  // Basic security headers
  helmet(),
  
  // Content Security Policy
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  }),
  
  // Prevent clickjacking
  helmet.frameguard({ action: 'deny' }),
  
  // XSS protection
  helmet.xssFilter(),
  
  // Prevent MIME type sniffing
  helmet.noSniff(),
  
  // Disable caching for sensitive routes
  (req, res, next) => {
    if (req.path.startsWith('/api/auth')) {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      res.set('Surrogate-Control', 'no-store');
    }
    next();
  },
  
  // CORS
  cors(corsOptions)
];

module.exports = securityMiddleware; 