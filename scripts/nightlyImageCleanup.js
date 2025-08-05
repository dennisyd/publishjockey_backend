const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;
const User = require('../models/User');
const Project = require('../models/Project');
const { findOrphanedImages, updateUserImageCount } = require('../utils/imageScanner');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Function to get all images for a user from Cloudinary
async function getUserCloudinaryImages(userId) {
  try {
    const result = await cloudinary.search
      .expression(`folder:user_${userId}`)
      .sort_by([['created_at', 'desc']])
      .max_results(500)
      .execute();
    
    return result.resources;
  } catch (error) {
    console.error(`Error fetching Cloudinary images for user ${userId}:`, error);
    return [];
  }
}

// Function to delete image from Cloudinary
async function deleteCloudinaryImage(publicId) {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result.result === 'ok';
  } catch (error) {
    console.error(`Error deleting image ${publicId} from Cloudinary:`, error);
    return false;
  }
}

// Main cleanup function for a single user
async function cleanupUserImages(userId) {
  try {
    console.log(`Starting cleanup for user: ${userId}`);
    
    // Get all user's images from Cloudinary
    const cloudinaryImages = await getUserCloudinaryImages(userId);
    console.log(`Found ${cloudinaryImages.length} images in Cloudinary for user ${userId}`);
    
    if (cloudinaryImages.length === 0) {
      console.log(`No images found for user ${userId}, skipping...`);
      return { deleted: 0, errors: 0 };
    }
    
    // Find orphaned images
    const orphanedImages = await findOrphanedImages(userId, cloudinaryImages, Project);
    console.log(`Found ${orphanedImages.length} orphaned images for user ${userId}`);
    
    let deletedCount = 0;
    let errorCount = 0;
    
    // Delete orphaned images
    for (const image of orphanedImages) {
      const deleted = await deleteCloudinaryImage(image.public_id);
      if (deleted) {
        deletedCount++;
        console.log(`Deleted orphaned image: ${image.public_id}`);
      } else {
        errorCount++;
        console.error(`Failed to delete image: ${image.public_id}`);
      }
      
      // Add small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Update user's image count based on actual usage
    const actualUsage = await updateUserImageCount(userId, User, Project);
    console.log(`Updated user ${userId} image count to: ${actualUsage}`);
    
    return { deleted: deletedCount, errors: errorCount, actualUsage };
    
  } catch (error) {
    console.error(`Error during cleanup for user ${userId}:`, error);
    return { deleted: 0, errors: 1 };
  }
}

// Main function to run nightly cleanup for all users
async function runNightlyCleanup() {
  const startTime = Date.now();
  console.log(`Starting nightly image cleanup at ${new Date().toISOString()}`);
  
  try {
    // Connect to MongoDB if not already connected
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
      console.log('Connected to MongoDB for cleanup');
    }
    
    // Get all users who have uploaded images
    const users = await User.find({ 
      imagesUsed: { $gt: 0 } 
    }).select('_id email imagesUsed');
    
    console.log(`Found ${users.length} users with images to process`);
    
    let totalDeleted = 0;
    let totalErrors = 0;
    let usersProcessed = 0;
    
    // Process each user
    for (const user of users) {
      const result = await cleanupUserImages(user._id);
      totalDeleted += result.deleted;
      totalErrors += result.errors;
      usersProcessed++;
      
      // Progress logging
      if (usersProcessed % 10 === 0) {
        console.log(`Processed ${usersProcessed}/${users.length} users...`);
      }
    }
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.log(`Nightly cleanup completed in ${duration}s`);
    console.log(`Summary: ${usersProcessed} users processed, ${totalDeleted} images deleted, ${totalErrors} errors`);
    
    return {
      success: true,
      usersProcessed,
      imagesDeleted: totalDeleted,
      errors: totalErrors,
      duration
    };
    
  } catch (error) {
    console.error('Error during nightly cleanup:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Run the cleanup if this script is executed directly
if (require.main === module) {
  runNightlyCleanup()
    .then(result => {
      console.log('Cleanup result:', result);
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error during cleanup:', error);
      process.exit(1);
    });
}

module.exports = {
  runNightlyCleanup,
  cleanupUserImages,
  getUserCloudinaryImages,
  deleteCloudinaryImage
};