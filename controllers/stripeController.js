const User = require('../models/User');
const PaymentTransaction = require('../models/PaymentTransaction');
const { stripe, SUBSCRIPTION_PLANS, getImagesAllowedForPlan } = require('../config/stripe');
const { isPromoActiveNow } = require('../config/launchOffer');
const crypto = require('crypto');
const Logger = require('../utils/logger');

/**
 * @desc    Create a Stripe checkout session
 * @route   POST /api/stripe/create-checkout-session
 * @access  Private
 */
const createCheckoutSession = async (req, res) => {
  try {
    const { planId, successUrl, cancelUrl } = req.body;
    const userId = req.user.userId;

    // Validate planId
    if (!planId || !SUBSCRIPTION_PLANS[planId]) {
      return res.status(400).json({
        success: false,
        message: 'Invalid plan selected'
      });
    }

    const plan = SUBSCRIPTION_PLANS[planId];
    
    // Validate that the plan has a priceId configured
    if (!plan.priceId) {
      Logger.error('Missing price ID for plan', { planId, plan });
      return res.status(500).json({
        success: false,
        message: `Configuration error: Missing Stripe price ID for plan "${planId}". Please contact support.`
      });
    }

    // Get user first
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Server-side promo enforcement
    const isPromoPlan = ['single_promo', 'bundle5_promo', 'bundle10_promo', 'bundle20_promo', 'poweruser_promo', 'agency_promo'].includes(planId);
    if (isPromoPlan) {
      // Date-only gating
      const promoActive = isPromoActiveNow();
      if (!promoActive) {
        return res.status(400).json({ success: false, message: 'Promotional plans are no longer available.' });
      }
      // One promo redemption per account per promo plan group
      // Fix: Check single first, then check for bundle variants
      let groupKey = 'other';
      if (planId.includes('single') && !planId.includes('bundle')) {
        groupKey = 'single';
      } else if (planId.includes('bundle20')) {
        groupKey = 'bundle20';
      } else if (planId.includes('bundle10')) {
        groupKey = 'bundle10';
      } else if (planId.includes('bundle5')) {
        groupKey = 'bundle5';
      } else if (planId.includes('poweruser')) {
        groupKey = 'poweruser';
      } else if (planId.includes('agency')) {
        groupKey = 'agency';
      }
      
      if (user.promoRedemptions && user.promoRedemptions[groupKey]) {
        return res.status(400).json({ success: false, message: 'You have already redeemed this promotional plan.' });
      }
    }

    // Get or create Stripe customer
    let customerId = user.stripeCustomerId;
    
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: req.user.email,
        metadata: {
          userId: userId
        }
      });
      customerId = customer.id;
      
      // Save customer ID to user
      await User.findByIdAndUpdate(userId, {
        stripeCustomerId: customerId
      });
      
      Logger.info('Created Stripe customer', { userId, customerId });
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer: customerId,
      line_items: [
        {
          price: plan.priceId,
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/pricing`,
      metadata: {
        userId: userId,
        planId: planId,
        planName: plan.name,
        booksAllowed: plan.booksAllowed.toString(),
        imagesAllowed: plan.imagesAllowed.toString()
      }
    });

    // Create payment transaction record
    await PaymentTransaction.create({
      userId: userId,
      stripeSessionId: session.id,
      stripeCustomerId: customerId,
      amount: plan.price,
      currency: 'usd',
      status: 'pending',
      planId: planId,
      planName: plan.name,
      booksAllowed: plan.booksAllowed,
      imagesAllowed: plan.imagesAllowed,
      subscriptionDuration: (planId.includes('poweruser') || planId.includes('agency')) ? '1 year' : '3 years',
      metadata: {
        sessionUrl: session.url,
        createdFrom: 'checkout'
      }
    });

    Logger.info('Created checkout session', { 
      userId, 
      planId, 
      sessionId: session.id,
      customerId 
    });

    res.status(200).json({
      success: true,
      sessionId: session.id,
      url: session.url
    });
  } catch (error) {
    console.error('Create checkout session error:', error);
    
    // Check if this is a Stripe price ID error
    if (error.type === 'StripeInvalidRequestError' && error.code === 'resource_missing') {
      const isTestKey = process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_');
      const isLiveKey = process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_');
      
      Logger.error('Stripe price ID mismatch', {
        error: error.message,
        keyMode: isTestKey ? 'test' : isLiveKey ? 'live' : 'unknown',
        planId: req.body.planId
      });
      
      return res.status(500).json({
        success: false,
        message: isTestKey 
          ? 'Configuration error: Test mode Stripe key is being used with live mode price IDs. Please create test mode prices in Stripe Dashboard or switch to live mode.'
          : 'Configuration error: The price ID for this plan does not exist in Stripe. Please check your Stripe configuration.',
        error: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to create checkout session',
      error: error.message
    });
  }
};

/**
 * @desc    Handle Stripe webhook events
 * @route   POST /api/stripe/webhook
 * @access  Public
 */
const handleWebhookEvent = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  // Check if webhook secret is configured
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    Logger.error('STRIPE_WEBHOOK_SECRET is not configured in environment variables');
    return res.status(500).send('Webhook secret not configured');
  }
  
  // Debug logging
  Logger.debug('Webhook request received', {
    hasSignature: !!sig,
    hasBody: !!req.body,
    bodyType: typeof req.body,
    secretPrefix: process.env.STRIPE_WEBHOOK_SECRET?.substring(0, 10) + '...',
    signaturePrefix: sig?.substring(0, 20) + '...'
  });

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    
    Logger.info('✅ Webhook signature verified successfully', { eventType: event.type, eventId: event.id });
  } catch (err) {
    Logger.error('❌ Webhook signature verification FAILED', { 
      error: err.message,
      errorType: err.type,
      hasSignature: !!sig,
      hasBody: !!req.body,
      bodyIsBuffer: Buffer.isBuffer(req.body),
      webhookSecretConfigured: !!process.env.STRIPE_WEBHOOK_SECRET,
      webhookSecretPrefix: process.env.STRIPE_WEBHOOK_SECRET?.substring(0, 10),
      hint: 'Make sure STRIPE_WEBHOOK_SECRET matches the secret from Stripe CLI output'
    });
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object);
        break;
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
      case 'charge.refunded':
        await handleChargeRefunded(event.data.object);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object);
        break;
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
        break;
      default:
        Logger.info(`Unhandled event type ${event.type}`);
    }
  } catch (error) {
    Logger.error('Error handling webhook event', { 
      eventType: event.type, 
      error: error.message 
    });
    // Still return 200 to acknowledge receipt
  }

  res.status(200).json({ received: true });
};

const handleCheckoutSessionCompleted = async (session) => {
  try {
    Logger.info('=== WEBHOOK: Checkout session completed ===', {
      sessionId: session.id,
      metadata: session.metadata
    });
    
    const { userId, planId } = session.metadata;
    
    const plan = SUBSCRIPTION_PLANS[planId];

    if (!userId || !planId || !plan) {
      Logger.error('Invalid session metadata', { 
        metadata: session.metadata,
        availablePlans: Object.keys(SUBSCRIPTION_PLANS)
      });
      return;
    }

    // Find and update payment transaction
    const transaction = await PaymentTransaction.findOne({ stripeSessionId: session.id });
    if (transaction) {
      await transaction.markSucceeded(session.payment_intent);
      Logger.info('Payment transaction marked as succeeded', { 
        transactionId: transaction._id,
        sessionId: session.id
      });
    }

    // Update user subscription
    let update = {
      lastPaymentDate: new Date(),
      paymentStatus: 'paid',
      stripeCustomerId: session.customer
    };

    if (planId === 'images_addon_100') {
      // Add-on: increment additional image slots
      update = {
        ...update,
        $inc: { additionalImageSlots: 100 }
      };
      Logger.info('Added image addon to user', { userId, slotsAdded: 100 });
    } else {
      // Plan purchase - determine duration based on plan type
      const isPowerUserOrAgency = planId.includes('poweruser') || planId.includes('agency');
      const durationYears = isPowerUserOrAgency ? 1 : 3;
      
      update = {
        ...update,
        subscription: planId,
        booksAllowed: plan.booksAllowed,
        booksRemaining: plan.booksAllowed,
        subscriptionExpires: new Date(Date.now() + (durationYears * 365 * 24 * 60 * 60 * 1000)),
        imagesAllowed: getImagesAllowedForPlan(planId)
      };
    }

    const updatedUser = await User.findByIdAndUpdate(userId, update, { new: true });

    // Mark promo redemption if applicable
    const isPromo = ['single_promo', 'bundle5_promo', 'bundle10_promo', 'bundle20_promo', 'poweruser_promo', 'agency_promo'].includes(planId);
    if (isPromo) {
      // Fix: Check single first, then check for bundle variants
      let groupKey = 'other';
      if (planId.includes('single') && !planId.includes('bundle')) {
        groupKey = 'single';
      } else if (planId.includes('bundle20')) {
        groupKey = 'bundle20';
      } else if (planId.includes('bundle10')) {
        groupKey = 'bundle10';
      } else if (planId.includes('bundle5')) {
        groupKey = 'bundle5';
      } else if (planId.includes('poweruser')) {
        groupKey = 'poweruser';
      } else if (planId.includes('agency')) {
        groupKey = 'agency';
      }
      
      await User.findByIdAndUpdate(userId, {
        $set: { [`promoRedemptions.${groupKey}`]: true }
      });
      
      Logger.info('Promo redemption marked', { userId, planId, groupKey });
    }

    Logger.info('User subscription updated successfully', {
      userId,
      planId,
      subscription: updatedUser.subscription,
      booksAllowed: updatedUser.booksAllowed,
      booksRemaining: updatedUser.booksRemaining
    });
  } catch (error) {
    Logger.error('Error handling checkout session completed', { 
      error: error.message,
      stack: error.stack
    });
  }
};

const handlePaymentIntentSucceeded = async (paymentIntent) => {
  try {
    Logger.info('Payment intent succeeded', { paymentIntentId: paymentIntent.id });
    
    // Update transaction if exists
    const transaction = await PaymentTransaction.findOne({ 
      stripePaymentIntentId: paymentIntent.id 
    });
    
    if (transaction && transaction.status !== 'succeeded') {
      await transaction.markSucceeded(paymentIntent.id);
      Logger.info('Transaction updated to succeeded', { transactionId: transaction._id });
    }
  } catch (error) {
    Logger.error('Error handling payment intent succeeded', { error: error.message });
  }
};

const handlePaymentFailed = async (paymentIntent) => {
  try {
    Logger.error('Payment intent failed', { 
      paymentIntentId: paymentIntent.id,
      error: paymentIntent.last_payment_error
    });
    
    // Update transaction if exists
    const transaction = await PaymentTransaction.findOne({ 
      stripePaymentIntentId: paymentIntent.id 
    });
    
    if (transaction) {
      await transaction.markFailed(
        paymentIntent.last_payment_error?.message || 'Payment failed'
      );
      Logger.info('Transaction marked as failed', { transactionId: transaction._id });
    }
  } catch (error) {
    Logger.error('Error handling payment failed', { error: error.message });
  }
};

const handleChargeRefunded = async (charge) => {
  try {
    Logger.info('Charge refunded', { chargeId: charge.id });
    
    // Find transaction by payment intent
    const transaction = await PaymentTransaction.findOne({ 
      stripePaymentIntentId: charge.payment_intent 
    });
    
    if (transaction) {
      await transaction.markRefunded(
        charge.amount_refunded,
        'Charge refunded by Stripe'
      );
      
      // Update user payment status
      await User.findByIdAndUpdate(transaction.userId, {
        paymentStatus: 'refunded'
      });
      
      Logger.info('Transaction and user updated for refund', { 
        transactionId: transaction._id,
        userId: transaction.userId
      });
    }
  } catch (error) {
    Logger.error('Error handling charge refunded', { error: error.message });
  }
};

const handleSubscriptionUpdated = async (subscription) => {
  try {
    Logger.info('Subscription updated', { subscriptionId: subscription.id });
    
    // Find user by Stripe customer ID
    const user = await User.findOne({ stripeCustomerId: subscription.customer });
    
    if (user) {
      // Update subscription status based on Stripe subscription status
      if (subscription.status === 'active') {
        user.paymentStatus = 'paid';
      } else if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
        user.paymentStatus = 'failed';
      }
      
      await user.save();
      Logger.info('User subscription status updated', { 
        userId: user._id,
        status: subscription.status
      });
    }
  } catch (error) {
    Logger.error('Error handling subscription updated', { error: error.message });
  }
};

const handleSubscriptionDeleted = async (subscription) => {
  try {
    Logger.info('Subscription deleted', { subscriptionId: subscription.id });
    
    // Find user by Stripe customer ID
    const user = await User.findOne({ stripeCustomerId: subscription.customer });
    
    if (user) {
      // Mark subscription as expired
      user.subscriptionExpires = new Date();
      user.paymentStatus = 'none';
      user.stripeSubscriptionId = null;
      
      await user.save();
      Logger.info('User subscription marked as expired', { userId: user._id });
    }
  } catch (error) {
    Logger.error('Error handling subscription deleted', { error: error.message });
  }
};

const handleInvoicePaymentSucceeded = async (invoice) => {
  try {
    Logger.info('Invoice payment succeeded', { invoiceId: invoice.id });
    
    // Find user by Stripe customer ID
    const user = await User.findOne({ stripeCustomerId: invoice.customer });
    
    if (user) {
      user.lastPaymentDate = new Date();
      user.paymentStatus = 'paid';
      await user.save();
      
      Logger.info('User payment date updated', { userId: user._id });
    }
  } catch (error) {
    Logger.error('Error handling invoice payment succeeded', { error: error.message });
  }
};

const handleInvoicePaymentFailed = async (invoice) => {
  try {
    Logger.error('Invoice payment failed', { invoiceId: invoice.id });
    
    // Find user by Stripe customer ID
    const user = await User.findOne({ stripeCustomerId: invoice.customer });
    
    if (user) {
      user.paymentStatus = 'failed';
      await user.save();
      
      Logger.info('User payment status updated to failed', { userId: user._id });
    }
  } catch (error) {
    Logger.error('Error handling invoice payment failed', { error: error.message });
  }
};

/**
 * @desc    Verify payment success and session details
 * @route   GET /api/stripe/verify-session/:sessionId
 * @access  Private
 */
const verifySession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required'
      });
    }

    // Retrieve session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Get user details
    const user = await User.findById(req.user.userId);
    const plan = SUBSCRIPTION_PLANS[session.metadata?.planId] || SUBSCRIPTION_PLANS.single;

    res.status(200).json({
      success: true,
      session: {
        id: session.id,
        status: session.status,
        paymentStatus: session.payment_status
      },
      plan: {
        id: session.metadata?.planId || 'author',
        name: plan.name,
        booksAllowed: plan.booksAllowed
      },
      user: {
        subscription: user?.subscription || 'author',
        booksAllowed: user?.booksAllowed || 1,
        booksRemaining: user?.booksRemaining || 1,
        subscriptionExpires: user?.subscriptionExpires || new Date(Date.now() + (3 * 365 * 24 * 60 * 60 * 1000))
      }
    });
  } catch (error) {
    console.error('Verify session error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify session',
      error: error.message
    });
  }
};

/**
 * @desc    Manually verify and process a completed payment
 * @route   POST /api/stripe/manual-verify
 * @access  Private
 */
const manualVerifyPayment = async (req, res) => {
  try {
    const { sessionId, planId } = req.body;
    
    if (!sessionId || !planId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID and Plan ID are required'
      });
    }

    // Retrieve session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    if (!session || session.payment_status !== 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Payment not completed'
      });
    }

    const plan = SUBSCRIPTION_PLANS[planId];
    if (!plan) {
      return res.status(400).json({
        success: false,
        message: 'Invalid plan ID'
      });
    }

    // Update user subscription (3-year validity)
    const updatedUser = await User.findByIdAndUpdate(req.user.userId, {
      subscription: planId,
      booksAllowed: plan.booksAllowed,
      booksRemaining: plan.booksAllowed,
      subscriptionExpires: new Date(Date.now() + (3 * 365 * 24 * 60 * 60 * 1000)), // 3 years
      lastPaymentDate: new Date(),
      paymentStatus: 'paid'
    }, { new: true });

    console.log(`Manual verification: User ${req.user.userId} updated to ${planId}`);

    res.status(200).json({
      success: true,
      message: 'Payment verified and subscription updated',
      user: {
        subscription: updatedUser.subscription,
        booksAllowed: updatedUser.booksAllowed,
        booksRemaining: updatedUser.booksRemaining
      }
    });
  } catch (error) {
    console.error('Error in manual verification:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying payment'
    });
  }
};

/**
 * @desc    Get user's payment history
 * @route   GET /api/stripe/payment-history
 * @access  Private
 */
const getPaymentHistory = async (req, res) => {
  try {
    const userId = req.user.userId;
    const limit = parseInt(req.query.limit) || 10;
    
    const payments = await PaymentTransaction.getUserPaymentHistory(userId, limit);
    
    res.status(200).json({
      success: true,
      count: payments.length,
      payments
    });
  } catch (error) {
    Logger.error('Get payment history error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve payment history',
      error: error.message
    });
  }
};

/**
 * @desc    Get current subscription details
 * @route   GET /api/stripe/subscription
 * @access  Private
 */
const getSubscription = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const user = await User.findById(userId).select(
      'subscription booksAllowed booksRemaining subscriptionExpires imagesAllowed imagesUsed additionalImageSlots paymentStatus lastPaymentDate'
    );
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Get plan details
    const plan = SUBSCRIPTION_PLANS[user.subscription] || null;
    
    res.status(200).json({
      success: true,
      subscription: {
        planId: user.subscription,
        planName: plan?.name || user.subscription,
        booksAllowed: user.booksAllowed,
        booksRemaining: user.booksRemaining,
        imagesAllowed: user.imagesAllowed,
        imagesUsed: user.imagesUsed,
        additionalImageSlots: user.additionalImageSlots,
        totalImageLimit: user.getTotalImageLimit(),
        subscriptionExpires: user.subscriptionExpires,
        paymentStatus: user.paymentStatus,
        lastPaymentDate: user.lastPaymentDate,
        isActive: user.subscriptionExpires > new Date()
      }
    });
  } catch (error) {
    Logger.error('Get subscription error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve subscription details',
      error: error.message
    });
  }
};

/**
 * @desc    Create Stripe Customer Portal session
 * @route   POST /api/stripe/create-portal-session
 * @access  Private
 */
const createPortalSession = async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const user = await User.findById(userId);
    if (!user || !user.stripeCustomerId) {
      return res.status(400).json({
        success: false,
        message: 'No Stripe customer found for this user'
      });
    }
    
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard`,
    });
    
    res.status(200).json({
      success: true,
      url: session.url
    });
  } catch (error) {
    Logger.error('Create portal session error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to create customer portal session',
      error: error.message
    });
  }
};

module.exports = {
  createCheckoutSession,
  handleWebhookEvent,
  verifySession,
  manualVerifyPayment,
  getPaymentHistory,
  getSubscription,
  createPortalSession
}; 
