const express = require('express');
const router = express.Router();
const Affiliate = require('../models/Affiliate');
const Commission = require('../models/Commission');
const Referral = require('../models/Referral');
const User = require('../models/User');
const { verifyToken, requireAdmin } = require('../middleware/auth');
const paymentService = require('../services/paymentService');
const scheduledPayoutService = require('../services/scheduledPayoutService');

// Apply admin middleware to all routes
router.use(verifyToken, requireAdmin);

/**
 * GET /admin/affiliates/stats
 * Get overall affiliate program statistics
 */
router.get('/stats', async (req, res) => {
  try {
    // Get total affiliates
    const totalAffiliates = await Affiliate.countDocuments();
    const activeAffiliates = await Affiliate.countDocuments({ status: 'active' });
    
    // Get revenue and commission stats
    const commissionStats = await Commission.aggregate([
      {
        $group: {
          _id: null,
          totalCommissions: { $sum: '$amount' },
          totalPaid: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, '$amount', 0] } },
          pendingCommissions: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, '$amount', 0] } }
        }
      }
    ]);
    
    // Get monthly revenue (this would need to be calculated from your sales data)
    const monthlyRevenue = 0; // Placeholder - implement based on your sales model
    
    // Calculate pending payouts
    const pendingPayouts = await Affiliate.aggregate([
      {
        $lookup: {
          from: 'commissions',
          localField: '_id',
          foreignField: 'affiliateId',
          as: 'commissions'
        }
      },
      {
        $addFields: {
          expectedPayout: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: '$commissions',
                    cond: { $eq: ['$$this.status', 'approved'] }
                  }
                },
                as: 'commission',
                in: {
                  $subtract: [
                    '$$commission.amount',
                    { $ifNull: ['$$commission.processingFees', 0] }
                  ]
                }
              }
            }
          }
        }
      },
      {
        $group: {
          _id: null,
          totalPendingPayouts: { $sum: '$expectedPayout' }
        }
      }
    ]);
    
    const stats = {
      totalAffiliates,
      activeAffiliates,
      totalRevenue: monthlyRevenue,
      monthlyRevenue,
      totalCommissions: commissionStats[0]?.totalCommissions || 0,
      totalPaidOut: commissionStats[0]?.totalPaid || 0,
      pendingPayouts: pendingPayouts[0]?.totalPendingPayouts || 0
    };
    
    res.json({ success: true, stats });
  } catch (error) {
    console.error('Error getting affiliate stats:', error);
    res.status(500).json({ success: false, message: 'Failed to get affiliate stats' });
  }
});

/**
 * GET /admin/affiliates
 * Get all affiliates with detailed information
 */
router.get('/affiliates', async (req, res) => {
  try {
    const { page = 1, limit = 50, status } = req.query;
    
    const query = {};
    if (status && status !== 'all') {
      query.status = status;
    }
    
    const affiliates = await Affiliate.find(query)
      .populate('userId', 'email firstName lastName')
      .populate({
        path: 'commissions',
        match: { status: 'approved' },
        select: 'amount processingFees'
      })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });
    
    // Calculate expected payout for each affiliate
    const affiliatesWithPayouts = affiliates.map(affiliate => {
      const expectedPayout = affiliate.commissions.reduce((total, commission) => {
        return total + (commission.amount - (commission.processingFees || 0));
      }, 0);
      
      return {
        ...affiliate.toObject(),
        expectedPayout
      };
    });
    
    const total = await Affiliate.countDocuments(query);
    
    res.json({
      success: true,
      affiliates: affiliatesWithPayouts,
      totalPages: Math.ceil(total / limit),
      currentPage: page
    });
  } catch (error) {
    console.error('Error getting affiliates:', error);
    res.status(500).json({ success: false, message: 'Failed to get affiliates' });
  }
});

/**
 * GET /admin/commissions
 * Get all commissions with filtering
 */
router.get('/commissions', async (req, res) => {
  try {
    const { page = 1, limit = 50, status, affiliateId } = req.query;
    
    const query = {};
    if (status && status !== 'all') {
      query.status = status;
    }
    if (affiliateId) {
      query.affiliateId = affiliateId;
    }
    
    const commissions = await Commission.find(query)
      .populate('affiliateId', 'affiliateCode')
      .populate('referralId', 'source')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });
    
    const total = await Commission.countDocuments(query);
    
    res.json({
      success: true,
      commissions,
      totalPages: Math.ceil(total / limit),
      currentPage: page
    });
  } catch (error) {
    console.error('Error getting commissions:', error);
    res.status(500).json({ success: false, message: 'Failed to get commissions' });
  }
});

/**
 * GET /admin/revenue
 * Get revenue data for charts and reports
 */
