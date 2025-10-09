const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PaymentTransactionSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  stripeSessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  stripePaymentIntentId: {
    type: String,
    index: true
  },
  stripeCustomerId: {
    type: String,
    index: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'usd',
    uppercase: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'succeeded', 'failed', 'canceled', 'refunded'],
    default: 'pending',
    required: true,
    index: true
  },
  planId: {
    type: String,
    required: true
  },
  planName: {
    type: String
  },
  booksAllowed: {
    type: Number
  },
  imagesAllowed: {
    type: Number
  },
  subscriptionDuration: {
    type: String // '3 years', '1 year', etc.
  },
  metadata: {
    type: Object,
    default: {}
  },
  errorMessage: {
    type: String
  },
  refundAmount: {
    type: Number
  },
  refundReason: {
    type: String
  },
  refundedAt: {
    type: Date
  },
  webhookReceived: {
    type: Boolean,
    default: false
  },
  webhookReceivedAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient querying
PaymentTransactionSchema.index({ userId: 1, createdAt: -1 });
PaymentTransactionSchema.index({ status: 1, createdAt: -1 });

// Method to mark transaction as succeeded
PaymentTransactionSchema.methods.markSucceeded = function(paymentIntentId) {
  this.status = 'succeeded';
  this.stripePaymentIntentId = paymentIntentId;
  this.webhookReceived = true;
  this.webhookReceivedAt = new Date();
  return this.save();
};

// Method to mark transaction as failed
PaymentTransactionSchema.methods.markFailed = function(errorMessage) {
  this.status = 'failed';
  this.errorMessage = errorMessage;
  this.webhookReceived = true;
  this.webhookReceivedAt = new Date();
  return this.save();
};

// Method to mark transaction as refunded
PaymentTransactionSchema.methods.markRefunded = function(refundAmount, refundReason) {
  this.status = 'refunded';
  this.refundAmount = refundAmount;
  this.refundReason = refundReason;
  this.refundedAt = new Date();
  return this.save();
};

// Static method to get user's payment history
PaymentTransactionSchema.statics.getUserPaymentHistory = function(userId, limit = 10) {
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('-metadata -__v');
};

// Static method to get successful payments for a user
PaymentTransactionSchema.statics.getUserSuccessfulPayments = function(userId) {
  return this.find({ 
    userId, 
    status: 'succeeded' 
  })
    .sort({ createdAt: -1 })
    .select('-metadata -__v');
};

module.exports = mongoose.model('PaymentTransaction', PaymentTransactionSchema);
