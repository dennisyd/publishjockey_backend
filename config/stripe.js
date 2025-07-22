const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Define the subscription plans with their Stripe product/price IDs
const SUBSCRIPTION_PLANS = {
  single: {
    name: 'Single Book',
    description: 'One-time purchase for a single book',
    priceId: process.env.STRIPE_SINGLE_PRICE_ID,
    price: 6300, // $63.00
    booksAllowed: 1
  },
  single_promo: {
    name: 'Single Book Promotion',
    description: 'Special launch offer for a single book',
    priceId: process.env.STRIPE_SINGLE_PROMO_PRICE_ID,
    price: 4900, // $49.00
    booksAllowed: 1
  },
  bundle: {
    name: '10 Book Bundle',
    description: 'Publish up to 10 books',
    priceId: process.env.STRIPE_BUNDLE_PRICE_ID,
    price: 39900, // $399.00
    booksAllowed: 10
  },
  bundle_promo: {
    name: '10 Book Bundle Promotion',
    description: 'Special launch offer for 10 books',
    priceId: process.env.STRIPE_BUNDLE_PROMO_PRICE_ID,
    price: 12500, // $125.00
    booksAllowed: 10
  },
  bundle20: {
    name: '20 Book Bundle',
    description: 'Publish up to 20 books',
    priceId: process.env.STRIPE_BUNDLE20_PRICE_ID,
    price: 59900, // $599.00
    booksAllowed: 20
  },
  additional: {
    name: 'Additional Book',
    description: 'Add more books to your account',
    priceId: process.env.STRIPE_ADDITIONAL_PRICE_ID,
    price: 3700, // $37.00
    booksAllowed: 1
  },
  annual: {
    name: 'Annual Subscription',
    description: 'Unlimited books for one year',
    priceId: process.env.STRIPE_ANNUAL_PRICE_ID,
    price: 39900, // $399.00
    booksAllowed: 999 // Unlimited (represented as 999)
  }
};

module.exports = {
  stripe,
  SUBSCRIPTION_PLANS
}; 