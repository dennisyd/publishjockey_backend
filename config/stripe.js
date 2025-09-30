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
    imagesAllowed: 10
  },
  bundle5: {
    name: '5 Book Pack',
    description: 'Publish up to 5 books (3-year validity)',
    priceId: process.env.STRIPE_BUNDLE5_PRICE_ID,
    price: 34900, // $349.00
    booksAllowed: 5,
    imagesAllowed: 50
  },
  bundle10: {
    name: '10 Book Pack',
    description: 'Publish up to 10 books (3-year validity)',
    priceId: process.env.STRIPE_BUNDLE10_PRICE_ID,
    price: 59900, // $599.00
    booksAllowed: 10,
    imagesAllowed: 100
  },
  bundle20: {
    name: '20 Book Pack',
    description: 'Publish up to 20 books (3-year validity)',
    priceId: process.env.STRIPE_BUNDLE20_PRICE_ID,
    price: 99900, // $999.00
    booksAllowed: 20,
    imagesAllowed: 200
  },
  poweruser: {
    name: 'Power User',
    description: 'For prolific authors (1-year validity)',
    priceId: process.env.STRIPE_POWERUSER_PRICE_ID,
    price: 225000, // $2,250.00
    booksAllowed: 50,
    imagesAllowed: 500
  },
  agency: {
    name: 'Agency',
    description: 'For publishing agencies (1-year validity)',
    priceId: process.env.STRIPE_AGENCY_PRICE_ID,
    price: 350000, // $3,500.00
    booksAllowed: 100,
    imagesAllowed: 1000
  },

  // Ebook plans (50-page limit)
  eSingle: {
    name: 'Ebook Single',
    description: 'Ebook-focused plan with 50-page limit (3-year validity)',
    priceId: process.env.STRIPE_ESINGLE_PRICE_ID,
    price: 4600, // $46.00
    booksAllowed: 1,
    imagesAllowed: 11,
    pageLimit: 50
  },
  ebundle5: {
    name: 'Ebook 5 Pack',
    description: 'Ebook-focused plan for multiple books (3-year validity)',
    priceId: process.env.STRIPE_EBUNDLE5_PRICE_ID,
    price: 17400, // $174.00
    booksAllowed: 5,
    imagesAllowed: 55,
    pageLimit: 50
  },
  ebundle10: {
    name: 'Ebook 10 Pack',
    description: 'Ebook-focused plan for serious authors (3-year validity)',
    priceId: process.env.STRIPE_EBUNDLE10_PRICE_ID,
    price: 29900, // $299.00
    booksAllowed: 10,
    imagesAllowed: 110,
    pageLimit: 50
  },
  ebundle20: {
    name: 'Ebook 20 Pack',
    description: 'Ebook-focused plan for prolific authors (3-year validity)',
    priceId: process.env.STRIPE_EBUNDLE20_PRICE_ID,
    price: 49900, // $499.00
    booksAllowed: 20,
    imagesAllowed: 220,
    pageLimit: 50
  },
  epoweruser: {
    name: 'Ebook Power User',
    description: 'Ebook-focused plan for prolific authors (1-year validity)',
    priceId: process.env.STRIPE_EPOWERUSER_PRICE_ID,
    price: 112500, // $1,125.00
    booksAllowed: 50,
    imagesAllowed: 550,
    pageLimit: 50
  },
  eagency: {
    name: 'Ebook Agency',
    description: 'Ebook-focused plan for publishing agencies (1-year validity)',
    priceId: process.env.STRIPE_EAGENCY_PRICE_ID,
    price: 175000, // $1,750.00
    booksAllowed: 100,
    imagesAllowed: 1100,
    pageLimit: 50
  },

  // Full-service plans
  fullService: {
    name: 'Full Service',
    description: 'Complete publishing package with custom cover designs (Final PDF and eBook delivery within 72 hours of cover approval)',
    priceId: process.env.STRIPE_FULLSERVICE_PRICE_ID,
    price: 49900, // $499.00
    booksAllowed: 1,
    imagesAllowed: 11
  },
  fullServicePlus: {
    name: 'Full Service Plus',
    description: 'Complete package with custom covers and KDP setup guidance (Final PDF and eBook delivery within 72 hours of cover approval)',
    priceId: process.env.STRIPE_FULLSERVICEPLUS_PRICE_ID,
    price: 59900, // $599.00
    booksAllowed: 1,
    imagesAllowed: 11
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
    price: 24900, // $249.00
    booksAllowed: 5,
    imagesAllowed: 55
  },
  bundle10_promo: {
    name: '10 Book Pack — Promo',
    description: 'Launch offer for 10 books (3-year validity)',
    priceId: process.env.STRIPE_BUNDLE10_PROMO_PRICE_ID,
    price: 39900, // $399.00
    booksAllowed: 10,
    imagesAllowed: 110
  },
  bundle20_promo: {
    name: '20 Book Pack — Promo',
    description: 'Launch offer for 20 books (3-year validity)',
    priceId: process.env.STRIPE_BUNDLE20_PROMO_PRICE_ID,
    price: 69900, // $699.00
    booksAllowed: 20,
    imagesAllowed: 220
  },
  poweruser_promo: {
    name: 'Power User — Promo',
    description: 'Launch offer for prolific authors (1-year validity)',
    priceId: process.env.STRIPE_POWERUSER_PROMO_PRICE_ID,
    price: 150000, // $1,500.00
    booksAllowed: 50,
    imagesAllowed: 550
  },
  agency_promo: {
    name: 'Agency — Promo',
    description: 'Launch offer for publishing agencies (1-year validity)',
    priceId: process.env.STRIPE_AGENCY_PROMO_PRICE_ID,
    price: 250000, // $2,500.00
    booksAllowed: 100,
    imagesAllowed: 1100
  },

  // Ebook promo plans
  eSingle_promo: {
    name: 'Ebook Single — Promo',
    description: 'Launch offer for ebook single (3-year validity, 50-page limit)',
    priceId: process.env.STRIPE_ESINGLE_PROMO_PRICE_ID,
    price: 3100, // $31.00
    booksAllowed: 1,
    imagesAllowed: 11,
    pageLimit: 50
  },
  ebundle5_promo: {
    name: 'Ebook 5 Pack — Promo',
    description: 'Launch offer for ebook 5 pack (3-year validity, 50-page limit)',
    priceId: process.env.STRIPE_EBUNDLE5_PROMO_PRICE_ID,
    price: 12400, // $124.00
    booksAllowed: 5,
    imagesAllowed: 55,
    pageLimit: 50
  },
  ebundle10_promo: {
    name: 'Ebook 10 Pack — Promo',
    description: 'Launch offer for ebook 10 pack (3-year validity, 50-page limit)',
    priceId: process.env.STRIPE_EBUNDLE10_PROMO_PRICE_ID,
    price: 19900, // $199.00
    booksAllowed: 10,
    imagesAllowed: 110,
    pageLimit: 50
  },
  ebundle20_promo: {
    name: 'Ebook 20 Pack — Promo',
    description: 'Launch offer for ebook 20 pack (3-year validity, 50-page limit)',
    priceId: process.env.STRIPE_EBUNDLE20_PROMO_PRICE_ID,
    price: 34900, // $349.00
    booksAllowed: 20,
    imagesAllowed: 220,
    pageLimit: 50
  },
  epoweruser_promo: {
    name: 'Ebook Power User — Promo',
    description: 'Launch offer for ebook power user (1-year validity, 50-page limit)',
    priceId: process.env.STRIPE_EPOWERUSER_PROMO_PRICE_ID,
    price: 75000, // $750.00
    booksAllowed: 50,
    imagesAllowed: 550,
    pageLimit: 50
  },
  eagency_promo: {
    name: 'Ebook Agency — Promo',
    description: 'Launch offer for ebook agency (1-year validity, 50-page limit)',
    priceId: process.env.STRIPE_EAGENCY_PROMO_PRICE_ID,
    price: 125000, // $1,250.00
    booksAllowed: 100,
    imagesAllowed: 1100,
    pageLimit: 50
  },

  // Full-service promo plans
  fullService_promo: {
    name: 'Full Service — Promo',
    description: 'Launch offer for full service package (Final PDF and eBook delivery within 72 hours of cover approval)',
    priceId: process.env.STRIPE_FULLSERVICE_PROMO_PRICE_ID,
    price: 44900, // $449.00
    booksAllowed: 1,
    imagesAllowed: 11
  },
  fullServicePlus_promo: {
    name: 'Full Service Plus — Promo',
    description: 'Launch offer for full service plus package (Final PDF and eBook delivery within 72 hours of cover approval)',
    priceId: process.env.STRIPE_FULLSERVICEPLUS_PROMO_PRICE_ID,
    price: 54900, // $549.00
    booksAllowed: 1,
    imagesAllowed: 11
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