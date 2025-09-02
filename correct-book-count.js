/**
 * Script to correctly set book count based on actual project count
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Project = require('./models/Project');

async function correctBookCount() {
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
    
    // Count actual projects
    const totalProjects = await Project.countDocuments({ 
      $or: [
        { owner: user._id },
        { userId: user._id }
      ]
    });
    
    const correctBooksRemaining = user.booksAllowed - totalProjects;
    
    console.log('\n=== CURRENT STATUS ===');
    console.log(`Email: ${user.email}`);
    console.log(`Books Allowed: ${user.booksAllowed}`);
    console.log(`Total Projects: ${totalProjects}`);
    console.log(`Current Books Remaining (DB): ${user.booksRemaining}`);
    console.log(`Correct Books Remaining: ${correctBooksRemaining}`);
    
    if (user.booksRemaining === correctBooksRemaining) {
      console.log('✅ Book count is already correct!');
    } else {
      console.log(`❌ Book count needs correction: ${user.booksRemaining} → ${correctBooksRemaining}`);
      
      // Ask for confirmation
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      const answer = await new Promise(resolve => {
        rl.question(`\nUpdate book count to ${correctBooksRemaining}? (yes/no): `, resolve);
      });
      
      if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
        user.booksRemaining = correctBooksRemaining;
        await user.save();
        console.log(`✅ Book count updated to ${correctBooksRemaining}`);
      } else {
        console.log('Operation cancelled.');
      }
      
      rl.close();
    }
    
  } catch (error) {
    console.error('Error correcting book count:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
correctBookCount();
