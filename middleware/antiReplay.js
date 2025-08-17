/**
 * Anti-Replay Protection Middleware
 * Prevents replay attacks by validating nonces and timestamps
 */

const { v4: uuidv4 } = require('uuid');

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
    console.warn('Missing nonce or timestamp:', {
      ip: req.ip,
      method: req.method,
      url: req.url,
      hasNonce: !!nonce,
      hasTimestamp: !!timestamp,
      userAgent: req.headers['user-agent']
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
  
  // More lenient time window for file uploads (10 minutes instead of 5)
  const timeWindow = req.url.includes('split-document') ? 10 * 60 * 1000 : 5 * 60 * 1000;
  
  // Reject requests older than time window
  if (now - requestTime > timeWindow) {
    console.warn('Request too old:', {
      ip: req.ip,
      requestTime: new Date(requestTime).toISOString(),
      currentTime: new Date(now).toISOString(),
      ageMinutes: Math.round((now - requestTime) / (60 * 1000)),
      method: req.method,
      url: req.url,
      timeWindow: timeWindow / (60 * 1000)
    });
    
    return res.status(400).json({ 
      error: 'Request too old',
      message: `Request timestamp is more than ${timeWindow / (60 * 1000)} minutes old`
    });
  }
  
  // Reject requests from the future (clock skew tolerance: 60 seconds for better compatibility)
  if (requestTime > now + 60 * 1000) {
    console.warn('Request from future:', {
      ip: req.ip,
      requestTime: new Date(requestTime).toISOString(),
      currentTime: new Date(now).toISOString(),
      method: req.method,
      url: req.url,
      skew: requestTime - now
    });
    
    return res.status(400).json({ 
      error: 'Invalid timestamp',
      message: 'Request timestamp is in the future'
    });
  }
  
  // Enhanced debugging for UUID validation
  console.log('UUID validation - checking:', {
    nonce: nonce.substring(0, 8) + '...',
    nonceLength: nonce.length,
    isUUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(nonce),
    alreadyExists: nonceStore.has(nonce),
    storeSize: nonceStore.size,
    method: req.method,
    url: req.url,
    timestamp: new Date(requestTime).toISOString(),
    currentTime: new Date(now).toISOString(),
    ip: req.ip
  });
  
  // Check if nonce was already used
  if (nonceStore.has(nonce)) {
    // Get the stored data for this nonce
    const storedData = nonceStore.get(nonce);
    const storedTimestamp = typeof storedData === 'object' ? storedData.timestamp : storedData;
    const storedUrl = typeof storedData === 'object' ? storedData.url : 'unknown';
    const storedMethod = typeof storedData === 'object' ? storedData.method : 'unknown';
    
    console.warn('Duplicate UUID detected - this should not happen with proper UUIDs:', {
      ip: req.ip,
      nonce: nonce.substring(0, 8) + '...',
      currentRequest: {
        time: new Date(requestTime).toISOString(),
        method: req.method,
        url: req.url
      },
      originalRequest: {
        time: new Date(storedTimestamp).toISOString(),
        method: storedMethod,
        url: storedUrl
      },
      timeDifference: Math.abs(requestTime - storedTimestamp),
      storeSize: nonceStore.size
    });
    
    // Log all stored nonces for debugging
    console.log('All stored nonces:', Array.from(nonceStore.entries()).map(([key, value]) => ({
      nonce: key.substring(0, 8) + '...',
      timestamp: typeof value === 'object' ? new Date(value.timestamp).toISOString() : new Date(value).toISOString(),
      method: typeof value === 'object' ? value.method : 'unknown',
      url: typeof value === 'object' ? value.url : 'unknown'
    })));
    
    return res.status(400).json({ 
      error: 'Duplicate request',
      message: 'Nonce has already been used. Please retry your request.',
      details: process.env.NODE_ENV === 'development' ? {
        nonce: nonce.substring(0, 8) + '...',
        timeSinceOriginal: Math.abs(now - storedTimestamp)
      } : undefined
    });
  }
  
  // Store nonce with metadata
  nonceStore.set(nonce, {
    timestamp: now,
    method: req.method,
    url: req.url,
    ip: req.ip
  });
  
  console.log('UUID stored successfully:', {
    nonce: nonce.substring(0, 8) + '...',
    storeSize: nonceStore.size,
    method: req.method,
    url: req.url
  });
  
  // Log successful validation (debug only)
  if (process.env.NODE_ENV === 'development') {
    console.log('UUID validated successfully:', {
      nonce: nonce.substring(0, 8) + '...',
      timestamp: new Date(requestTime).toISOString(),
      method: req.method,
      url: req.url,
      storeSize: nonceStore.size
    });
  }
  
  next();
};

/**
 * Generate a UUID for nonce
 */
const generateNonce = () => {
  return uuidv4();
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
