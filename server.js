require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');

// Configure Mongoose to suppress deprecation warnings
mongoose.set('strictQuery', false);
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const splitDoctorRoutes = require('./routes/splitDoctorRoutes');
const testimonialRoutes = require('./routes/testimonialRoutes');
const config = require('./config/config');
const { errorHandler, notFound } = require('./middleware/error');
const { downloadFile } = require('./controllers/downloadController');
const { verifyToken, requireAdmin, verifyTokenStrict } = require('./middleware/auth');
const path = require('path');
const fs = require('fs');
const adminRoutes = require('./routes/adminRoutes');
const titleChangeRoutes = require('./routes/titleChangeRoutes');
const userRoutes = require('./routes/userRoutes');
const projectRoutes = require('./routes/projectRoutes');
const stripeRoutes = require('./routes/stripeRoutes');
const imageRoutes = require('./routes/imageRoutes');
const securityRoutes = require('./routes/securityRoutes');
const affiliateRoutes = require('./routes/affiliateRoutes');
const adminAffiliateRoutes = require('./routes/adminAffiliateRoutes');
const { validateNonce, clearNonceStore, getNonceStoreStats } = require('./middleware/antiReplay');
const { validateCsrfToken, generateCsrfToken } = require('./middleware/csrf');
const { trackReferralClick, trackReferralRegistration, trackReferralConversion } = require('./middleware/referralTracking');
const Logger = require('./utils/logger');
const { projectRouteSecurity } = require('./middleware/contentSecurity');

// Create Express app
const app = express();

// Add secure request logging middleware
app.use(Logger.requestMiddleware());

// Ensure Stripe webhook receives raw body for signature verification
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));

// Apply JSON parsing middleware for all routes except Stripe webhook
app.use((req, res, next) => {
  if (req.originalUrl === '/api/stripe/webhook') {
    return next();
  }
  return express.json({ limit: '50mb' })(req, res, next);
});

// Basic middleware
const allowedOrigins = [
  'https://publishjockey-frontend.vercel.app',
  'https://publishjockey.com',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:3001'
];
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'Stripe-Signature',
    'x-nonce',
    'x-timestamp', 
    'x-csrf-token',
    'Cache-Control',
    'Pragma',
    'Expires'
  ]
}));
app.use(cookieParser());
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// IMPORTANT: Add direct file access route BEFORE any other routes or middleware
// This ensures it won't be affected by authentication or other middleware
app.get('/public-files/:dir/:file', (req, res) => {
  try {
    const { dir, file } = req.params;
    Logger.debug('Direct file access request', { dir, file });
    
    // Security check - sanitize paths
    const sanitizedDir = dir.replace(/[^a-zA-Z0-9]/g, '');
    const sanitizedFile = file.replace(/[^a-zA-Z0-9_\-.]/g, '');
    
    const filePath = path.join(__dirname, 'temp', sanitizedDir, sanitizedFile);
    Logger.debug('Attempting to serve file from path', { filePath });
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error('File not found:', filePath);
      return res.status(404).send('File not found');
    }
    
    // Send file directly
    res.download(filePath);
  } catch (err) {
    console.error('Error serving file:', err);
    res.status(500).send('Error serving file');
  }
});

// Apply security middleware (rate limiting, input sanitization, security headers)
const { securityMiddleware } = require('./middleware/security');

// Apply security middleware with content-aware protection for project routes
app.use((req, res, next) => {
  if (req.path.startsWith('/api/projects')) {
    // Apply content-aware security for project routes
    return projectRouteSecurity(req, res, next);
  }
  // Apply full security middleware to all other routes
  securityMiddleware.forEach(middleware => middleware(req, res, () => {}));
  next();
});

Logger.info('🛡️ Security middleware enabled with content-aware protection for project routes');

// Health check route (exclude from anti-replay protection)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});

// API health check route for frontend
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'API server is running' });
});

// CSRF token endpoint (exclude from anti-replay protection)
app.get('/api/csrf-token', generateCsrfToken);

// Test endpoint to clear nonce store (development only)
if (process.env.NODE_ENV === 'development') {
  app.post('/api/clear-nonces', (req, res) => {
    const clearedCount = clearNonceStore();
    res.json({ 
      success: true, 
      message: `Cleared ${clearedCount} nonces from store`,
      timestamp: new Date().toISOString()
    });
  });
  
  // Also add a GET endpoint for easier testing
  app.get('/api/clear-nonces', (req, res) => {
    const clearedCount = clearNonceStore();
    res.json({ 
      success: true, 
      message: `Cleared ${clearedCount} nonces from store`,
      timestamp: new Date().toISOString()
    });
  });
  
  // Add endpoint to get nonce store statistics
  app.get('/api/nonce-stats', (req, res) => {
    const stats = getNonceStoreStats();
    res.json({ 
      success: true, 
      stats,
      timestamp: new Date().toISOString()
    });
  });
  
  // Add a simple test endpoint to verify UUID generation
  app.get('/api/test-uuid', (req, res) => {
    const { generateNonce } = require('./middleware/antiReplay');
    const testUuid = generateNonce();
    res.json({
      success: true,
      uuid: testUuid,
      isUUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(testUuid),
      timestamp: new Date().toISOString()
    });
  });
  
  // Add a test endpoint to generate multiple UUIDs and check uniqueness
  app.get('/api/test-uuid-uniqueness', (req, res) => {
    const { generateNonce } = require('./middleware/antiReplay');
    const uuids = [];
    const uuidSet = new Set();
    
    for (let i = 0; i < 10; i++) {
      const uuid = generateNonce();
      uuids.push(uuid);
      uuidSet.add(uuid);
    }
    
    res.json({
      success: true,
      uuids: uuids.map(uuid => uuid.substring(0, 8) + '...'),
      uniqueCount: uuidSet.size,
      totalCount: uuids.length,
      allUnique: uuidSet.size === uuids.length,
      timestamp: new Date().toISOString()
    });
  });
}

