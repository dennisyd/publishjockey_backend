const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a name'],
    trim: true,
    maxlength: [50, 'Name cannot be more than 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Please provide an email'],
    match: [
      /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
      'Please provide a valid email'
    ],
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  subscription: {
    type: String,
    enum: [
      'free', 'beta', 'single', 'single_promo', 'bundle5', 'bundle5_promo', 
      'bundle10', 'bundle10_promo', 'bundle20', 'bundle20_promo', 
      'poweruser', 'poweruser_promo', 'agency', 'agency_promo', 
      'additional', 'custom',
      // Ebook plans
      'eSingle', 'eSingle_promo', 'ebundle5_promo', 'ebundle10_promo', 
      'ebundle20_promo', 'epoweruser_promo', 'eagency_promo',
      // Full service plans
      'fullService_promo', 'fullServicePlus_promo',
      // Add-ons
      'images_addon_100'
    ],
    default: 'free'
  },
  booksRemaining: {
    type: Number,
    default: 1, // Default for free plan is 1 book
  },
  booksAllowed: {
    type: Number,
    default: 1, // Default for free plan is 1 book
  },
  subscriptionExpires: {
    type: Date,
    default: () => {
      const date = new Date();
      date.setFullYear(date.getFullYear() + 100); // Free subscription "expires" in 100 years
      return date;
    }
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationToken: String,
  verificationTokenExpires: Date,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  createdAt: {
    type: Date,
    default: Date.now
  },
  isSuspended: {
    type: Boolean,
    default: false
  },
  suspensionReason: {
    type: String
  },
  lastLogin: {
    type: Date
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  accountLocked: {
    type: Boolean,
    default: false
  },
  accountLockedUntil: {
    type: Date
  },
  notifications: [
    {
      title: String,
      message: String,
      read: {
        type: Boolean,
        default: false
      },
      createdAt: {
        type: Date,
        default: Date.now
      }
    }
  ],
  // Image tracking fields
  imagesUsed: {
    type: Number,
    default: 0
  },
  imagesAllowed: {
    type: Number,
    default: 2 // Default for free plan (2 images for testing)
  },
  additionalImageSlots: {
    type: Number,
    default: 0
  },
  // Page limit tracking
  pageLimit: {
    type: Number,
    default: null // null means unlimited pages
  },
  // Word limit tracking (for ebook subscriptions)
  wordLimit: {
    type: Number,
    default: null // null means unlimited words
  },
  // Promo redemption flags (server-side enforcement)
  promoRedemptions: {
    type: Object,
    default: {
      single: false,
      bundle5: false,
      bundle10: false,
      bundle20: false,
      poweruser: false,
      agency: false
    }
  }
});

// Hash password before saving
UserSchema.pre('save', async function(next) {
  // Only hash the password if it's modified (or new)
  if (!this.isModified('password')) return next();
  
  // Skip hashing if password is already hashed (from reset password)
  if (this.password && (this.password.startsWith('$2a$') || this.password.startsWith('$2b$'))) {
    return next();
  }
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
UserSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    console.log('🔐 Password comparison debug:');
    console.log('  - Candidate password length:', candidatePassword ? candidatePassword.length : 'n/a');
    if (!this.password) {
      console.error('  - Stored password hash is missing for user document.');
      return false;
    }
    console.log('  - Stored hash length:', this.password.length);
    console.log('  - Hash starts with:', this.password.substring(0, 7));
    
    const result = await bcrypt.compare(candidatePassword, this.password);
    console.log('  - Comparison result:', result);
    
    return result;
  } catch (error) {
    console.error('Password comparison error:', error);
    return false;
  }
};

  // Method to update books remaining after subscription update
  UserSchema.methods.updateBooksAllowance = function() {
    const planLimits = {
      'free': 1,
      'beta': 1, // Beta users get 1 book, like free users, but do not pay
      'single': 1,
      'single_promo': 1,
      'bundle5': 5,
      'bundle5_promo': 5,
      'bundle10': 10,
      'bundle10_promo': 10,
      'bundle20': 20,
      'bundle20_promo': 20,
      'poweruser': 48,
      'poweruser_promo': 48,
      'agency': 180,
      'agency_promo': 180,
      'additional': 1, // Additional book purchase
      'custom': 50, // Default for custom, can be overridden
      // Ebook plans
      'eSingle': 1,
      'eSingle_promo': 1,
      'ebundle5_promo': 5,
      'ebundle10_promo': 10,
      'ebundle20_promo': 20,
      'epoweruser_promo': 48,
      'eagency_promo': 180,
      // Full service plans
      'fullService_promo': 50,
      'fullServicePlus_promo': 100,
      // Add-ons
      'images_addon_100': 1 // Image addon doesn't change book count
    };
  
  const oldBooksAllowed = this.booksAllowed;
  this.booksAllowed = planLimits[this.subscription] || 1;
  
  // If this is a new user or subscription change, reset to full allowance
  if (this.isNew || oldBooksAllowed !== this.booksAllowed) {
    // For admin subscription changes, always reset to full allowance
    this.booksRemaining = this.booksAllowed;
    console.log(`📚 Books allowance updated: ${oldBooksAllowed} → ${this.booksAllowed}, remaining reset to ${this.booksRemaining}`);
  } else if (this.booksRemaining > this.booksAllowed) {
    // Only reduce if current remaining exceeds new allowance
    this.booksRemaining = this.booksAllowed;
  }
  // Otherwise keep the current remaining count
};

  // Method to update image limits based on subscription
  UserSchema.methods.updateImageLimits = function() {
    const imagePlanLimits = {
      'free': 2,        // Free plan: 2 images max for testing
      'beta': 10,       // Beta users: 10 images (granted by admin)
      'single': 12,     // Single book plan: 12 images
      'single_promo': 11,
      'bundle5': 50,
      'bundle5_promo': 55,
      'bundle10': 100,
      'bundle10_promo': 110,
      'bundle20': 200,
      'bundle20_promo': 220,
      'poweruser': 480,
      'poweruser_promo': 528,
      'agency': 1800,
      'agency_promo': 1980,
      'additional': 10, // Additional book: +10 images
      // Ebook plans
      'eSingle': 12,
      'eSingle_promo': 11,
      'ebundle5_promo': 55,
      'ebundle10_promo': 110,
      'ebundle20_promo': 220,
      'epoweruser_promo': 528,
      'eagency_promo': 1980,
      // Full service plans
      'fullService_promo': 500,
      'fullServicePlus_promo': 1000,
      // Add-ons
      'images_addon_100': 100 // Image addon gives 100 additional images
    };
  
  this.imagesAllowed = imagePlanLimits[this.subscription] || 2; // Default to 2 for free plan
};

