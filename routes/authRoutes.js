const express = require('express');
const { register, login, verifyEmail, forgotPassword, resetPassword, getMe } = require('../controllers/authController');
const { verifyTokenStrict } = require('../middleware/auth');
const { validateUserRegistration, validateUserLogin } = require('../middleware/validation');

const router = express.Router();

// Public routes
router.post('/register', validateUserRegistration, register);
router.post('/login', validateUserLogin, login);
router.post('/verify-email', verifyEmail);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

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