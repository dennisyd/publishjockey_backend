const express = require('express');
const router = express.Router();
const Affiliate = require('../models/Affiliate');
const Referral = require('../models/Referral');
const Commission = require('../models/Commission');
const User = require('../models/User');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const paymentService = require('../services/paymentService');

// Apply auth middleware to all routes
router.use(verifyToken);

// @route   POST /api/affiliates/register
// @desc    Register as an affiliate
// @access  Private
router.post('/register', async (req, res) => {
  try {
    const { paypalEmail, bankInfo } = req.body;
    
    // Check if user is already an affiliate
    const existingAffiliate = await Affiliate.findOne({ userId: req.user.id });
    if (existingAffiliate) {
      return res.status(400).json({ 
        success: false, 
        message: 'You are already registered as an affiliate' 
      });
    }
    
    // Generate unique affiliate code
    let affiliateCode;
    let isUnique = false;
    while (!isUnique) {
      affiliateCode = Math.random().toString(36).substring(2, 10).toUpperCase();
      const existing = await Affiliate.findOne({ affiliateCode });
      if (!existing) {
        isUnique = true;
      }
    }
    
    // Create affiliate record
    const affiliate = new Affiliate({
      userId: req.user.id,
      affiliateCode,
      payoutInfo: {
        paypalEmail,
        bankInfo,
        stripeConnect,
        preferredPaymentMethod
      },
      agreementAccepted: true,
      agreementAcceptedAt: new Date()
    });
    
    await affiliate.save();
    
    res.json({
      success: true,
      message: 'Affiliate registration submitted successfully',
      affiliate: {
        id: affiliate._id,
        affiliateCode: affiliate.affiliateCode,
        status: affiliate.status
      }
    });
    
  } catch (error) {
    console.error('Affiliate registration error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during affiliate registration' 
    });
  }
});

// @route   GET /api/affiliates/profile
// @desc    Get affiliate profile and stats
// @access  Private
router.get('/profile', async (req, res) => {
  try {
    const affiliate = await Affiliate.findOne({ userId: req.user.id })
      .populate('userId', 'name email');
    
    if (!affiliate) {
      return res.status(404).json({ 
        success: false, 
        message: 'Affiliate profile not found' 
      });
    }
    
    // Get recent referrals
    const recentReferrals = await Referral.find({ affiliateId: affiliate._id })
      .sort({ createdAt: -1 })
      .limit(10);
    
    // Get pending commissions
    const pendingCommissions = await Commission.find({ 
      affiliateId: affiliate._id, 
      status: 'pending' 
    }).sort({ createdAt: -1 });
    
    // Get approved commissions ready for payout
    const eligibleCommissions = await Commission.find({ 
      affiliateId: affiliate._id, 
      status: 'approved',
      eligibleForPayout: { $lte: new Date() }
    }).sort({ eligibleForPayout: 1 });
    
    // Calculate expected payout (after fees)
    const expectedPayout = eligibleCommissions.reduce((total, commission) => {
      const netAmount = commission.calculateNetCommission(
        affiliate.payoutInfo.preferredPaymentMethod
      );
      return total + netAmount;
    }, 0);
    
    res.json({
      success: true,
      affiliate: {
        id: affiliate._id,
        affiliateCode: affiliate.affiliateCode,
        status: affiliate.status,
        commissionRate: affiliate.commissionRate,
        totalReferrals: affiliate.totalReferrals,
        totalSales: affiliate.totalSales,
        totalCommissions: affiliate.totalCommissions,
        totalPaid: affiliate.totalPaid,
        expectedPayout: expectedPayout,
        payoutInfo: affiliate.payoutInfo,
        createdAt: affiliate.createdAt
      },
      recentReferrals,
      pendingCommissions,
      eligibleCommissions
    });
    
  } catch (error) {
    console.error('Get affiliate profile error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error retrieving affiliate profile' 
    });
  }
});

// @route   GET /api/affiliates/referrals
// @desc    Get affiliate referrals with pagination
// @access  Private
router.get('/referrals', async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    
    const affiliate = await Affiliate.findOne({ userId: req.user.id });
    if (!affiliate) {
      return res.status(404).json({ 
        success: false, 
        message: 'Affiliate profile not found' 
      });
    }
    
    // Build query
    const query = { affiliateId: affiliate._id };
    if (status) {
      query.status = status;
    }
    
    const referrals = await Referral.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('referredUserId', 'name email createdAt');
    
    const total = await Referral.countDocuments(query);
    
    res.json({
      success: true,
      referrals,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
    
  } catch (error) {
    console.error('Get referrals error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error retrieving referrals' 
    });
  }
});

// @route   GET /api/affiliates/commissions
// @desc    Get affiliate commissions with pagination
// @access  Private
router.get('/commissions', async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    
    const affiliate = await Affiliate.findOne({ userId: req.user.id });
    if (!affiliate) {
      return res.status(404).json({ 
        success: false, 
        message: 'Affiliate profile not found' 
      });
    }
    
    // Build query
    const query = { affiliateId: affiliate._id };
    if (status) {
      query.status = status;
    }
    
    const commissions = await Commission.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('referralId');
    
    const total = await Commission.countDocuments(query);
    
    res.json({
      success: true,
      commissions,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
    
  } catch (error) {
    console.error('Get commissions error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error retrieving commissions' 
    });
  }
});

