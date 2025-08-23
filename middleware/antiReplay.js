/**
 * Anti-Replay Protection Middleware
 * Prevents replay attacks by validating nonces and timestamps
 */

// Use a more compatible UUID generation approach
const crypto = require('crypto');

// In-memory store for used nonces (in production, use Redis)
const nonceStore = new Map();

// Clean up expired nonces every 10 minutes
setInterval(() => {
  const now = Date.now();
  let cleanedCount = 0;
  for (const [key, data] of nonceStore.entries()) {
    // Store objects with timestamp and metadata
    const timestamp = typeof data === 'object' ? data.timestamp : data;
    if (now - timestamp > 10 * 60 * 1000) { // 10 minutes
      nonceStore.delete(key);
      cleanedCount++;
    }
  }
  if (cleanedCount > 0) {
    console.log(`Cleaned up ${cleanedCount} expired nonces. Store size: ${nonceStore.size}`);
  }
}, 10 * 60 * 1000);

/**
 * Validate nonce and timestamp to prevent replay attacks
 */
const validateNonce = (req, res, next) => {
  const nonce = req.headers['x-nonce'];
  const timestamp = req.headers['x-timestamp'];
  
  // Skip validation for GET requests and specific endpoints
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }
  
  // Skip for health checks and CSRF token
  if (req.url === '/health' || req.url === '/api/health' || req.url.includes('/csrf-token')) {
    return next();
  }
  
  // Check if nonce and timestamp are provided
  if (!nonce || !timestamp) {
    return res.status(400).json({ 
      error: 'Missing security headers',
      message: 'Request must include x-nonce and x-timestamp headers'
    });
  }
  
  const now = Date.now();
  const requestTime = parseInt(timestamp);
  
  // Validate timestamp format
  if (isNaN(requestTime)) {
    return res.status(400).json({ 
      error: 'Invalid timestamp',
      message: 'Timestamp must be a valid number'
    });
  }
  
  // More lenient time window for file uploads (10 minutes instead of 5)
  const timeWindow = req.url.includes('split-document') ? 10 * 60 * 1000 : 5 * 60 * 1000;
  
  // Reject requests older than time window
  if (now - requestTime > timeWindow) {
    return res.status(400).json({ 
      error: 'Request too old',
      message: `Request timestamp is more than ${timeWindow / (60 * 1000)} minutes old`
    });
  }
  
  // Reject requests from the future (clock skew tolerance: 60 seconds for better compatibility)
  if (requestTime > now + 60 * 1000) {
    return res.status(400).json({ 
      error: 'Invalid timestamp',
      message: 'Request timestamp is in the future'
    });
  }
  

  
  // Check if nonce was already used
  if (nonceStore.has(nonce)) {
    return res.status(400).json({ 
      error: 'Duplicate request',
      message: 'Nonce has already been used. Please retry your request.'
    });
  }
  
  // Store nonce with metadata
  nonceStore.set(nonce, {
    timestamp: now,
    method: req.method,
    url: req.url,
    ip: req.ip
  });
  
  next();
};

/**
 * Generate a UUID for nonce using crypto
 */
const generateNonce = () => {
  // Generate a UUID v4 using crypto
  const bytes = crypto.randomBytes(16);
  
  // Set version (4) and variant bits
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10
  
  // Convert to hex string
  const hex = bytes.toString('hex');
  
  // Format as UUID
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32)
  ].join('-');
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
  getTimestamp,
  // Add a function to manually clear the store for testing
  clearNonceStore: () => {
    const size = nonceStore.size;
    nonceStore.clear();
    console.log(`Manually cleared nonce store. Previous size: ${size}`);
    return size;
  },
  // Add function to get store stats for debugging
  getNonceStoreStats: () => {
    return {
      storeSize: nonceStore.size,
      oldestNonce: Math.min(...Array.from(nonceStore.values()).map(v => 
        typeof v === 'object' ? v.timestamp : v
      )),
      newestNonce: Math.max(...Array.from(nonceStore.values()).map(v => 
        typeof v === 'object' ? v.timestamp : v
      ))
    };
  }
};
