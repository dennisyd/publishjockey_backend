const mongoose = require('mongoose');
require('dotenv').config();

// Import the User model
const User = require('../models/User');

async function verifyUser(email) {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    // Find the user
    const user = await User.findOne({ email: email.toLowerCase() });
    
    if (!user) {
      console.log(`❌ User not found with email: ${email}`);
      return;
    }

    console.log(`📧 Found user: ${user.name} (${user.email})`);
    console.log(`📋 Current verification status: ${user.isVerified ? 'VERIFIED' : 'NOT VERIFIED'}`);
    
    if (user.isVerified) {
      console.log('✅ User is already verified!');
      return;
    }

    // Update user verification status
    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();

    console.log('✅ User verification status updated successfully!');
    console.log(`🎉 ${user.name} (${user.email}) is now verified and can log in.`);

  } catch (error) {
    console.error('❌ Error verifying user:', error);
  } finally {
    // Close the database connection
    await mongoose.connection.close();
    console.log('📱 Database connection closed');
  }
}

// Get email from command line argument or use default
const email = process.argv[2] || 'dylanpiercedennis@gmail.com';

console.log(`🔧 Manual User Verification Script`);
console.log(`📧 Target email: ${email}`);
console.log('🚀 Starting verification process...\n');

verifyUser(email);
