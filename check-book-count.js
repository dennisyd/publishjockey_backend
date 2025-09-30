/**
 * Quick script to check current book count in database vs projects created
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Project = require('./models/Project');

async function checkBookCount() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('Connected to MongoDB');
    
    // Find your user
    const user = await User.findOne({ email: 'dennisyd@gmail.com' });
    
    if (!user) {
      console.log('User not found!');
      return;
    }
    
    console.log('\n=== USER BOOK COUNT INFO ===');
    console.log(`Email: ${user.email}`);
    console.log(`Books Allowed: ${user.booksAllowed}`);
    console.log(`Books Remaining: ${user.booksRemaining}`);
    console.log(`Books Used: ${user.booksAllowed - user.booksRemaining}`);
    
    // Count actual projects
    const totalProjects = await Project.countDocuments({ 
      $or: [
        { owner: user._id },
        { userId: user._id }
      ]
    });
    
    const bookBuilderProjects = await Project.countDocuments({ 
      $or: [
        { owner: user._id },
        { userId: user._id }
      ],
      createdVia: 'book-builder'
    });
    
    const regularProjects = totalProjects - bookBuilderProjects;
    
    console.log('\n=== ACTUAL PROJECT COUNTS ===');
    console.log(`Total Projects: ${totalProjects}`);
    console.log(`BookBuilder Projects: ${bookBuilderProjects}`);
    console.log(`Regular Projects: ${regularProjects}`);
    
    console.log('\n=== CALCULATION CHECK ===');
    console.log(`Should have: ${user.booksAllowed} - ${totalProjects} = ${user.booksAllowed - totalProjects} books remaining`);
    console.log(`Actually has: ${user.booksRemaining} books remaining`);
    
    const difference = user.booksRemaining - (user.booksAllowed - totalProjects);
    if (difference !== 0) {
      console.log(`❌ MISMATCH: Off by ${difference} books`);
      console.log(`✅ CORRECTION: Should set booksRemaining to ${user.booksAllowed - totalProjects}`);
    } else {
      console.log(`✅ CORRECT: Book count matches project count`);
    }
    
  } catch (error) {
    console.error('Error checking book count:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the script
checkBookCount();
