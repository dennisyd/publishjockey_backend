/**
 * SECURITY MIDDLEWARE - CSP IMPLEMENTATION
 *
 * 🚨 IMPORTANT: If CSP breaks anything, rollback immediately:
 * 1. Change reportOnly: true to reportOnly: false (line 129)
 * 2. Uncomment the unsafe-inline and unsafe-eval directives (lines 88-89, 96)
 * 3. Remove the nonce-based CSP section (lines 75-132)
 * 4. Restart the server
 *
 * This implementation starts in REPORT-ONLY mode to monitor violations
 * without blocking legitimate functionality.
 *
 * Yancy Dennis - Enhanced CSP Implementation
 */

const helmet = require('helmet');
const cors = require('cors');
const config = require('../config/config');
const rateLimiting = require('./rateLimiting');
const { sanitizeInput } = require('./validation');
const SecurityMonitor = require('../services/securityMonitor');
const crypto = require('crypto');
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

// CSP Configuration - Easy rollback mechanism
const CSP_CONFIG = {
  ENABLED: process.env.CSP_ENABLED !== 'false', // Default to enabled, set to 'false' to disable
  REPORT_ONLY: process.env.CSP_REPORT_ONLY !== 'false', // Default to report-only, set to 'false' to enforce
  LOG_VIOLATIONS: process.env.CSP_LOG_VIOLATIONS === 'true' // Default to false, set to 'true' for debugging
};

// 🚨 IMPORTANT: If CSP breaks anything, rollback immediately:
// 1. Set CSP_ENABLED=false in Render Environment Variables
// 2. Restart the backend service
// 3. All CSP restrictions removed, old behavior restored

// Security middleware configuration
const securityMiddleware = [
  // General rate limiting (applied to all routes)
  rateLimiting.general,
  
  // Input sanitization (protect against NoSQL injection) - EXCLUDE project routes
  (req, res, next) => {
    // Skip MongoDB sanitization for project routes to preserve content
    if (req.path.startsWith('/api/projects')) {
      return next();
    }
    sanitizeInput(req, res, next);
  },
  
  // Simple XSS protection (safer than DOM-based sanitization) - EXCLUDE project routes
  (req, res, next) => {
    // Skip sanitization for project routes to preserve markdown content
    if (req.path.startsWith('/api/projects')) {
      return next();
    }
    simpleSanitizerMiddleware(req, res, next);
  },
  
  // Basic security headers
  helmet(),
  
  // CSP violation reporting endpoint - only active when CSP is enabled
  (req, res, next) => {
    if (req.path === '/api/csp-violation' && CSP_CONFIG.ENABLED) {
      try {
        const violation = req.body;

        if (CSP_CONFIG.LOG_VIOLATIONS) {
          console.log('🔒 CSP VIOLATION DETECTED:', {
            blockedUri: violation['csp-report']?.blockedUri,
            violatedDirective: violation['csp-report']?.violatedDirective,
            documentUri: violation['csp-report']?.documentUri,
            sourceFile: violation['csp-report']?.sourceFile,
            timestamp: new Date().toISOString()
          });
        }

        // Log to security monitor (non-blocking)
        const securityMonitor = new SecurityMonitor();
        securityMonitor.logCspViolation(violation, req);

        // Always return 204 (success) for CSP reports
        return res.status(204).end();
      } catch (error) {
        console.error('Error handling CSP violation:', error);
        return res.status(204).end(); // Still return success to avoid breaking CSP
      }
    }
    next();
  },

  // Enhanced Content Security Policy - CONDITIONAL IMPLEMENTATION
  (req, res, next) => {
    if (!CSP_CONFIG.ENABLED) {
      console.log('🔒 CSP: Disabled - skipping CSP middleware');
      return next();
    }

    // Generate nonce for this request
    const nonce = crypto.randomBytes(16).toString('base64');
    req.cspNonce = nonce;

    // Create CSP with nonce support
    helmet.contentSecurityPolicy({
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          `'nonce-${nonce}'`, // Allow scripts with this nonce
          // Keep unsafe-inline for now - will monitor violations first
          "'unsafe-inline'", // TODO: Remove after monitoring period
          "'unsafe-eval'" // TODO: Remove after monitoring period
        ],
        styleSrc: [
          "'self'",
          `'nonce-${nonce}'`, // Allow styles with this nonce
          "https://fonts.googleapis.com", // Keep for Google Fonts
          // Keep unsafe-inline for now - will monitor violations first
          "'unsafe-inline'", // TODO: Remove after monitoring period
        ],
        imgSrc: [
          "'self'",
          "data:",
          "blob:",
          "https://res.cloudinary.com",
          "https://*.cloudinary.com",
          "https://images.unsplash.com"
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
          "https://fonts.gstatic.com"
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
      reportOnly: CSP_CONFIG.REPORT_ONLY, // ✅ CONFIGURABLE: Start in report-only mode
      reportUri: '/api/csp-violation' // CSP violation reporting endpoint
    })(req, res, next);
  },
  
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