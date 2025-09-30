const mongoose = require('mongoose');
const User = require('../models/User');
const Project = require('../models/Project');

/**
 * Utility function to recalculate and fix all user book allowances
 * This should be run after implementing the book allowance update feature
 * to correct any discrepancies from books deleted before the feature was added
 */
const fixBookAllowances = async () => {
  try {
    console.log('🔧 Starting book allowance fix...');
    
    // Get all users
    const users = await User.find({});
    console.log(`Found ${users.length} users to process`);
    
    let fixedCount = 0;
    let errorCount = 0;
    
    for (const user of users) {
      try {
        // Count actual books for this user
        const actualBookCount = await Project.countDocuments({ userId: user._id });
        
        // Calculate what the booksRemaining should be
        const booksUsed = actualBookCount;
        const booksRemaining = Math.max(0, user.booksAllowed - booksUsed);
        
        // Check if the count needs to be fixed
        if (user.booksRemaining !== booksRemaining) {
          console.log(`📊 User ${user.email}:`);
          console.log(`   Current booksRemaining: ${user.booksRemaining}`);
          console.log(`   Actual books: ${actualBookCount}`);
          console.log(`   booksAllowed: ${user.booksAllowed}`);
          console.log(`   Should be booksRemaining: ${booksRemaining}`);
          
          // Update the user's booksRemaining
          user.booksRemaining = booksRemaining;
          await user.save();
          
          console.log(`   ✅ Fixed to: ${booksRemaining}`);
          fixedCount++;
        } else {
          console.log(`✅ User ${user.email}: Count is correct (${user.booksRemaining}/${user.booksAllowed})`);
        }
        
      } catch (error) {
        console.error(`❌ Error processing user ${user.email}:`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n🎉 Book allowance fix completed!');
    console.log(`📈 Users fixed: ${fixedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`✅ Total processed: ${users.length}`);
    
  } catch (error) {
    console.error('❌ Error in fixBookAllowances:', error);
  }
};

/**
 * Function to fix a specific user's book allowance
 */
const fixUserBookAllowance = async (userId) => {
  try {
    console.log(`🔧 Fixing book allowance for user: ${userId}`);
    
    const user = await User.findById(userId);
    if (!user) {
      console.error('❌ User not found');
      return;
    }
    
    // Count actual books for this user
    const actualBookCount = await Project.countDocuments({ userId: user._id });
    
    // Calculate what the booksRemaining should be
    const booksUsed = actualBookCount;
    const booksRemaining = Math.max(0, user.booksAllowed - booksUsed);
    
    console.log(`📊 User ${user.email}:`);
    console.log(`   Current booksRemaining: ${user.booksRemaining}`);
    console.log(`   Actual books: ${actualBookCount}`);
    console.log(`   booksAllowed: ${user.booksAllowed}`);
    console.log(`   Should be booksRemaining: ${booksRemaining}`);
    
    if (user.booksRemaining !== booksRemaining) {
      // Update the user's booksRemaining
      user.booksRemaining = booksRemaining;
      await user.save();
      
      console.log(`   ✅ Fixed to: ${booksRemaining}`);
    } else {
      console.log(`   ✅ Count is already correct`);
    }
    
  } catch (error) {
    console.error('❌ Error fixing user book allowance:', error);
  }
};

module.exports = {
  fixBookAllowances,
  fixUserBookAllowance
};
