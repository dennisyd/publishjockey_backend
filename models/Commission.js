const mongoose = require('mongoose');

const CommissionSchema = new mongoose.Schema({
  // Affiliate who earned the commission
  affiliateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Affiliate',
    required: true
  },
  
  // Referral that generated this commission
  referralId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Referral',
    required: true
  },
  
  // Sale information
  sale: {
    planId: {
      type: String,
      required: true
    },
    planName: {
      type: String,
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    stripePaymentIntentId: {
      type: String
    }
  },
  
  // Commission details
  amount: {
    type: Number,
    required: true
  },
  
  rate: {
    type: Number,
    required: true
  },
  
  // Commission status
  status: {
    type: String,
    enum: ['pending', 'approved', 'paid', 'cancelled'],
    default: 'pending'
  },
  
  // Payout information
  payout: {
    method: {
      type: String,
      enum: ['paypal', 'bank_transfer', 'stripe'],
      default: 'paypal'
    },
    transactionId: {
      type: String
    },
    paidAt: {
      type: Date
    },
    scheduledFor: {
      type: Date
    }
  },
  
  // 60-day payout delay tracking
  eligibleForPayout: {
    type: Date,
    required: true
  },
  
  // Monthly payout schedule tracking
  nextPayoutDate: {
    type: Date,
    required: true
  },
  
  // Net commission after fees
  netAmount: {
    type: Number,
    required: true
  },
  
  // Payment processing fees
  processingFees: {
    type: Number,
    default: 0
  },
  
  // Admin notes
  notes: {
    type: String
  },
  
  // Fraud detection
  fraudScore: {
    type: Number,
    default: 0
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  approvedAt: {
    type: Date
  },
  paidAt: {
    type: Date
  }
});

// Update the updatedAt field on save
CommissionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Index for performance
CommissionSchema.index({ affiliateId: 1, status: 1 });
CommissionSchema.index({ eligibleForPayout: 1 });
CommissionSchema.index({ status: 1, eligibleForPayout: 1 });

// Calculate eligible payout date and next monthly payout date
CommissionSchema.pre('save', function(next) {
  if (this.isNew) {
    const payoutDate = new Date(this.createdAt);
    payoutDate.setDate(payoutDate.getDate() + 60);
    this.eligibleForPayout = payoutDate;
    
    // Calculate next monthly payout date (15th of month after 60 days)
    const nextPayoutDate = new Date(payoutDate);
    nextPayoutDate.setDate(15);
    
    // If 15th has already passed this month, move to next month
    if (nextPayoutDate < payoutDate) {
      nextPayoutDate.setMonth(nextPayoutDate.getMonth() + 1);
      nextPayoutDate.setDate(15);
    }
    
    this.nextPayoutDate = nextPayoutDate;
  }
  next();
});

// Mark as approved
CommissionSchema.methods.approve = function() {
  this.status = 'approved';
  this.approvedAt = new Date();
};

// Mark as paid
CommissionSchema.methods.markAsPaid = function(payoutInfo) {
  this.status = 'paid';
  this.paidAt = new Date();
  this.payout = { ...this.payout, ...payoutInfo };
};

// Check if eligible for payout
CommissionSchema.methods.isEligibleForPayout = function() {
  return this.status === 'approved' && new Date() >= this.eligibleForPayout;
};

// Check if eligible for monthly payout (15th of month)
CommissionSchema.methods.isEligibleForMonthlyPayout = function() {
  if (!this.isEligibleForPayout()) {
    return false;
  }
  
  const now = new Date();
  const isPayoutDay = now.getDate() === 15;
  
  return this.isEligibleForPayout() && isPayoutDay;
};

// Calculate net commission after fees
CommissionSchema.methods.calculateNetCommission = function(paymentMethod) {
  const paymentService = require('../services/paymentService');
  const fees = paymentService.calculatePayoutFees(this.amount, paymentMethod);
  this.processingFees = fees;
  this.netAmount = Math.max(0, this.amount - fees);
  return this.netAmount;
};

module.exports = mongoose.model('Commission', CommissionSchema);
