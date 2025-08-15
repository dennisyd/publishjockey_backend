/**
 * Anti-Replay Protection Middleware
 * Prevents replay attacks by validating nonces and timestamps
 */

// In-memory store for used nonces (in production, use Redis)
const nonceStore = new Map();

// Clean up expired nonces every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of nonceStore.entries()) {
    if (now - timestamp > 10 * 60 * 1000) { // 10 minutes
      nonceStore.delete(key);
    }
  }
}, 10 * 60 * 1000);

/**
 * Validate nonce and timestamp to prevent replay attacks
 */
const validateNonce = (req, res, next) => {
  const nonce = req.headers['x-nonce'];
  const timestamp = req.headers['x-timestamp'];
  
  // Skip validation for GET requests
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }
  
  // Check if nonce and timestamp are provided
  if (!nonce || !timestamp) {
    console.warn('Missing nonce or timestamp:', {
      ip: req.ip,
      method: req.method,
      url: req.url,
      hasNonce: !!nonce,
      hasTimestamp: !!timestamp
    });
    
    return res.status(400).json({ 
      error: 'Missing security headers',
      message: 'Request must include x-nonce and x-timestamp headers'
    });
  }
  
  const now = Date.now();
  const requestTime = parseInt(timestamp);
  
  // Validate timestamp format
  if (isNaN(requestTime)) {
    console.warn('Invalid timestamp format:', {
      ip: req.ip,
      timestamp,
      method: req.method,
      url: req.url
    });
    
    return res.status(400).json({ 
      error: 'Invalid timestamp',
      message: 'Timestamp must be a valid number'
    });
  }
  
  // Reject requests older than 5 minutes
  if (now - requestTime > 5 * 60 * 1000) {
    console.warn('Request too old:', {
      ip: req.ip,
      requestTime: new Date(requestTime).toISOString(),
      currentTime: new Date(now).toISOString(),
      ageMinutes: Math.round((now - requestTime) / (60 * 1000)),
      method: req.method,
      url: req.url
    });
    
    return res.status(400).json({ 
      error: 'Request too old',
      message: 'Request timestamp is more than 5 minutes old'
    });
  }
  
  // Reject requests from the future (clock skew tolerance: 30 seconds)
  if (requestTime > now + 30 * 1000) {
    console.warn('Request from future:', {
      ip: req.ip,
      requestTime: new Date(requestTime).toISOString(),
      currentTime: new Date(now).toISOString(),
      method: req.method,
      url: req.url
    });
    
    return res.status(400).json({ 
      error: 'Invalid timestamp',
      message: 'Request timestamp is in the future'
    });
  }
  
  // Check if nonce was already used
  const nonceKey = `${nonce}:${timestamp}`;
  if (nonceStore.has(nonceKey)) {
    console.warn('Duplicate nonce detected:', {
      ip: req.ip,
      nonce: nonce.substring(0, 8) + '...',
      timestamp: new Date(requestTime).toISOString(),
      method: req.method,
      url: req.url
    });
    
    return res.status(400).json({ 
      error: 'Duplicate request',
      message: 'Nonce has already been used'
    });
  }
  
  // Store nonce with timestamp
  nonceStore.set(nonceKey, now);
  
  // Log successful validation (debug only)
  if (process.env.NODE_ENV === 'development') {
    console.log('Nonce validated successfully:', {
      nonce: nonce.substring(0, 8) + '...',
      timestamp: new Date(requestTime).toISOString(),
      method: req.method,
      url: req.url
    });
  }
  
  next();
};

/**
 * Generate a cryptographically secure nonce
 */
const generateNonce = () => {
  const crypto = require('crypto');
  return crypto.randomBytes(16).toString('hex');
};

/**
 * Get current timestamp
 */
const getTimestamp = () => {
  return Date.now().toString();
};

module.exports = {
  validateNonce,
  generateNonce,
  getTimestamp
};
