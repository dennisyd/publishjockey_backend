const Commission = require('../models/Commission');
const Affiliate = require('../models/Affiliate');
const paymentService = require('./paymentService');

class ScheduledPayoutService {
  /**
   * Process monthly payouts for all eligible commissions
   * This should be run on the 15th of each month
   */
  async processMonthlyPayouts() {
    try {
      console.log('Starting monthly payout processing...');
      
      // Get all approved commissions that are 60+ days old
      const eligibleCommissions = await Commission.find({
        status: 'approved',
        eligibleForPayout: { $lte: new Date() }
      }).populate('affiliateId');
      
      console.log(`Found ${eligibleCommissions.length} eligible commissions for payout`);
      
      const results = {
        processed: 0,
        successful: 0,
        failed: 0,
        errors: []
      };
      
      // Group commissions by affiliate for batch processing
      const commissionsByAffiliate = this.groupCommissionsByAffiliate(eligibleCommissions);
      
      for (const [affiliateId, commissions] of Object.entries(commissionsByAffiliate)) {
        try {
          await this.processAffiliatePayout(affiliateId, commissions);
          results.successful++;
        } catch (error) {
          console.error(`Failed to process payout for affiliate ${affiliateId}:`, error);
          results.failed++;
          results.errors.push({
            affiliateId,
            error: error.message
          });
        }
        results.processed++;
      }
      
      console.log('Monthly payout processing completed:', results);
      return results;
      
    } catch (error) {
      console.error('Error in monthly payout processing:', error);
      throw error;
    }
  }
  
  /**
   * Group commissions by affiliate ID
   */
  groupCommissionsByAffiliate(commissions) {
    const grouped = {};
    
    for (const commission of commissions) {
      const affiliateId = commission.affiliateId._id.toString();
      if (!grouped[affiliateId]) {
        grouped[affiliateId] = [];
      }
      grouped[affiliateId].push(commission);
    }
    
    return grouped;
  }
  
  /**
   * Process payout for a single affiliate
   */
  async processAffiliatePayout(affiliateId, commissions) {
    const affiliate = await Affiliate.findById(affiliateId);
    if (!affiliate) {
      throw new Error(`Affiliate ${affiliateId} not found`);
    }
    
    // Calculate total payout amount
    let totalPayout = 0;
    const commissionIds = [];
    
    for (const commission of commissions) {
      // Calculate net commission after fees
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
      console.log(`Affiliate ${affiliateId} payout ${totalPayout} below minimum ${minimumAmount}, skipping`);
      return;
    }
    
    // Process the payout
    const payoutResult = await paymentService.processCommissionPayout(
      affiliate, 
      totalPayout, 
      `batch_${Date.now()}`
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
    await Affiliate.findByIdAndUpdate(affiliateId, {
      $inc: {
        totalPaid: totalPayout
      }
    });
    
    console.log(`Successfully processed payout of $${totalPayout} for affiliate ${affiliateId}`);
  }
  
  /**
   * Check if today is payout day (15th of month)
   */
  isPayoutDay() {
    const today = new Date();
    return today.getDate() === 15;
  }
  
  /**
   * Get next payout date
   */
  getNextPayoutDate() {
    const today = new Date();
    const nextPayout = new Date(today);
    
    if (today.getDate() >= 15) {
      // Move to next month
      nextPayout.setMonth(nextPayout.getMonth() + 1);
    }
    
    nextPayout.setDate(15);
    return nextPayout;
  }
}

module.exports = new ScheduledPayoutService();
