const mongoose = require('mongoose');

const ReferralSchema = new mongoose.Schema({
  // Affiliate who made the referral
  affiliateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Affiliate',
    required: true
  },
  
  // Referred user
  referredUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Referral tracking
  affiliateCode: {
    type: String,
    required: true,
    uppercase: true
  },
  
  // Referral source information
  source: {
    type: String,
    enum: ['direct_link', 'email', 'social_media', 'blog', 'other'],
    default: 'direct_link'
  },
  
  // Campaign tracking
  campaign: {
    type: String,
    trim: true
  },
  
  // User agent and IP for fraud detection
  userAgent: {
    type: String
  },
  ipAddress: {
    type: String
  },
  
  // Conversion tracking
  status: {
    type: String,
    enum: ['clicked', 'registered', 'converted', 'expired'],
    default: 'clicked'
  },
  
  // Conversion details
  convertedAt: {
    type: Date
  },
  
  // Sale information (if converted)
  sale: {
    planId: {
      type: String
    },
    planName: {
      type: String
    },
    amount: {
      type: Number
    },
    stripePaymentIntentId: {
      type: String
    }
  },
  
  // Commission information
  commission: {
    amount: {
      type: Number
    },
    rate: {
      type: Number
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'paid', 'cancelled'],
      default: 'pending'
    },
    paidAt: {
      type: Date
    }
  },
  
  // Fraud detection
  fraudScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  
  // Timestamps
  clickedAt: {
    type: Date,
    default: Date.now
  },
  registeredAt: {
    type: Date
  },
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
ReferralSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Index for performance
ReferralSchema.index({ affiliateId: 1, createdAt: -1 });
ReferralSchema.index({ affiliateCode: 1 });
ReferralSchema.index({ status: 1 });

// Calculate commission when sale is recorded
ReferralSchema.methods.calculateCommission = function(saleAmount, commissionRate) {
  this.commission.amount = saleAmount * commissionRate;
  this.commission.rate = commissionRate;
  return this.commission.amount;
};

// Mark as converted
ReferralSchema.methods.markAsConverted = function(saleData) {
  this.status = 'converted';
  this.convertedAt = new Date();
  this.sale = saleData;
};

module.exports = mongoose.model('Referral', ReferralSchema);
