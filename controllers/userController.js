const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

/**
 * @desc    Get user subscription details
 * @route   GET /api/users/me/subscription
 * @access  Private
 */
const getUserSubscription = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const user = await User.findById(userId).select('subscription booksRemaining booksAllowed subscriptionExpires');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.status(200).json({
      success: true,
      subscription: user.subscription,
      booksRemaining: user.booksRemaining,
      booksAllowed: user.booksAllowed,
      subscriptionExpires: user.subscriptionExpires
    });
  } catch (error) {
    console.error('Get user subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get subscription details',
      error: error.message
    });
  }
};

/**
 * @desc    Update user subscription
 * @route   PUT /api/users/me/subscription
 * @access  Private
 */
const updateUserSubscription = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { subscription } = req.body;
    
    if (!subscription) {
      return res.status(400).json({
        success: false,
        message: 'Subscription plan is required'
      });
    }
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Update subscription
    user.subscription = subscription;
    
    // Save will trigger the pre-save hook to update book allowance
    await user.save();
    
    // Log the subscription change
    await AuditLog.create({
      action: 'UPDATE_SUBSCRIPTION',
      performedBy: userId,
      targetUser: userId,
      details: {
        previousSubscription: user.subscription,
        newSubscription: subscription,
      }
    });
    
    res.status(200).json({
      success: true,
      message: 'Subscription updated successfully',
      subscription: user.subscription,
      booksRemaining: user.booksRemaining,
      booksAllowed: user.booksAllowed,
      subscriptionExpires: user.subscriptionExpires
    });
  } catch (error) {
    console.error('Update subscription error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update subscription',
      error: error.message
    });
  }
};

/**
 * @desc    Decrement books remaining count when creating a new book
 * @route   PUT /api/users/me/books/decrement
 * @access  Private
 */
const decrementBooksRemaining = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Check if user has books remaining
    if (user.booksRemaining <= 0) {
      return res.status(403).json({
        success: false,
        message: 'No books remaining in your plan. Please upgrade to create more books.'
      });
    }
    
    // Decrement books remaining
    user.booksRemaining -= 1;
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Book created successfully',
      booksRemaining: user.booksRemaining,
      booksAllowed: user.booksAllowed
    });
  } catch (error) {
    console.error('Decrement books remaining error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update books remaining count',
      error: error.message
    });
  }
};

/**
 * @desc    Increment books remaining count when deleting a book
 * @route   PUT /api/users/me/books/increment
 * @access  Private
 */
const incrementBooksRemaining = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Check if we're not exceeding the plan limit
    if (user.booksRemaining >= user.booksAllowed) {
      return res.status(400).json({
        success: false,
        message: 'Books remaining count cannot exceed plan limit'
      });
    }
    
    // Increment books remaining
    user.booksRemaining += 1;
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Book deleted successfully, allowance updated',
      booksRemaining: user.booksRemaining,
      booksAllowed: user.booksAllowed
    });
  } catch (error) {
    console.error('Increment books remaining error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update books remaining count',
      error: error.message
    });
  }
};

module.exports = {
  getUserSubscription,
  updateUserSubscription,
  decrementBooksRemaining,
  incrementBooksRemaining
}; 