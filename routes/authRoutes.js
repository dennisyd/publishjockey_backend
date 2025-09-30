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


// Protected routes
router.get('/me', verifyTokenStrict, getMe);

// Refresh token route (no auth required - uses refresh token)
router.post('/refresh', refreshToken);

module.exports = router; 