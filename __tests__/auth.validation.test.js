const request = require('supertest');
const express = require('express');

const app = express();
app.use(express.json());
app.use('/api/auth', require('../routes/authRoutes'));

describe('Auth route validation (no DB)', () => {
  test('login invalid payload returns 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'bad', password: '' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('register invalid payload returns 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'A', email: 'bad', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
