require('dotenv').config();

console.log('=== Environment Check ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('MONGODB_URI:', process.env.MONGODB_URI ? 'SET' : 'NOT SET');
console.log('JWT_ACCESS_TOKEN_SECRET:', process.env.JWT_ACCESS_TOKEN_SECRET ? 'SET' : 'NOT SET');
console.log('JWT_REFRESH_TOKEN_SECRET:', process.env.JWT_REFRESH_TOKEN_SECRET ? 'SET' : 'NOT SET');
console.log('FRONTEND_URL:', process.env.FRONTEND_URL);
console.log('');

console.log('=== Email Configuration ===');
console.log('EMAIL_HOST:', process.env.EMAIL_HOST || 'NOT SET');
console.log('EMAIL_PORT:', process.env.EMAIL_PORT || 'NOT SET');
console.log('EMAIL_SECURE:', process.env.EMAIL_SECURE || 'NOT SET');
console.log('EMAIL_USER:', process.env.EMAIL_USER || 'NOT SET');
console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? 'SET' : 'NOT SET');
console.log('');

console.log('=== Required Variables Check ===');
const required = ['JWT_ACCESS_TOKEN_SECRET', 'JWT_REFRESH_TOKEN_SECRET', 'MONGODB_URI'];
const missing = required.filter(env => !process.env[env]);

if (missing.length > 0) {
  console.log('❌ Missing required environment variables:', missing.join(', '));
} else {
  console.log('✅ All required environment variables are set');
}

console.log('');
console.log('=== Production Email Check ===');
if (process.env.NODE_ENV === 'production') {
  const emailRequired = ['EMAIL_HOST', 'EMAIL_USER', 'EMAIL_PASS'];
  const missingEmail = emailRequired.filter(env => !process.env[env]);

  if (missingEmail.length > 0) {
    console.log('⚠️  Missing email configuration (will log warnings):', missingEmail.join(', '));
  } else {
    console.log('✅ Email configuration is complete');
  }
} else {
  console.log('ℹ️  Running in development mode - email configuration is optional');
}
