const mongoose = require('mongoose');
require('dotenv').config();

async function resendVerificationEmail(email) {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const User = require('../models/User');
    const { sendVerificationEmail } = require('../utils/emailUtils');

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      console.log(`User with email ${email} not found`);
      await mongoose.disconnect();
      return;
    }

    console.log('User found:', {
      name: user.name,
      email: user.email,
      isVerified: user.isVerified,
      verificationToken: user.verificationToken ? user.verificationToken.substring(0, 10) + '...' : 'none'
    });

    if (user.isVerified) {
      console.log('User is already verified');
      await mongoose.disconnect();
      return;
    }

    if (!user.verificationToken) {
      console.log('User has no verification token. Generating new one...');

      // Generate new verification token
      const verificationToken = require('crypto').randomBytes(32).toString('hex');
      const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      user.verificationToken = verificationToken;
      user.verificationTokenExpires = verificationTokenExpires;
      await user.save();

      console.log('New verification token generated');
    }

    // Try to send verification email
    try {
      await sendVerificationEmail({
        name: user.name,
        email: user.email,
        verificationToken: user.verificationToken
      });

      console.log('✅ Verification email sent successfully!');
      console.log('📧 Check your email for the verification link');
    } catch (emailError) {
      console.error('❌ Failed to send verification email:', emailError.message);

      if (emailError.message.includes('Email service not configured')) {
        console.log('💡 Email service is not configured. Please set up email settings in production.');
        console.log('🔗 Verification URL would be:', `${process.env.FRONTEND_URL}/verify-email?token=${user.verificationToken}`);
      }
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Get email from command line argument
const email = process.argv[2];
if (!email) {
  console.log('Usage: node resendVerificationEmail.js <email>');
  process.exit(1);
}

resendVerificationEmail(email);
