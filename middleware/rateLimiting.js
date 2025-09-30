const rateLimit = require('express-rate-limit');

// General API rate limiting
const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 50, // Limit each IP to 50 requests per minute (increased for testing)
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: 1 * 60 // 1 minute in seconds
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Skip successful requests (2xx responses)
  skipSuccessfulRequests: false,
  // Skip failed requests (4xx and 5xx responses)
  skipFailedRequests: false,
});

// Strict rate limiting for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per windowMs
  message: {
    error: 'Too many authentication attempts, please try again later.',
    retryAfter: 15 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
});

// Moderate rate limiting for project operations
const projectLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 100, // Limit each IP to 100 project operations per 5 minutes
  message: {
    error: 'Too many project operations, please slow down.',
    retryAfter: 5 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiting for file uploads
const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 20, // Limit each IP to 20 uploads per 10 minutes
  message: {
    error: 'Too many upload attempts, please try again later.',
    retryAfter: 10 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Very strict rate limiting for password reset
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 password reset attempts per hour
  message: {
    error: 'Too many password reset attempts, please try again in an hour.',
    retryAfter: 60 * 60
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Export rate limiting middleware
module.exports = {
  general: generalLimiter,
  auth: authLimiter,
  project: projectLimiter,
  upload: uploadLimiter,
  passwordReset: passwordResetLimiter
}; 