const express = require('express');
const { register, login, verifyEmail, forgotPassword, resetPassword, refreshToken, getMe } = require('../controllers/authController');
const { verifyTokenStrict } = require('../middleware/auth');
const { validateUserRegistration, validateUserLogin } = require('../middleware/validation');

const router = express.Router();

// Public routes
router.post('/register', validateUserRegistration, register);
router.post('/login', validateUserLogin, login);
router.get('/verify-email', verifyEmail); // Changed to GET to match controller
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Test endpoint for email verification (development only)
if (process.env.NODE_ENV === 'development') {
  router.post('/test-email', async (req, res) => {
    try {
      const { email, name } = req.body;
      const { sendVerificationEmail } = require('../utils/emailUtils');
      const { generateRandomToken } = require('../utils/tokenUtils');
      
      const verificationToken = generateRandomToken();
      
      await sendVerificationEmail({
        name: name || 'Test User',
        email: email || 'test@example.com',
        verificationToken
      });
      
      res.json({
        success: true,
        message: 'Test email sent successfully',
        token: verificationToken
      });
    } catch (error) {
      console.error('Test email error:', error);
      res.status(500).json({
        success: false,
        message: 'Test email failed',
        error: error.message
      });
    }
  });
}

// Protected routes
router.get('/me', verifyTokenStrict, getMe);

// Refresh token route (no auth required - uses refresh token)
router.post('/refresh', refreshToken);

module.exports = router; 