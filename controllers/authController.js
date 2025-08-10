const User = require('../models/User');
const { generateJWT, generateRandomToken } = require('../utils/tokenUtils');
const { sendVerificationEmail, sendPasswordResetEmail, sendPasswordChangeEmail } = require('../utils/emailUtils');
const crypto = require('crypto');

// Register user
const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email already in use' 
      });
    }
    
    // Generate verification token
    const verificationToken = generateRandomToken();
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    // Create user with initial books allowance
    const user = await User.create({
      name,
      email,
      password,
      verificationToken,
      verificationTokenExpires,
      subscription: 'free',
      booksAllowed: 1,
      booksRemaining: 1
    });
    
    // Send verification email
    try {
      await sendVerificationEmail({
        name: user.name,
        email: user.email,
        verificationToken
      });
      
      res.status(201).json({
        success: true,
        message: 'User registered successfully. Please check your email for verification.'
      });
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      
      // In development, still allow registration even if email fails
      if (process.env.NODE_ENV === 'development') {
        res.status(201).json({
          success: true,
          message: 'User registered successfully. Email verification failed - check console for verification URL.',
          verificationUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`
        });
      } else {
        // In production, fail the registration if email can't be sent
        // Delete the user since we can't send verification email
        await User.findByIdAndDelete(user._id);
        
        res.status(500).json({
          success: false,
          message: 'Registration failed - unable to send verification email. Please try again later.'
        });
      }
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Registration failed',
      error: error.message
    });
  }
};

// Verify email
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;
    
    console.log('Email verification attempt with token:', token ? `${token.substring(0, 10)}...` : 'null');
    
    if (!token) {
      console.log('No token provided for email verification');
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid verification link' 
      });
    }
    
    // Find user with matching token and token not expired
    const user = await User.findOne({
      verificationToken: token,
      verificationTokenExpires: { $gt: Date.now() }
    });
    
    console.log('User lookup for verification:', { 
      found: !!user, 
      tokenLength: token.length,
      currentTime: new Date().toISOString(),
      tokenExpires: user ? user.verificationTokenExpires : 'N/A'
    });
    
    if (!user) {
      console.log('No user found with verification token');
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid or expired verification token' 
      });
    }
    
    // Update user verification status
    console.log('Updating user verification status for:', user.email);
    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();
    console.log('User verification completed successfully for:', user.email);
    
    res.status(200).json({
      success: true,
      message: 'Email verified successfully. You can now login.'
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Email verification failed',
      error: error.message 
    });
  }
};

// Login user
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log('Login attempt for email:', email);
    
    // Check if email and password are provided
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide email and password' 
      });
    }
    
    // Find user with email and include password for comparison
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      console.log('User not found with email:', email);
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }
    
    // Debug user role
    console.log('Found user:', {
      id: user._id.toString(),
      name: user.name, 
      email: user.email,
      role: user.role,
      subscription: user.subscription
    });
    
    // Check if email is verified
    if (!user.isVerified) {
      console.log('User not verified:', email);
      return res.status(401).json({ 
        success: false, 
        message: 'Please verify your email before logging in' 
      });
    }
    
    // Compare password
    console.log('Login attempt - comparing passwords for user:', email);
    console.log('Input password length:', password ? password.length : 'n/a');
    const hasStoredHash = !!user.password;
    console.log('Stored password present:', hasStoredHash);
    if (hasStoredHash) {
      console.log('Stored password hash length:', user.password.length);
      console.log('Stored password starts with $2b$:', user.password.startsWith('$2b$'));
      console.log('Stored password first 20 chars:', user.password.substring(0, 20));
    } else {
      console.warn('No stored password hash found on user document during login.');
    }
    
    const isPasswordValid = await user.comparePassword(password);
    console.log('Password comparison result:', isPasswordValid);
    
    if (!isPasswordValid) {
      console.log('Invalid password for user:', email);
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid credentials' 
      });
    }
    
    // Normalize legacy subscriptions (e.g., prior 25-book/annual) to current plans
    if (user.subscription === 'annual' || user.booksAllowed === 25) {
      try {
        const normalizedBooksAllowed = 20;
        const normalizedImagesAllowed = 200; // bundle20 default
        const normalizedSubscription = 'bundle20';
        const normalizedBooksRemaining = Math.min(user.booksRemaining || normalizedBooksAllowed, normalizedBooksAllowed);
        const threeYearsFromNow = new Date();
        threeYearsFromNow.setFullYear(threeYearsFromNow.getFullYear() + 3);

        await User.updateOne(
          { _id: user._id },
          {
            $set: {
              subscription: normalizedSubscription,
              booksAllowed: normalizedBooksAllowed,
              booksRemaining: normalizedBooksRemaining,
              imagesAllowed: normalizedImagesAllowed,
              subscriptionExpires: threeYearsFromNow,
              lastLogin: new Date()
            }
          },
          { runValidators: false }
        );

        // Reflect changes locally for response
        user.subscription = normalizedSubscription;
        user.booksAllowed = normalizedBooksAllowed;
        user.booksRemaining = normalizedBooksRemaining;
        user.imagesAllowed = normalizedImagesAllowed;
        user.subscriptionExpires = threeYearsFromNow;
      } catch (normErr) {
        console.error('Legacy subscription normalization failed:', normErr);
        // Still set lastLogin to avoid blocking login
        await User.updateOne(
          { _id: user._id },
          { $set: { lastLogin: new Date() } },
          { runValidators: false }
        );
      }
    } else {
      // Update lastLogin timestamp without triggering validation on legacy fields
      await User.updateOne(
        { _id: user._id },
        { $set: { lastLogin: new Date() } },
        { runValidators: false }
      );
    }

    // Generate token
    console.log('Generating JWT token for user:', user._id.toString());
    const token = generateJWT(user);
    console.log('JWT token generated:', token ? `${token.substring(0, 10)}...` : 'none');
    
    // Prepare user object without sensitive data
    const userWithoutSensitiveData = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      subscription: user.subscription,
      subscriptionExpires: user.subscriptionExpires
    };
    
    // Set JWT as HTTP-only cookie
    res.cookie('accessToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // true in production, false in development
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      maxAge: 8 * 60 * 60 * 1000 // 8 hours in milliseconds
    });
    
    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: userWithoutSensitiveData
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Login failed',
      error: error.message 
    });
  }
};

// Forgot password
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide your email' 
      });
    }
    
    // Find user by email
    const user = await User.findOne({ email });
    
    // Even if user not found, return success (security)
    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'If your email is registered, you will receive password reset instructions'
      });
    }
    
    // Generate token
    const resetToken = generateRandomToken();
    const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    
    // Save token to user
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetTokenExpires;
    await user.save();
    
    // Send password reset email
    await sendPasswordResetEmail({
      name: user.name,
      email: user.email,
      resetToken
    });
    
    res.status(200).json({
      success: true,
      message: 'If your email is registered, you will receive password reset instructions'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Request failed',
      error: error.message 
    });
  }
};

// Reset password
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    
    console.log('Reset password request received:', { token: token ? `${token.substring(0, 10)}...` : 'null', hasPassword: !!newPassword });
    
    if (!token || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide token and new password' 
      });
    }
    
    // Find user with matching token and token not expired
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });
    
    console.log('User lookup result:', { 
      found: !!user, 
      tokenLength: token.length,
      currentTime: new Date().toISOString(),
      tokenExpires: user ? user.resetPasswordExpires : 'N/A'
    });
    
    if (!user) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid or expired reset token' 
      });
    }
    
    // Update password
    console.log('Before password update - password length:', newPassword.length);
    
    // Explicitly hash the password to ensure it's properly hashed
    const bcrypt = require('bcryptjs');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    // Update user document directly to bypass pre-save hooks
    await User.findByIdAndUpdate(user._id, {
      password: hashedPassword,
      resetPasswordToken: undefined,
      resetPasswordExpires: undefined
    });
    
    // Refresh user object to get updated data
    const updatedUser = await User.findById(user._id).select('+password');
    console.log('After password save - password field length:', updatedUser.password.length);
    console.log('Password field starts with $2b$ (bcrypt hash):', updatedUser.password.startsWith('$2b$'));
    
    // Update the local user object for email sending
    user.password = hashedPassword;
    
    // Send password change confirmation email
    try {
      await sendPasswordChangeEmail({
        name: user.name,
        email: user.email,
        changeDetails: {
          timestamp: new Date(),
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.get('User-Agent')
        }
      });
    } catch (emailError) {
      console.error('Failed to send password change confirmation email:', emailError);
      // Don't fail the password reset if email fails
    }
    
    res.status(200).json({
      success: true,
      message: 'Password reset successful. You can now login with your new password.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Password reset failed',
      error: error.message 
    });
  }
};

// Get current user
const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        subscription: user.subscription,
        subscriptionExpires: user.subscriptionExpires
      }
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve user data',
      error: error.message 
    });
  }
};

// Update profile
const updateProfile = async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide name' 
      });
    }
    
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { name },
      { new: true, runValidators: true }
    );
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        subscription: user.subscription,
        subscriptionExpires: user.subscriptionExpires
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update profile',
      error: error.message 
    });
  }
};

module.exports = {
  register,
  verifyEmail,
  login,
  forgotPassword,
  resetPassword,
  getCurrentUser,
  getMe: getCurrentUser, // Alias for getMe
  updateProfile
}; 