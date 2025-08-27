const mongoose = require('mongoose');

const AffiliateSchema = new mongoose.Schema({
  // Basic affiliate information
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  
  // Affiliate identification
  affiliateCode: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  
  // Commission rates (can be customized per affiliate)
  commissionRate: {
    type: Number,
    default: 0.20, // 20% during promo period
    min: 0,
    max: 1
  },
  
  // Affiliate status
  status: {
    type: String,
    enum: ['pending', 'active', 'suspended', 'terminated'],
    default: 'pending'
  },
  
  // Approval information
  approvedAt: {
    type: Date
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Contact information for payouts
  payoutInfo: {
    paypalEmail: {
      type: String,
      trim: true
    },
    stripeConnect: {
      enabled: {
        type: Boolean,
        default: false
      },
      businessName: String,
      businessType: String,
      taxId: String,
      accountId: String,
      verificationStatus: {
        type: String,
        enum: ['pending', 'verified', 'failed'],
        default: 'pending'
      }
    },
    bankInfo: {
      accountName: String,
      accountNumber: String,
      routingNumber: String,
      bankName: String,
      country: {
        type: String,
        default: 'US'
      }
    },
    zelleInfo: {
      emailOrPhone: String
    },
    preferredPaymentMethod: {
      type: String,
      enum: ['paypal', 'stripe', 'bank', 'zelle'],
      default: 'paypal'
    }
  },
  
  // Performance tracking
  totalReferrals: {
    type: Number,
    default: 0
  },
  totalSales: {
    type: Number,
    default: 0
  },
  totalCommissions: {
    type: Number,
    default: 0
  },
  totalPaid: {
    type: Number,
    default: 0
  },
  
  // Marketing materials
  marketingMaterials: {
    banners: [String],
    emailTemplates: [String],
    socialMediaPosts: [String]
  },
  
  // Legal agreement
  agreementAccepted: {
    type: Boolean,
    default: false
  },
  agreementAcceptedAt: {
    type: Date
  },
  
  // Notes and admin information
  notes: {
    type: String
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field on save
AffiliateSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Generate unique affiliate code
AffiliateSchema.methods.generateAffiliateCode = function() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

// Calculate commission for a sale
AffiliateSchema.methods.calculateCommission = function(saleAmount) {
  return saleAmount * this.commissionRate;
};

module.exports = mongoose.model('Affiliate', AffiliateSchema);
