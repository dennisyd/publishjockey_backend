const mongoose = require('mongoose');
require('dotenv').config();

async function manuallyVerifyUser(email) {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const User = require('../models/User');
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      console.log(`User with email ${email} not found`);
      return;
    }

    console.log('User found:', {
      name: user.name,
      email: user.email,
      isVerified: user.isVerified,
      verificationToken: user.verificationToken ? user.verificationToken.substring(0, 10) + '...' : 'none',
      createdAt: user.createdAt
    });

    if (user.isVerified) {
      console.log('User is already verified');
      await mongoose.disconnect();
      return;
    }

    // Manually verify the user
    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();

    console.log('User manually verified successfully!');
    console.log('User can now log in.');

    await mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Get email from command line argument
const email = process.argv[2];
if (!email) {
  console.log('Usage: node manuallyVerifyUser.js <email>');
  process.exit(1);
}

manuallyVerifyUser(email);
