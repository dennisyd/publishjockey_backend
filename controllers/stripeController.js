const User = require('../models/User');
const { stripe, SUBSCRIPTION_PLANS, getImagesAllowedForPlan } = require('../config/stripe');
const { isPromoActiveNow } = require('../config/launchOffer');
const crypto = require('crypto');

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

    // Server-side promo enforcement
    const isPromoPlan = ['single_promo', 'bundle5_promo', 'bundle10_promo', 'bundle20_promo', 'poweruser_promo', 'agency_promo'].includes(planId);
    if (isPromoPlan) {
      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      // Date-only gating
      const promoActive = isPromoActiveNow();
      if (!promoActive) {
        return res.status(400).json({ success: false, message: 'Promotional plans are no longer available.' });
      }
      // One promo redemption per account per promo plan group
      const groupKey = planId.startsWith('single') ? 'single' : 
                      planId.includes('bundle5') ? 'bundle5' :
                      planId.includes('bundle10') ? 'bundle10' : 
                      planId.includes('bundle20') ? 'bundle20' :
                      planId.includes('poweruser') ? 'poweruser' :
                      planId.includes('agency') ? 'agency' : 'other';
      if (user.promoRedemptions && user.promoRedemptions[groupKey]) {
        return res.status(400).json({ success: false, message: 'You have already redeemed this promotional plan.' });
      }
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
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
        planId: planId
      },
      customer_email: req.user.email,
    });

    res.status(200).json({
      success: true,
      sessionId: session.id,
      url: session.url
    });
  } catch (error) {
    console.error('Create checkout session error:', error);
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

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
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
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.status(200).json({ received: true });
};

const handleCheckoutSessionCompleted = async (session) => {
  try {
    console.log('=== WEBHOOK: Checkout session completed ===');
    console.log('Session metadata:', session.metadata);
    console.log('Session ID:', session.id);
    
    const { userId, planId } = session.metadata;
    console.log('User ID:', userId);
    console.log('Plan ID:', planId);
    
    const plan = SUBSCRIPTION_PLANS[planId];
    console.log('Found plan:', plan);

    if (!userId || !planId || !plan) {
      console.error('Invalid session metadata:', session.metadata);
      console.error('Available plans:', Object.keys(SUBSCRIPTION_PLANS));
      return;
    }

    // Update user subscription (3-year validity for all plans)
    let update = {
      lastPaymentDate: new Date(),
      paymentStatus: 'paid'
    };

    if (planId === 'images_addon_100') {
      // Add-on: increment additional image slots
      update = {
        ...update,
        $inc: { additionalImageSlots: 100 }
      };
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
      const groupKey = planId.startsWith('single') ? 'single' : 
                      planId.includes('bundle5') ? 'bundle5' :
                      planId.includes('bundle10') ? 'bundle10' : 
                      planId.includes('bundle20') ? 'bundle20' :
                      planId.includes('poweruser') ? 'poweruser' :
                      planId.includes('agency') ? 'agency' : 'other';
      await User.findByIdAndUpdate(userId, {
        $set: { [`promoRedemptions.${groupKey}`]: true }
      });
    }

    console.log(`User ${userId} subscription updated to ${planId}`);
    console.log('Updated user:', {
      subscription: updatedUser.subscription,
      booksAllowed: updatedUser.booksAllowed,
      booksRemaining: updatedUser.booksRemaining
    });
  } catch (error) {
    console.error('Error handling checkout session completed:', error);
  }
};

const handlePaymentIntentSucceeded = async (paymentIntent) => {
  console.log('Payment succeeded:', paymentIntent.id);
};

const handlePaymentFailed = async (paymentIntent) => {
  console.log('Payment failed:', paymentIntent.id);
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

module.exports = {
  createCheckoutSession,
  handleWebhookEvent,
  verifySession,
  manualVerifyPayment
}; 