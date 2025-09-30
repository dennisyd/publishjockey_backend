/**
 * CRON JOB SETUP INSTRUCTIONS FOR NIGHTLY IMAGE CLEANUP
 * 
 * This file provides instructions for setting up a cron job to run the nightly image cleanup.
 * The cleanup script removes orphaned images from Cloudinary and updates user image counts.
 */

const path = require('path');

// Get the absolute path to the cleanup script
const cleanupScriptPath = path.join(__dirname, 'nightlyImageCleanup.js');
const backendPath = path.join(__dirname, '..');

console.log('=== NIGHTLY IMAGE CLEANUP SETUP ===\n');

console.log('1. CRON JOB SETUP (Linux/Mac):');
console.log('   To set up a cron job that runs every night at 2 AM:');
console.log('   ');
console.log('   Run: crontab -e');
console.log('   Add this line:');
console.log(`   0 2 * * * cd ${backendPath} && node ${cleanupScriptPath} >> /var/log/image-cleanup.log 2>&1`);
console.log('   ');

console.log('2. WINDOWS TASK SCHEDULER:');
console.log('   Create a new task with these settings:');
console.log('   - Trigger: Daily at 2:00 AM');
console.log('   - Action: Start a program');
console.log('   - Program: node');
console.log(`   - Arguments: "${cleanupScriptPath}"`);
console.log(`   - Start in: "${backendPath}"`);
console.log('   ');

console.log('3. DOCKER/CONTAINER SETUP:');
console.log('   Add this to your Dockerfile or docker-compose.yml:');
console.log('   ');
console.log('   # Install cron');
console.log('   RUN apt-get update && apt-get install -y cron');
console.log('   ');
console.log('   # Add cron job');
console.log('   RUN echo "0 2 * * * cd /app && node scripts/nightlyImageCleanup.js" | crontab -');
console.log('   ');
console.log('   # Start cron service');
console.log('   CMD ["cron", "-f"]');
console.log('   ');

console.log('4. CLOUD DEPLOYMENT (Heroku, AWS, etc.):');
console.log('   For cloud deployments, use their scheduling services:');
console.log('   - Heroku: Use Heroku Scheduler add-on');
console.log('   - AWS: Use CloudWatch Events/EventBridge');
console.log('   - Google Cloud: Use Cloud Scheduler');
console.log('   - Azure: Use Azure Logic Apps or Functions');
console.log('   ');

console.log('5. MANUAL TESTING:');
console.log('   To test the cleanup script manually:');
console.log(`   cd ${backendPath}`);
console.log(`   node ${cleanupScriptPath}`);
console.log('   ');

console.log('6. ENVIRONMENT VARIABLES:');
console.log('   Make sure these are set in your production environment:');
console.log('   - MONGODB_URI or MONGO_URI');
console.log('   - CLOUDINARY_CLOUD_NAME');
console.log('   - CLOUDINARY_API_KEY');
console.log('   - CLOUDINARY_API_SECRET');
console.log('   ');

console.log('7. LOGGING:');
console.log('   The script logs its activities. Monitor the logs to ensure it runs correctly.');
console.log('   Consider setting up log rotation for production environments.');
console.log('   ');

console.log('=== SETUP COMPLETE ===');
console.log('Choose the method that best fits your deployment environment.');

// Function to create a simple cron job file for Unix systems
function createCronJob() {
  const cronCommand = `0 2 * * * cd ${backendPath} && node ${cleanupScriptPath} >> /var/log/image-cleanup.log 2>&1`;
  
  console.log('\nCron job command:');
  console.log(cronCommand);
  
  return cronCommand;
}

// Export for programmatic use
module.exports = {
  cleanupScriptPath,
  backendPath,
  createCronJob
};

// If running this script directly, show the setup instructions
if (require.main === module) {
  // Already logged above
}