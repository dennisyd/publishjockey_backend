const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Define the subscription plans with their Stripe product/price IDs
// All plans have 3-year validity except poweruser/agency (1-year); pricing set in cents
const SUBSCRIPTION_PLANS = {
  // Regular plans
  single: {
    name: 'Single Book',
    description: 'One-time purchase for a single book (3-year validity)',
    priceId: process.env.STRIPE_SINGLE_PRICE_ID,
    price: 9300, // $93.00
    booksAllowed: 1,
    imagesAllowed: 12
  },
  bundle5: {
    name: '5 Book Pack',
    description: 'Publish up to 5 books (3-year validity)',
    priceId: process.env.STRIPE_BUNDLE5_PRICE_ID,
    price: 19900, // $199.00
    booksAllowed: 5,
    imagesAllowed: 50
  },
  bundle10: {
    name: '10 Book Pack',
    description: 'Publish up to 10 books (3-year validity)',
    priceId: process.env.STRIPE_BUNDLE10_PRICE_ID,
    price: 34900, // $349.00
    booksAllowed: 10,
    imagesAllowed: 100
  },
  bundle20: {
    name: '20 Book Pack',
    description: 'Publish up to 20 books (3-year validity)',
    priceId: process.env.STRIPE_BUNDLE20_PRICE_ID,
    price: 59900, // $599.00
    booksAllowed: 20,
    imagesAllowed: 200
  },
  poweruser: {
    name: 'Power User',
    description: 'For prolific authors (1-year validity)',
    priceId: process.env.STRIPE_POWERUSER_PRICE_ID,
    price: 118800, // $1,188.00
    booksAllowed: 48,
    imagesAllowed: 480
  },
  agency: {
    name: 'Agency',
    description: 'For publishing agencies (1-year validity)',
    priceId: process.env.STRIPE_AGENCY_PRICE_ID,
    price: 298800, // $2,988.00
    booksAllowed: 180,
    imagesAllowed: 1800
  },

  // Promo plans
  single_promo: {
    name: 'Single Book — Promo',
    description: 'Launch offer for a single book (3-year validity)',
    priceId: process.env.STRIPE_SINGLE_PROMO_PRICE_ID,
    price: 6300, // $63.00
    booksAllowed: 1,
    imagesAllowed: 11
  },
  bundle5_promo: {
    name: '5 Book Pack — Promo',
    description: 'Launch offer for 5 books (3-year validity)',
    priceId: process.env.STRIPE_BUNDLE5_PROMO_PRICE_ID,
    price: 14900, // $149.00
    booksAllowed: 5,
    imagesAllowed: 55
  },
  bundle10_promo: {
    name: '10 Book Pack — Promo',
    description: 'Launch offer for 10 books (3-year validity)',
    priceId: process.env.STRIPE_BUNDLE10_PROMO_PRICE_ID,
    price: 29900, // $299.00
    booksAllowed: 10,
    imagesAllowed: 110
  },
  bundle20_promo: {
    name: '20 Book Pack — Promo',
    description: 'Launch offer for 20 books (3-year validity)',
    priceId: process.env.STRIPE_BUNDLE20_PROMO_PRICE_ID,
    price: 54900, // $549.00
    booksAllowed: 20,
    imagesAllowed: 220
  },
  poweruser_promo: {
    name: 'Power User — Promo',
    description: 'Launch offer for prolific authors (1-year validity)',
    priceId: process.env.STRIPE_POWERUSER_PROMO_PRICE_ID,
    price: 94800, // $948.00
    booksAllowed: 48,
    imagesAllowed: 528
  },
  agency_promo: {
    name: 'Agency — Promo',
    description: 'Launch offer for publishing agencies (1-year validity)',
    priceId: process.env.STRIPE_AGENCY_PROMO_PRICE_ID,
    price: 200000, // $2,000.00
    booksAllowed: 180,
    imagesAllowed: 1980
  },

  // Add-ons
  images_addon_100: {
    name: 'Image Upgrade (+100)',
    description: 'Add 100 images to your allowance',
    priceId: process.env.STRIPE_IMAGES_ADDON_100_PRICE_ID,
    price: 2500, // $25.00
    booksAllowed: 0,
    imagesAllowed: 100
  },

  // Other
  additional: {
    name: 'Additional Book',
    description: 'Add more books to your account (3-year validity)',
    priceId: process.env.STRIPE_ADDITIONAL_PRICE_ID,
    price: 3700, // $37.00
    booksAllowed: 1,
    imagesAllowed: 10
  }
};

// Helper function to get images allowed for a plan
const getImagesAllowedForPlan = (planId) => {
  const map = {
    'free': 2,
    'single': 12,
    'bundle5': 50,
    'bundle10': 100,
    'bundle20': 200,
    'poweruser': 480,
    'agency': 1800,
    'single_promo': 11,
    'bundle5_promo': 55,
    'bundle10_promo': 110,
    'bundle20_promo': 220,
    'poweruser_promo': 528,
    'agency_promo': 1980,
    'additional': 10
  };
  return map[planId] ?? 2;
};

module.exports = {
  stripe,
  SUBSCRIPTION_PLANS,
  getImagesAllowedForPlan
};