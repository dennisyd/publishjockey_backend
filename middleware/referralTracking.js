const Referral = require('../models/Referral');
const Affiliate = require('../models/Affiliate');

// Middleware to track referral clicks
const trackReferralClick = async (req, res, next) => {
  try {
    const { ref } = req.query;
    
    if (!ref) {
      return next();
    }
    
    // Find affiliate by code
    const affiliate = await Affiliate.findOne({ 
      affiliateCode: ref.toUpperCase(),
      status: 'active'
    });
    
    if (!affiliate) {
      return next();
    }
    
    // Check if this IP has already clicked this affiliate's link recently (fraud prevention)
    const recentClick = await Referral.findOne({
      affiliateId: affiliate._id,
      ipAddress: req.ip,
      clickedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
    });
    
    if (recentClick) {
      // Already tracked this click, just continue
      return next();
    }
    
    // Create referral record
    const referral = new Referral({
      affiliateId: affiliate._id,
      affiliateCode: ref.toUpperCase(),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      source: determineSource(req),
      campaign: req.query.campaign || null
    });
    
    await referral.save();
    
    // Store referral ID in session for later conversion tracking
    req.session.referralId = referral._id;
    
    next();
    
  } catch (error) {
    console.error('Referral tracking error:', error);
    // Don't block the request if tracking fails
    next();
  }
};

// Middleware to track user registration
const trackReferralRegistration = async (req, res, next) => {
  try {
    const referralId = req.session?.referralId;
    
    if (!referralId) {
      return next();
    }
    
    // Update referral with user registration
    const referral = await Referral.findById(referralId);
    if (referral) {
      referral.status = 'registered';
      referral.registeredAt = new Date();
      referral.referredUserId = req.user.id;
      await referral.save();
    }
    
    // Clear referral from session
    delete req.session.referralId;
    
    next();
    
  } catch (error) {
    console.error('Referral registration tracking error:', error);
    next();
  }
};

// Middleware to track conversions (purchases)
const trackReferralConversion = async (req, res, next) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return next();
    }
    
    // Find recent referral for this user
    const referral = await Referral.findOne({
      referredUserId: userId,
      status: 'registered',
      createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
    }).populate('affiliateId');
    
    if (!referral || !referral.affiliateId) {
      return next();
    }
    
    // Update referral status
    referral.status = 'converted';
    referral.convertedAt = new Date();
    
    // Add sale information
    referral.sale = {
      planId: req.body.planId,
      planName: req.body.planName,
      amount: req.body.amount,
      stripePaymentIntentId: req.body.stripePaymentIntentId
    };
    
    // Calculate commission
    const commissionAmount = referral.affiliateId.calculateCommission(req.body.amount);
    referral.commission.amount = commissionAmount;
    referral.commission.rate = referral.affiliateId.commissionRate;
    referral.commission.status = 'pending';
    
    await referral.save();
    
    // Create commission record
    const Commission = require('../models/Commission');
    const commission = new Commission({
      affiliateId: referral.affiliateId._id,
      referralId: referral._id,
      sale: referral.sale,
      amount: commissionAmount,
      rate: referral.affiliateId.commissionRate,
      status: 'pending'
    });
    
    await commission.save();
    
    // Update affiliate stats
    const affiliate = referral.affiliateId;
    affiliate.totalReferrals += 1;
    affiliate.totalSales += req.body.amount;
    affiliate.totalCommissions += commissionAmount;
    await affiliate.save();
    
    next();
    
  } catch (error) {
    console.error('Referral conversion tracking error:', error);
    next();
  }
};

// Helper function to determine referral source
const determineSource = (req) => {
  const userAgent = req.get('User-Agent') || '';
  const referer = req.get('Referer') || '';
  
  if (referer.includes('facebook.com') || userAgent.includes('facebook')) {
    return 'social_media';
  }
  if (referer.includes('twitter.com') || userAgent.includes('twitter')) {
    return 'social_media';
  }
  if (referer.includes('linkedin.com') || userAgent.includes('linkedin')) {
    return 'social_media';
  }
  if (referer.includes('youtube.com') || userAgent.includes('youtube')) {
    return 'social_media';
  }
  if (referer.includes('blog') || referer.includes('wordpress') || referer.includes('medium')) {
    return 'blog';
  }
  if (referer.includes('mail') || referer.includes('email')) {
    return 'email';
  }
  
  return 'direct_link';
};

// Fraud detection helper
const calculateFraudScore = (referral) => {
  let score = 0;
  
  // Check for suspicious patterns
  if (referral.ipAddress) {
    // Add fraud detection logic here
    // This is a basic example - you'd want more sophisticated detection
  }
  
  return Math.min(score, 100);
};

module.exports = {
  trackReferralClick,
  trackReferralRegistration,
  trackReferralConversion,
  determineSource,
  calculateFraudScore
};
