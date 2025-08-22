const mongoose = require('mongoose');
const Project = require('../models/Project');

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/publishjockey');
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  }
};

// Clean up project structures
const cleanupProjectStructures = async () => {
  try {
    console.log('Starting project structure cleanup...');
    
    // Find all projects
    const projects = await Project.find({});
    console.log(`Found ${projects.length} projects to check`);
    
    let updatedCount = 0;
    
    for (const project of projects) {
      let needsUpdate = false;
      
      // Check if structure exists and has front matter
      if (project.structure && project.structure.front) {
        // Remove any "Title" entries from front matter
        const originalLength = project.structure.front.length;
        project.structure.front = project.structure.front.filter(section => section !== 'Title');
        
        if (project.structure.front.length !== originalLength) {
          console.log(`Project "${project.title}" (${project._id}): Removed ${originalLength - project.structure.front.length} "Title" entries`);
          needsUpdate = true;
        }
      }
      
      // Update if needed
      if (needsUpdate) {
        await project.save();
        updatedCount++;
      }
    }
    
    console.log(`Cleanup complete! Updated ${updatedCount} projects`);
    
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
};

// Run the cleanup
const runCleanup = async () => {
  await connectDB();
  await cleanupProjectStructures();
  mongoose.connection.close();
  console.log('Cleanup script finished');
};

runCleanup();
