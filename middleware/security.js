const helmet = require('helmet');
const cors = require('cors');
const config = require('../config/config');
const rateLimiting = require('./rateLimiting');
const { sanitizeInput } = require('./validation');
// const { htmlSanitizerMiddleware } = require('./htmlSanitizer');
const { simpleSanitizerMiddleware } = require('./simpleSanitizer');

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
  // General rate limiting (applied to all routes)
  rateLimiting.general,
  
  // Input sanitization (protect against NoSQL injection)
  sanitizeInput,
  
  // Simple XSS protection (safer than DOM-based sanitization)
  simpleSanitizerMiddleware,
  
  // Basic security headers
  helmet(),
  
  // Enhanced Content Security Policy
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'", // TODO: Remove after migrating to nonce-based CSP
        "'unsafe-eval'" // Required for React development
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'", // TODO: Remove after migrating to nonce-based CSP
        "https://fonts.googleapis.com" // If using Google Fonts
      ],
      imgSrc: [
        "'self'",
        "data:",
        "blob:",
        "https://res.cloudinary.com",
        "https://*.cloudinary.com",
        "https://images.unsplash.com" // TODO: Remove after self-hosting demo images
      ],
      connectSrc: [
        "'self'",
        "https://api.cloudinary.com",
        "https://publishjockey-backend.onrender.com",
        "https://publishjockey-export.onrender.com",
        "https://publishjockey-frontend.vercel.app",
        "https://api.stripe.com",
        "https://checkout.stripe.com"
      ],
      fontSrc: [
        "'self'",
        "data:",
        "https://fonts.gstatic.com" // If using Google Fonts
      ],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      workerSrc: ["'self'"],
      manifestSrc: ["'self'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: []
    },
    reportOnly: false, // Set to true for testing
    reportUri: '/api/csp-violation' // CSP violation reporting endpoint
  }),
  
  // Prevent clickjacking
  helmet.frameguard({ action: 'deny' }),
  
  // XSS protection
  helmet.xssFilter(),
  
  // Prevent MIME type sniffing
  helmet.noSniff(),
  
  // Disable caching for sensitive routes
  (req, res, next) => {
    if (req.path.startsWith('/api/auth') && !res.headersSent) {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      res.set('Surrogate-Control', 'no-store');
    }
    next();
  },
  
  // Enhanced CORS with additional security
  cors({
    ...corsOptions,
    exposedHeaders: [
      'Content-Range', 
      'X-Content-Range',
      'X-Request-ID',
      'X-Response-Time'
    ]
  }),
  
  // Additional security headers
  (req, res, next) => {
    // Request ID for tracking
    req.id = req.headers['x-request-id'] || require('crypto').randomUUID();
    res.set('X-Request-ID', req.id);
    
    // Response time tracking
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      // Only set header if response hasn't been sent yet
      if (!res.headersSent) {
        res.set('X-Response-Time', `${duration}ms`);
      }
    });
    
    next();
  },
  
  // Security headers for all responses
  (req, res, next) => {
    // Only set headers if response hasn't been sent yet
    if (!res.headersSent) {
      // Prevent browsers from sniffing MIME types
      res.set('X-Content-Type-Options', 'nosniff');
      
      // Prevent clickjacking
      res.set('X-Frame-Options', 'DENY');
      
      // XSS protection
      res.set('X-XSS-Protection', '1; mode=block');
      
      // Strict referrer policy
      res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
      
      // Permissions policy
      res.set('Permissions-Policy', 
        'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()'
      );
      
      // Cache control for API routes
      if (req.path.startsWith('/api/')) {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
      }
    }
    
    next();
  }
];

module.exports = {
  securityMiddleware,
  rateLimiting
}; 