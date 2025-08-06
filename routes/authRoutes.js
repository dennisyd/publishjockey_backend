const express = require('express');
const { register, login, verifyEmail, forgotPassword, resetPassword, getMe } = require('../controllers/authController');
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

// Refresh token route
router.post('/refresh', verifyTokenStrict, async (req, res) => {
  try {
    // The user is already authenticated via verifyTokenStrict
    // Generate a new token with the same user data
    const { generateJWT } = require('../utils/tokenUtils');
    
    // Get fresh user data from database
    const User = require('../models/User');
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Generate new token
    const newToken = generateJWT(user);
    
    // Prepare user object without sensitive data
    const userWithoutSensitiveData = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      subscription: user.subscription,
      subscriptionExpires: user.subscriptionExpires
    };
    
    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      token: newToken,
      user: userWithoutSensitiveData
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      success: false,
      message: 'Token refresh failed',
      error: error.message
    });
  }
});

module.exports = router; 