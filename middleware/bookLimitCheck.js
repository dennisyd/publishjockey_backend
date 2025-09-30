const User = require('../models/User');

/**
 * Middleware to check if a user has books remaining in their plan
 * Use this middleware in routes that create new books
 */
const checkBookLimit = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    
    // Get the user with their subscription details
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Check if the user has reached their book limit
    if (user.booksRemaining <= 0) {
      return res.status(403).json({
        success: false,
        message: 'You have reached your book limit. Please upgrade your plan to create more books.'
      });
    }
    
    // Attach book subscription info to the request for later use
    req.userBookSubscription = {
      subscription: user.subscription,
      booksRemaining: user.booksRemaining,
      booksAllowed: user.booksAllowed
    };
    
    next();
  } catch (error) {
    console.error('Book limit check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Error checking book limit',
      error: error.message
    });
  }
};

module.exports = {
  checkBookLimit
}; 