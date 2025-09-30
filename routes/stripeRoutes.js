const express = require('express');
const router = express.Router();
const stripeController = require('../controllers/stripeController');
const { verifyToken } = require('../middleware/auth');

// Routes that require authentication
router.post('/create-checkout-session', verifyToken, stripeController.createCheckoutSession);
router.get('/verify-session/:sessionId', verifyToken, stripeController.verifySession);
router.post('/manual-verify', verifyToken, stripeController.manualVerifyPayment);

// Webhook doesn't require authentication - it's authenticated via Stripe signature
router.post('/webhook', express.raw({ type: 'application/json' }), stripeController.handleWebhookEvent);

module.exports = router; 