router.get('/revenue', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    // Get revenue data for the specified period
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    const revenueData = await Commission.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          revenue: { $sum: '$sale.amount' },
          commissions: { $sum: '$amount' },
          affiliateCount: { $addToSet: '$affiliateId' }
        }
      },
      {
        $addFields: {
          affiliateCount: { $size: '$affiliateCount' }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);
    
    res.json({ success: true, revenue: revenueData });
  } catch (error) {
    console.error('Error getting revenue data:', error);
    res.status(500).json({ success: false, message: 'Failed to get revenue data' });
  }
});

/**
 * PUT /admin/affiliates/:id/status
 * Update affiliate status
 */
router.put('/affiliates/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!['pending', 'active', 'suspended', 'terminated'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    
    const affiliate = await Affiliate.findByIdAndUpdate(
      id,
      { 
        status,
        ...(status === 'active' && { approvedAt: new Date(), approvedBy: req.user._id })
      },
      { new: true }
    );
    
    if (!affiliate) {
      return res.status(404).json({ success: false, message: 'Affiliate not found' });
    }
    
    res.json({ success: true, affiliate });
  } catch (error) {
    console.error('Error updating affiliate status:', error);
    res.status(500).json({ success: false, message: 'Failed to update affiliate status' });
  }
});

/**
 * POST /admin/affiliates/:id/process-payout
 * Process payout for a specific affiliate
 */
router.post('/affiliates/:id/process-payout', async (req, res) => {
  try {
    const { id } = req.params;
    
    const affiliate = await Affiliate.findById(id).populate('userId');
    if (!affiliate) {
      return res.status(404).json({ success: false, message: 'Affiliate not found' });
    }
    
    // Get all approved commissions for this affiliate
    const pendingCommissions = await Commission.find({
      affiliateId: id,
      status: 'approved'
    });
    
    if (pendingCommissions.length === 0) {
      return res.status(400).json({ success: false, message: 'No pending commissions found' });
    }
    
    // Calculate total payout amount
    let totalPayout = 0;
    const commissionIds = [];
    
    for (const commission of pendingCommissions) {
      const netAmount = commission.calculateNetCommission(
        affiliate.payoutInfo.preferredPaymentMethod
      );
      totalPayout += netAmount;
      commissionIds.push(commission._id);
    }
    
    // Check minimum payout threshold
    const minimumAmounts = paymentService.getMinimumPayoutAmounts();
    const minimumAmount = minimumAmounts[affiliate.payoutInfo.preferredPaymentMethod];
    
    if (totalPayout < minimumAmount) {
      return res.status(400).json({ 
        success: false, 
        message: `Payout amount ${totalPayout} below minimum ${minimumAmount}` 
      });
    }
    
    // Process the payout
    const payoutResult = await paymentService.processCommissionPayout(
      affiliate, 
      totalPayout, 
      `admin_${Date.now()}`
    );
    
    // Mark all commissions as paid
    await Commission.updateMany(
      { _id: { $in: commissionIds } },
      { 
        status: 'paid',
        paidAt: new Date(),
        'payout.transactionId': payoutResult.transactionId,
        'payout.method': payoutResult.method
      }
    );
    
    // Update affiliate totals
    await Affiliate.findByIdAndUpdate(id, {
      $inc: {
        totalPaid: totalPayout
      }
    });
    
    res.json({ 
      success: true, 
      message: `Successfully processed payout of $${totalPayout}`,
      payoutResult
    });
    
  } catch (error) {
    console.error('Error processing payout:', error);
    res.status(500).json({ success: false, message: 'Failed to process payout' });
  }
});

/**
 * POST /admin/process-monthly-payouts
 * Process all eligible monthly payouts
 */
router.post('/process-monthly-payouts', async (req, res) => {
  try {
    const results = await scheduledPayoutService.processMonthlyPayouts();
    
    res.json({ 
      success: true, 
      message: 'Monthly payouts processed successfully',
      results
    });
  } catch (error) {
    console.error('Error processing monthly payouts:', error);
    res.status(500).json({ success: false, message: 'Failed to process monthly payouts' });
  }
});

/**
 * GET /admin/affiliates/:id/details
 * Get detailed information for a specific affiliate
 */
router.get('/affiliates/:id/details', async (req, res) => {
  try {
    const { id } = req.params;
    
    const affiliate = await Affiliate.findById(id)
      .populate('userId', 'email firstName lastName')
      .populate({
        path: 'commissions',
        populate: {
          path: 'referralId',
          select: 'source clickedAt'
        }
      });
    
    if (!affiliate) {
      return res.status(404).json({ success: false, message: 'Affiliate not found' });
    }
    
    // Get recent referrals
    const recentReferrals = await Referral.find({ affiliateId: id })
      .populate('referredUserId', 'email')
      .sort({ clickedAt: -1 })
      .limit(10);
    
    res.json({ 
      success: true, 
      affiliate,
      recentReferrals
    });
  } catch (error) {
    console.error('Error getting affiliate details:', error);
    res.status(500).json({ success: false, message: 'Failed to get affiliate details' });
  }
});

module.exports = router;
