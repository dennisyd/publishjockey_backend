require('dotenv').config();

const config = {
  // Server Configuration
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // JWT Configuration
  jwt: {
    accessTokenSecret: process.env.JWT_ACCESS_TOKEN_SECRET,
    refreshTokenSecret: process.env.JWT_REFRESH_TOKEN_SECRET,
    accessTokenExpiry: process.env.JWT_ACCESS_TOKEN_EXPIRY || '8h',
    refreshTokenExpiry: process.env.JWT_REFRESH_TOKEN_EXPIRY || '30d'
  },
  
  // CORS Configuration
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? process.env.ALLOWED_ORIGINS?.split(',') 
      : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:3001'],
    credentials: true
  },
  
  // Database Configuration
  db: {
    uri: process.env.MONGODB_URI
  },
  
  // Email Configuration (if needed)
  email: {
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  }
};

// Debug environment variables
console.log('Backend environment variables:', {
  JWT_ACCESS_TOKEN_SECRET: process.env.JWT_ACCESS_TOKEN_SECRET ? `${process.env.JWT_ACCESS_TOKEN_SECRET.substring(0, 10)}...` : 'NOT SET',
  JWT_REFRESH_TOKEN_SECRET: process.env.JWT_REFRESH_TOKEN_SECRET ? 'SET' : 'NOT SET',
  MONGODB_URI: process.env.MONGODB_URI ? 'SET' : 'NOT SET'
});

// Validate required environment variables
const requiredEnvVars = [
  'JWT_ACCESS_TOKEN_SECRET',
  'JWT_REFRESH_TOKEN_SECRET',
  'MONGODB_URI'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

module.exports = config; 