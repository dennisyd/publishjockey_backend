const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const CommissionCalculator = require('commission-calculator');

class PaymentService {
  /**
   * Process PayPal payout
   */
  async processPayPalPayout(affiliate, amount, commissionId) {
    try {
      // PayPal Payout API call
      const payoutData = {
        sender_batch_header: {
          sender_batch_id: `payout_${commissionId}_${Date.now()}`,
          email_subject: "You have a payout from PublishJockey!"
        },
        items: [
          {
            recipient_type: "EMAIL",
            amount: {
              value: amount.toFixed(2),
              currency: "USD"
            },
            receiver: affiliate.payoutInfo.paypalEmail,
            note: `Commission payout for ${commissionId}`,
            sender_item_id: commissionId
          }
        ]
      };

      // Note: You'll need to implement PayPal Payout API integration
      // This is a placeholder for the actual PayPal API call
      console.log('PayPal payout data:', payoutData);
      
      return {
        success: true,
        transactionId: `paypal_${Date.now()}`,
        method: 'paypal',
        amount: amount
      };
    } catch (error) {
      console.error('PayPal payout error:', error);
      throw new Error('PayPal payout failed');
    }
  }

  /**
   * Process Stripe Connect payout
   */
  async processStripePayout(affiliate, amount, commissionId) {
    try {
      // Check if affiliate has Stripe Connect account
      if (!affiliate.payoutInfo.stripeConnect.accountId) {
        throw new Error('Stripe Connect account not set up');
      }

      // Create transfer to connected account
      const transfer = await stripe.transfers.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: 'usd',
        destination: affiliate.payoutInfo.stripeConnect.accountId,
        description: `Commission payout for ${commissionId}`,
        metadata: {
          commissionId: commissionId,
          affiliateId: affiliate._id.toString()
        }
      });

