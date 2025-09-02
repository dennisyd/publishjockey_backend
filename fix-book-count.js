/**
 * Script to fix book count for users who created BookBuilder projects
 * before the automatic book count decrement was implemented
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Project = require('./models/Project');

async function fixBookCount() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('Connected to MongoDB');
    
    // Find all BookBuilder projects
    const bookBuilderProjects = await Project.find({ 
      createdVia: 'book-builder' 
    }).populate('owner');
    
    console.log(`Found ${bookBuilderProjects.length} BookBuilder projects`);
    
    // Group by user
    const userProjectCounts = {};
    
    bookBuilderProjects.forEach(project => {
      if (project.owner) {
        const userId = project.owner._id.toString();
        if (!userProjectCounts[userId]) {
          userProjectCounts[userId] = {
            user: project.owner,
            count: 0,
            projects: []
          };
        }
        userProjectCounts[userId].count++;
        userProjectCounts[userId].projects.push({
          id: project._id,
          title: project.title,
          createdAt: project.createdAt
        });
      }
    });
    
    console.log(`\nBookBuilder projects by user:`);
    console.log('='.repeat(50));
    
    let totalBooksToDeduct = 0;
    
    for (const [userId, data] of Object.entries(userProjectCounts)) {
      console.log(`\nUser: ${data.user.email || data.user.name || userId}`);
      console.log(`BookBuilder projects created: ${data.count}`);
      console.log(`Current books remaining: ${data.user.booksRemaining}`);
      console.log(`Projects:`);
      
      data.projects.forEach(project => {
        console.log(`  - ${project.title} (${project.createdAt.toDateString()})`);
      });
      
      totalBooksToDeduct += data.count;
    }
    
    console.log('\n' + '='.repeat(50));
    console.log(`Total BookBuilder projects that need book count adjustment: ${totalBooksToDeduct}`);
    
    // Ask for confirmation before making changes
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const answer = await new Promise(resolve => {
      rl.question('\nDo you want to proceed with adjusting book counts? (yes/no): ', resolve);
    });
    
    if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
      console.log('\nAdjusting book counts...');
      
      for (const [userId, data] of Object.entries(userProjectCounts)) {
        const user = await User.findById(userId);
        if (user) {
          const oldCount = user.booksRemaining;
          user.booksRemaining = Math.max(0, user.booksRemaining - data.count);
          await user.save();
          
          console.log(`✅ ${user.email || user.name || userId}: ${oldCount} → ${user.booksRemaining} (deducted ${data.count})`);
        }
      }
      
      console.log('\n✅ Book counts have been adjusted successfully!');
    } else {
      console.log('\nOperation cancelled. No changes made.');
    }
    
    rl.close();
    
  } catch (error) {
    console.error('Error fixing book count:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the script
fixBookCount();