// @route   PUT /api/affiliates/payout-info
// @desc    Update affiliate payout information
// @access  Private
router.put('/payout-info', async (req, res) => {
  try {
    const { paypalEmail, bankInfo } = req.body;
    
    const affiliate = await Affiliate.findOne({ userId: req.user.id });
    if (!affiliate) {
      return res.status(404).json({ 
        success: false, 
        message: 'Affiliate profile not found' 
      });
    }
    
    affiliate.payoutInfo = {
      paypalEmail,
      bankInfo
    };
    
    await affiliate.save();
    
    res.json({
      success: true,
      message: 'Payout information updated successfully'
    });
    
  } catch (error) {
    console.error('Update payout info error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error updating payout information' 
    });
  }
});

// @route   GET /api/affiliates/tracking-link/:code
// @desc    Get tracking link for affiliate code
// @access  Private
router.get('/tracking-link/:code', async (req, res) => {
  try {
    const { code } = req.params;
    
    const affiliate = await Affiliate.findOne({ 
      userId: req.user.id,
      affiliateCode: code.toUpperCase()
    });
    
    if (!affiliate) {
      return res.status(404).json({ 
        success: false, 
        message: 'Affiliate code not found' 
      });
    }
    
    const trackingLink = `${process.env.FRONTEND_URL}/register?ref=${code}`;
    
    res.json({
      success: true,
      trackingLink,
      affiliateCode: code.toUpperCase()
    });
    
  } catch (error) {
    console.error('Get tracking link error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error generating tracking link' 
    });
  }
});

// Admin routes
// @route   GET /api/affiliates/admin/all
// @desc    Get all affiliates (admin only)
// @access  Admin
router.get('/admin/all', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    
    const query = {};
    if (status) {
      query.status = status;
    }
    
    const affiliates = await Affiliate.find(query)
      .populate('userId', 'name email createdAt')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Affiliate.countDocuments(query);
    
    res.json({
      success: true,
      affiliates,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
    
  } catch (error) {
    console.error('Get all affiliates error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error retrieving affiliates' 
    });
  }
});

// @route   PUT /api/affiliates/admin/:id/approve
// @desc    Approve affiliate (admin only)
// @access  Admin
router.put('/admin/:id/approve', requireAdmin, async (req, res) => {
  try {
    const affiliate = await Affiliate.findById(req.params.id);
    if (!affiliate) {
      return res.status(404).json({ 
        success: false, 
        message: 'Affiliate not found' 
      });
    }
    
    affiliate.status = 'active';
    affiliate.approvedAt = new Date();
    affiliate.approvedBy = req.user.id;
    
    await affiliate.save();
    
    res.json({
      success: true,
      message: 'Affiliate approved successfully'
    });
    
  } catch (error) {
    console.error('Approve affiliate error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error approving affiliate' 
    });
  }
});

// @route   PUT /api/affiliates/admin/:id/suspend
// @desc    Suspend affiliate (admin only)
// @access  Admin
router.put('/admin/:id/suspend', requireAdmin, async (req, res) => {
  try {
    const { reason } = req.body;
    
    const affiliate = await Affiliate.findById(req.params.id);
    if (!affiliate) {
      return res.status(404).json({ 
        success: false, 
        message: 'Affiliate not found' 
      });
    }
    
    affiliate.status = 'suspended';
    affiliate.notes = reason || 'Suspended by admin';
    
    await affiliate.save();
    
    res.json({
      success: true,
      message: 'Affiliate suspended successfully'
    });
    
  } catch (error) {
    console.error('Suspend affiliate error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error suspending affiliate' 
    });
  }
});

// @route   POST /api/affiliates/setup-stripe-connect
// @desc    Set up Stripe Connect account for affiliate
// @access  Private
router.post('/setup-stripe-connect', async (req, res) => {
  try {
    const affiliate = await Affiliate.findOne({ userId: req.user.id });
    if (!affiliate) {
      return res.status(404).json({ 
        success: false, 
        message: 'Affiliate profile not found' 
      });
    }

    const result = await paymentService.setupStripeConnect(affiliate);
    
    // Update affiliate with Stripe account ID
    affiliate.payoutInfo.stripeConnect.accountId = result.accountId;
    affiliate.payoutInfo.stripeConnect.enabled = true;
    await affiliate.save();

    res.json({
      success: true,
      accountLink: result.accountLink,
      message: 'Stripe Connect setup initiated'
    });
    
  } catch (error) {
    console.error('Stripe Connect setup error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to set up Stripe Connect' 
    });
  }
});

// @route   POST /api/affiliates/process-payout
// @desc    Process commission payout (admin only)
// @access  Admin
router.post('/process-payout', requireAdmin, async (req, res) => {
  try {
    const { commissionId } = req.body;
    
    const commission = await Commission.findById(commissionId)
      .populate('affiliateId');
    
    if (!commission) {
      return res.status(404).json({ 
        success: false, 
        message: 'Commission not found' 
      });
    }

    if (commission.status !== 'approved') {
      return res.status(400).json({ 
        success: false, 
        message: 'Commission must be approved before payout' 
      });
    }

    if (!commission.isEligibleForPayout()) {
      return res.status(400).json({ 
        success: false, 
        message: 'Commission not yet eligible for payout' 
      });
    }

    const payoutResult = await paymentService.processCommissionPayout(
      commission.affiliateId, 
      commission
    );

    // Update commission as paid
    commission.markAsPaid(payoutResult);
    await commission.save();

    res.json({
      success: true,
      message: 'Payout processed successfully',
      payout: payoutResult
    });
    
  } catch (error) {
    console.error('Payout processing error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to process payout' 
    });
  }
});

module.exports = router;
