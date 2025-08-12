require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
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

// Create Express app
const app = express();

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

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
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Stripe-Signature']
}));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// IMPORTANT: Add direct file access route BEFORE any other routes or middleware
// This ensures it won't be affected by authentication or other middleware
app.get('/public-files/:dir/:file', (req, res) => {
  try {
    const { dir, file } = req.params;
    console.log('Direct file access request:', { dir, file });
    
    // Security check - sanitize paths
    const sanitizedDir = dir.replace(/[^a-zA-Z0-9]/g, '');
    const sanitizedFile = file.replace(/[^a-zA-Z0-9_\-.]/g, '');
    
    const filePath = path.join(__dirname, 'temp', sanitizedDir, sanitizedFile);
    console.log('Attempting to serve file from:', filePath);
    
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
app.use(securityMiddleware);
console.log('🛡️ Security middleware enabled');

// Routes
console.log('🔗 Registering routes...');
app.use('/api', splitDoctorRoutes);
app.use('/api/testimonials', testimonialRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', verifyTokenStrict, requireAdmin, adminRoutes);
app.use('/api/admin/title-changes', titleChangeRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/security', securityRoutes);
console.log('✅ All routes registered');

// Add a specific route for file downloads to make absolutely sure it's registered
app.get('/api/download', verifyToken, (req, res) => {
  console.log('Download request received:', req.url, req.query);
  downloadFile(req, res);
});

// Add a special download route for SplitDoctor files (these are temporary anyway)
app.get('/api/document-download', (req, res) => {
  console.log('Document download request received:', req.url, req.query);
  downloadFile(req, res);
});

// Add a completely public download route for document files
app.get('/api/public-download', (req, res) => {
  console.log('Public download request received:', req.url, req.query);
  // Don't use any auth middleware
  downloadFile(req, res);
});

// Health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
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
    console.log('Connected to MongoDB');
    
    // Simple HTTP server without HTTPS
    app.listen(PORT, () => {
      console.log(`HTTP Server running in ${config.nodeEnv} mode on port ${PORT}`);
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