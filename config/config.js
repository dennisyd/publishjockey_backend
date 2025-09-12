require('dotenv').config();

const config = {
  // Server Configuration
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Frontend URL Configuration
  frontendUrl: process.env.FRONTEND_URL || (process.env.NODE_ENV === 'production' ? 'https://publishjockey-frontend.vercel.app' : 'http://localhost:3000'),
  
  // JWT Configuration
  jwt: {
    accessTokenSecret: process.env.JWT_ACCESS_TOKEN_SECRET,
    refreshTokenSecret: process.env.JWT_REFRESH_TOKEN_SECRET,
    accessTokenExpiry: process.env.JWT_ACCESS_TOKEN_EXPIRY || '1h',
    refreshTokenExpiry: process.env.JWT_REFRESH_TOKEN_EXPIRY || '30d'
  },
  
  // CORS Configuration
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? process.env.ALLOWED_ORIGINS?.split(',') || ['https://publishjockey-frontend.vercel.app', 'https://publishjockey.com']
      : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:3001'],
    credentials: true
  },
  
  // Database Configuration
  db: {
    uri: process.env.MONGODB_URI
  },
  
  // Email Configuration
  email: {
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  }
};

// Debug environment variables (only in development)
if (config.nodeEnv === 'development') {
  console.log('Backend environment variables:', {
    JWT_ACCESS_TOKEN_SECRET: process.env.JWT_ACCESS_TOKEN_SECRET ? `${process.env.JWT_ACCESS_TOKEN_SECRET.substring(0, 10)}...` : 'NOT SET',
    JWT_REFRESH_TOKEN_SECRET: process.env.JWT_REFRESH_TOKEN_SECRET ? 'SET' : 'NOT SET',
    MONGODB_URI: process.env.MONGODB_URI ? 'SET' : 'NOT SET',
    FRONTEND_URL: config.frontendUrl,
    EMAIL_HOST: process.env.EMAIL_HOST || 'NOT SET',
    EMAIL_USER: process.env.EMAIL_USER || 'NOT SET',
    NODE_ENV: config.nodeEnv
  });
}

// Validate required environment variables
const requiredEnvVars = [
  'JWT_ACCESS_TOKEN_SECRET',
  'JWT_REFRESH_TOKEN_SECRET',
  'MONGODB_URI'
];

// In production, also require email configuration
if (config.nodeEnv === 'production') {
  requiredEnvVars.push('EMAIL_HOST', 'EMAIL_USER', 'EMAIL_PASS');
}

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

module.exports = config; 