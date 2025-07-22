// updateSubscriptions.js
// Run this script with: node utils/updateSubscriptions.js
// Make sure your MongoDB connection string is correct and MongoDB is running.

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const User = require('../models/User');

const THREE_YEARS_MS = 3 * 365 * 24 * 60 * 60 * 1000;
const now = Date.now();
const expiresAt = new Date(now + THREE_YEARS_MS);

async function updateSubscriptions() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');

    // Helper to update booksRemaining only if needed
    async function updateUsers(query, plan, allowed) {
      const users = await User.find(query);
      let updated = 0;
      for (const user of users) {
        let newBooksRemaining = user.booksRemaining;
        if (typeof newBooksRemaining !== 'number' || newBooksRemaining > allowed || newBooksRemaining === 0) {
          newBooksRemaining = allowed;
        }
        const res = await User.updateOne(
          { _id: user._id },
          {
            $set: {
              subscription: plan,
              booksAllowed: allowed,
              booksRemaining: newBooksRemaining,
              subscriptionExpires: expiresAt,
            },
          }
        );
        if (res.modifiedCount > 0) updated++;
      }
      return updated;
    }

    // Update 10-book users to new bundle
    const bundleUpdated = await updateUsers(
      { subscription: { $in: ['growth', 'old_bundle', 'annual', 'bundle'] }, booksAllowed: { $gte: 10, $lt: 20 } },
      'bundle',
      10
    );
    console.log(`Updated ${bundleUpdated} users to 10-book bundle`);

    // Update 20-book users to new bundle20
    const bundle20Updated = await updateUsers(
      { subscription: { $in: ['professional', 'bundle20', 'power'] }, booksAllowed: { $gte: 20 } },
      'bundle20',
      20
    );
    console.log(`Updated ${bundle20Updated} users to 20-book bundle`);

    // Update single book users to new single plan
    const singleUpdated = await updateUsers(
      { subscription: { $in: ['author', 'single'] }, booksAllowed: 1 },
      'single',
      1
    );
    console.log(`Updated ${singleUpdated} users to single book plan`);

    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  } catch (err) {
    console.error('Error updating subscriptions:', err);
    process.exit(1);
  }
}

updateSubscriptions(); 