// Apply anti-replay protection to all routes EXCEPT auth routes, project routes, image routes, and admin routes
app.use((req, res, next) => {
  // Skip anti-replay protection for auth routes, project routes, image routes, admin routes, and testimonial routes
  if (req.path.startsWith('/api/auth/') || 
      req.path.startsWith('/api/projects') || 
      req.path.startsWith('/api/images') ||
      req.path.startsWith('/api/admin/') ||
      req.path.startsWith('/api/testimonials')) {
    return next();
  }
  validateNonce(req, res, next);
});
Logger.info('🛡️ Anti-replay protection enabled with content-aware handling for project routes');

// Apply CSRF protection to all state-changing operations
app.use((req, res, next) => {
  // Skip CSRF protection for GET, HEAD, OPTIONS requests
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  
  // Skip CSRF protection for auth routes (login, register, etc.)
  if (req.path.startsWith('/api/auth/')) {
    return next();
  }
  
  // Skip CSRF protection for project routes (temporarily)
  if (req.path.startsWith('/api/projects')) {
    return next();
  }
  
  // Skip CSRF protection for image routes (handled by Cloudinary)
  if (req.path.startsWith('/api/images/')) {
    return next();
  }
  
  // Skip CSRF protection for health check
  if (req.path === '/api/health') {
    return next();
  }
  
  // Skip CSRF protection for CSRF token endpoint
  if (req.path === '/api/csrf-token') {
    return next();
  }
  
  // Apply CSRF protection to all other state-changing operations
  validateCsrfToken(req, res, next);
});
Logger.info('🛡️ CSRF protection enabled for state-changing operations');

// Routes
Logger.info('🔗 Registering routes...');
app.use('/api', splitDoctorRoutes);
app.use('/api/testimonials', testimonialRoutes);

// Referral click tracking route
app.get('/api/referral/:affiliateCode', trackReferralClick, (req, res) => {
  // Redirect to the main site with the affiliate code
  const affiliateCode = req.params.affiliateCode;
  res.redirect(`/?ref=${affiliateCode}`);
});

app.use('/api/auth', trackReferralRegistration, authRoutes);
app.use('/api/admin', verifyTokenStrict, requireAdmin, adminRoutes);
app.use('/api/admin/title-changes', titleChangeRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/stripe', trackReferralConversion, stripeRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/affiliates', affiliateRoutes);
app.use('/api/admin', adminAffiliateRoutes);
Logger.info('✅ All routes registered');

// Add a specific route for file downloads to make absolutely sure it's registered
app.get('/api/download', verifyToken, (req, res) => {
  Logger.debug('Download request received', { url: req.url, query: req.query });
  downloadFile(req, res);
});

// Add a special download route for SplitDoctor files (these are temporary anyway)
app.get('/api/document-download', (req, res) => {
  Logger.debug('Document download request received', { url: req.url, query: req.query });
  downloadFile(req, res);
});

// Add a completely public download route for document files
app.get('/api/public-download', (req, res) => {
  Logger.debug('Public download request received', { url: req.url, query: req.query });
  // Don't use any auth middleware
  downloadFile(req, res);
});

// Test route for debugging
app.get('/test', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    message: 'Test endpoint is working',
    env: {
      nodeEnv: config.nodeEnv,
      port: config.port,
      corsOrigins: config.cors.origin,
      hasJwtSecret: !!config.jwt.accessTokenSecret,
      hasRefreshSecret: !!config.jwt.refreshTokenSecret,
      hasMongoUri: !!config.db.uri
    }
  });
});

// Test auth route to verify routing
app.get('/api/auth/test', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    message: 'Auth routes are working',
    path: req.path,
    originalUrl: req.originalUrl
  });
});

// Test login route specifically
app.get('/api/auth/login', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    message: 'Login route is accessible',
    method: req.method,
    path: req.path
  });
});

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Connect to MongoDB and start server
const PORT = config.port;

const start = async () => {
  try {
    await mongoose.connect(config.db.uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    Logger.info('Connected to MongoDB');
    

    
    // Simple HTTP server without HTTPS
    app.listen(PORT, () => {
      Logger.info(`HTTP Server running in ${config.nodeEnv} mode on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    process.exit(1);
  }
};

start();

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  // Close server & exit process
  process.exit(1);
}); 