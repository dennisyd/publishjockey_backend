const request = require('supertest');
const express = require('express');

// Build minimal app wiring only webhook route like server does
const app = express();
// Webhook must use raw
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), require('../controllers/stripeController').handleWebhookEvent);

// Fallback error handler to not crash tests
app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message });
});

describe('Stripe webhook', () => {
  test('rejects with 400 on invalid signature', async () => {
    const payload = JSON.stringify({ id: 'evt_test', type: 'payment_intent.succeeded' });
    const res = await request(app)
      .post('/api/stripe/webhook')
      .set('Stripe-Signature', 'bad')
      .send(payload);
    expect([400, 403]).toContain(res.status);
    expect(String(res.text || '')).toMatch(/Webhook Error|verification failed/i);
  });
});
