const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Define the subscription plans with their Stripe product/price IDs
// All plans have 3-year validity; pricing set in cents
const SUBSCRIPTION_PLANS = {
  // Regular plans
  single: {
    name: 'Single Book',
    description: 'One-time purchase for a single book (3-year validity)',
    priceId: process.env.STRIPE_SINGLE_PRICE_ID,
    price: 6300, // $63.00
    booksAllowed: 1
  },
  bundle10: {
    name: '10 Book Pack',
    description: 'Publish up to 10 books (3-year validity)',
    priceId: process.env.STRIPE_BUNDLE10_PRICE_ID,
    price: 19900, // $199.00
    booksAllowed: 10
  },
  bundle20: {
    name: '20 Book Pack',
    description: 'Publish up to 20 books (3-year validity)',
    priceId: process.env.STRIPE_BUNDLE20_PRICE_ID,
    price: 29900, // $299.00
    booksAllowed: 20
  },

  // Promo plans
  single_promo: {
    name: 'Single Book — Promo',
    description: 'Launch offer for a single book (3-year validity)',
    priceId: process.env.STRIPE_SINGLE_PROMO_PRICE_ID,
    price: 4900, // $49.00
    booksAllowed: 1
  },
  bundle10_promo: {
    name: '10 Book Pack — Promo',
    description: 'Launch offer for 10 books (3-year validity)',
    priceId: process.env.STRIPE_BUNDLE10_PROMO_PRICE_ID,
    price: 12500, // $125.00
    booksAllowed: 10
  },
  bundle20_promo: {
    name: '20 Book Pack — Promo',
    description: 'Launch offer for 20 books (3-year validity)',
    priceId: process.env.STRIPE_BUNDLE20_PROMO_PRICE_ID,
    price: 19900, // $199.00
    booksAllowed: 20
  },

  // Add-ons
  images_addon_100: {
    name: 'Image Upgrade (+100)',
    description: 'Add 100 images to your allowance',
    priceId: process.env.STRIPE_IMAGES_ADDON_100_PRICE_ID,
    price: 2500, // $25.00
    booksAllowed: 0
  },

  // Other
  additional: {
    name: 'Additional Book',
    description: 'Add more books to your account (3-year validity)',
    priceId: process.env.STRIPE_ADDITIONAL_PRICE_ID,
    price: 3700, // $37.00
    booksAllowed: 1
  }
};

module.exports = {
  stripe,
  SUBSCRIPTION_PLANS
};