      return {
        success: true,
        transactionId: transfer.id,
        method: 'stripe',
        amount: amount
      };
    } catch (error) {
      console.error('Stripe payout error:', error);
      throw new Error('Stripe payout failed');
    }
  }

  /**
   * Process bank transfer payout
   */
  async processBankTransfer(affiliate, amount, commissionId) {
    try {
      // For bank transfers, you might use Stripe's ACH or wire transfer
      // This is a simplified example
      const bankTransfer = await stripe.transfers.create({
        amount: Math.round(amount * 100),
        currency: 'usd',
        destination: {
          type: 'bank_account',
          account_number: affiliate.payoutInfo.bankInfo.accountNumber,
          routing_number: affiliate.payoutInfo.bankInfo.routingNumber,
          account_holder_name: affiliate.payoutInfo.bankInfo.accountName,
          account_holder_type: 'individual'
        },
        description: `Commission payout for ${commissionId}`,
        metadata: {
          commissionId: commissionId,
          affiliateId: affiliate._id.toString()
        }
      });

      return {
        success: true,
        transactionId: bankTransfer.id,
        method: 'bank_transfer',
        amount: amount
      };
    } catch (error) {
      console.error('Bank transfer error:', error);
      throw new Error('Bank transfer failed');
    }
  }

  /**
   * Process Zelle payout
   */
  async processZellePayout(affiliate, amount, commissionId) {
    try {
      // Zelle payments are typically manual or through bank APIs
      // This is a placeholder for Zelle integration
      console.log('Zelle payout data:', {
        recipient: affiliate.payoutInfo.zelleInfo.emailOrPhone,
        amount: amount,
        commissionId: commissionId
      });

      // In a real implementation, you would integrate with a Zelle API
      // or use your bank's Zelle business API
      
      return {
        success: true,
        transactionId: `zelle_${Date.now()}`,
        method: 'zelle',
        amount: amount
      };
    } catch (error) {
      console.error('Zelle payout error:', error);
      throw new Error('Zelle payout failed');
    }
  }

  /**
   * Process commission payout based on affiliate's preferred method
   */
  async processCommissionPayout(affiliate, commission) {
    try {
      const amount = commission.amount;
      const commissionId = commission._id.toString();

      switch (affiliate.payoutInfo.preferredPaymentMethod) {
        case 'paypal':
          return await this.processPayPalPayout(affiliate, amount, commissionId);
        
        case 'stripe':
          return await this.processStripePayout(affiliate, amount, commissionId);
        
        case 'bank':
          return await this.processBankTransfer(affiliate, amount, commissionId);
        
        case 'zelle':
          return await this.processZellePayout(affiliate, amount, commissionId);
        
        default:
          throw new Error('Invalid payment method');
      }
    } catch (error) {
      console.error('Commission payout error:', error);
      throw error;
    }
  }

  /**
   * Set up Stripe Connect account for affiliate
   */
  async setupStripeConnect(affiliate) {
    try {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'US',
        email: affiliate.userId.email,
        business_type: affiliate.payoutInfo.stripeConnect.businessType,
        business_profile: {
          name: affiliate.payoutInfo.stripeConnect.businessName,
          url: 'https://publishjockey.com'
        },
        capabilities: {
          transfers: { requested: true }
        }
      });

      return {
        success: true,
        accountId: account.id,
        accountLink: await this.createAccountLink(account.id)
      };
    } catch (error) {
      console.error('Stripe Connect setup error:', error);
      throw new Error('Stripe Connect setup failed');
    }
  }

  /**
   * Create Stripe Connect account link for onboarding
   */
  async createAccountLink(accountId) {
    try {
      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${process.env.FRONTEND_URL}/affiliate?refresh=true`,
        return_url: `${process.env.FRONTEND_URL}/affiliate?success=true`,
        type: 'account_onboarding'
      });

      return accountLink.url;
    } catch (error) {
      console.error('Account link creation error:', error);
      throw error;
    }
  }

  /**
   * Get Stripe Connect account status
   */
  async getStripeAccountStatus(accountId) {
    try {
      const account = await stripe.accounts.retrieve(accountId);
      return {
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        details_submitted: account.details_submitted,
        requirements: account.requirements
      };
    } catch (error) {
      console.error('Stripe account status error:', error);
      throw error;
    }
  }

  /**
   * Calculate payout fees
   */
  calculatePayoutFees(amount, method) {
    switch (method) {
      case 'paypal':
        // PayPal fees: 2.9% + $0.30
        return Math.max(0.30, amount * 0.029 + 0.30);
      
      case 'stripe':
        // Stripe Connect fees: 0.25% + $0.25
        return Math.max(0.25, amount * 0.0025 + 0.25);
      
      case 'bank':
        // Bank transfer fees: $0.80
        return 0.80;
      
      case 'zelle':
        // Zelle fees: $0.00 (typically free)
        return 0.00;
      
      default:
        return 0;
    }
  }

  /**
   * Get minimum payout amounts
   */
  getMinimumPayoutAmounts() {
    return {
      paypal: 1.00,
      stripe: 1.00,
      bank: 50.00,
      zelle: 50.00
    };
  }

  /**
   * Check if commission is eligible for monthly payout
   * Payouts occur on the 15th of each month for commissions 60+ days old
   */
  isEligibleForMonthlyPayout(commissionDate) {
    const now = new Date();
    const commissionCreated = new Date(commissionDate);
    const daysSinceCommission = (now - commissionCreated) / (1000 * 60 * 60 * 24);
    
    // Must be at least 60 days old
    if (daysSinceCommission < 60) {
      return false;
    }
    
    // Check if it's the 15th of the month (payout day)
    const isPayoutDay = now.getDate() === 15;
    
    return isPayoutDay;
  }

  /**
   * Get next payout date for a commission
   */
  getNextPayoutDate(commissionDate) {
    const commissionCreated = new Date(commissionDate);
    const sixtyDaysLater = new Date(commissionCreated.getTime() + (60 * 24 * 60 * 60 * 1000));
    
    // Find the next 15th of the month after the 60-day period
    const nextPayoutDate = new Date(sixtyDaysLater);
    nextPayoutDate.setDate(15);
    
    // If the 15th has already passed this month, move to next month
    if (nextPayoutDate < sixtyDaysLater) {
      nextPayoutDate.setMonth(nextPayoutDate.getMonth() + 1);
      nextPayoutDate.setDate(15);
    }
    
    return nextPayoutDate;
  }

  /**
   * Calculate net commission after fees
   */
  calculateNetCommission(grossAmount, paymentMethod) {
    const fees = this.calculatePayoutFees(grossAmount, paymentMethod);
    return Math.max(0, grossAmount - fees);
  }
}

module.exports = new PaymentService();
