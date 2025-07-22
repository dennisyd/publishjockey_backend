const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verifyToken } = require('../middleware/auth');

// All routes in this file require authentication
router.use(verifyToken);

// Subscription management
router.get('/me/subscription', userController.getUserSubscription);
router.put('/me/subscription', userController.updateUserSubscription);
router.put('/me/books/decrement', userController.decrementBooksRemaining);

module.exports = router; 