// Method to update page and word limits based on subscription
UserSchema.methods.updatePageLimits = function() {
  const pageLimitPlans = {
    // Standard plans (unlimited pages, except free gets 12 pages)
    'free': 12,
    'beta': null,
    'single': null,
    'single_promo': null,
    'bundle5': null,
    'bundle5_promo': null,
    'bundle10': null,
    'bundle10_promo': null,
    'bundle20': null,
    'bundle20_promo': null,
    'poweruser': null,
    'poweruser_promo': null,
    'agency': null,
    'agency_promo': null,
    'additional': null,
    'custom': null,
    // Ebook plans (unlimited pages but word limited)
    'eSingle': null,
    'eSingle_promo': null,
    'ebundle5_promo': null,
    'ebundle10_promo': null,
    'ebundle20_promo': null,
    'epoweruser_promo': null,
    'eagency_promo': null,
    // Full service plans (unlimited pages)
    'fullService_promo': null,
    'fullServicePlus_promo': null,
    // Add-ons (no page limit change)
    'images_addon_100': null
  };

  const wordLimitPlans = {
    // Standard plans (unlimited words)
    'free': null,
    'beta': null,
    'single': null,
    'single_promo': null,
    'bundle5': null,
    'bundle5_promo': null,
    'bundle10': null,
    'bundle10_promo': null,
    'bundle20': null,
    'bundle20_promo': null,
    'poweruser': null,
    'poweruser_promo': null,
    'agency': null,
    'agency_promo': null,
    'additional': null,
    'custom': null,
    // Ebook plans (10,000 word limit)
    'eSingle': 10000,
    'eSingle_promo': 10000,
    'ebundle5_promo': 10000,
    'ebundle10_promo': 10000,
    'ebundle20_promo': 10000,
    'epoweruser_promo': 10000,
    'eagency_promo': 10000,
    // Full service plans (unlimited words)
    'fullService_promo': null,
    'fullServicePlus_promo': null,
    // Add-ons (no word limit change)
    'images_addon_100': null
  };

  this.pageLimit = pageLimitPlans[this.subscription];
  this.wordLimit = wordLimitPlans[this.subscription];
};

// Method to get total image limit
UserSchema.methods.getTotalImageLimit = function() {
  return this.imagesAllowed + this.additionalImageSlots;
};

// Method to check if user can upload more images
UserSchema.methods.canUploadImages = function() {
  return this.imagesUsed < this.getTotalImageLimit();
};

// Pre-save hook to update books allowance when subscription changes
UserSchema.pre('save', function(next) {
  if (this.isModified('subscription')) {
    this.updateBooksAllowance();
    this.updateImageLimits();
    this.updatePageLimits();
  }
  next();
});

module.exports = mongoose.model('User', UserSchema); 