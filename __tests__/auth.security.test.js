/**
 * Authentication Security Integration Tests
 * Tests CSRF protection, anti-replay protection, and forged requests
 */

const request = require('supertest');
const app = require('../server');
const mongoose = require('mongoose');
const User = require('../models/User');
const { generateNonce, getTimestamp } = require('../middleware/antiReplay');

describe('Authentication Security Tests', () => {
  let testUser;
  let authToken;
  let csrfToken;
  let adminUser;
  let adminToken;

  beforeAll(async () => {
    // Create test user
    testUser = await User.create({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
      isVerified: true,
      role: 'user',
      subscription: 'free'
    });

    // Create admin user
    adminUser = await User.create({
      name: 'Admin User',
      email: 'admin@example.com',
      password: 'password123',
      isVerified: true,
      role: 'admin',
      subscription: 'bundle20'
    });
  });

  afterAll(async () => {
    // Clean up
    await User.findByIdAndDelete(testUser._id);
    await User.findByIdAndDelete(adminUser._id);
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Login and get tokens for regular user
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123'
      });

    authToken = loginResponse.body.token;
    
    // Login and get tokens for admin user
    const adminLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@example.com',
        password: 'password123'
      });

    adminToken = adminLoginResponse.body.token;
    
    // Get CSRF token (if available)
    const csrfResponse = await request(app)
      .get('/api/csrf-token')
      .set('Authorization', `Bearer ${authToken}`);
    
    if (csrfResponse.body.csrfToken) {
      csrfToken = csrfResponse.body.csrfToken;
    }
  });

  describe('CSRF Protection', () => {
    it('should reject POST requests without CSRF token', async () => {
      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Project',
          content: 'Test content'
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toMatch(/CSRF/);
    });

    it('should accept POST requests with valid CSRF token', async () => {
      if (!csrfToken) {
        console.log('Skipping CSRF test - no CSRF token available');
        return;
      }

      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-CSRF-Token', csrfToken)
        .send({
          title: 'Test Project',
          content: 'Test content'
        });

      expect(response.status).toBe(201);
    });

    it('should reject requests with invalid CSRF token', async () => {
      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-CSRF-Token', 'invalid-token')
        .send({
          title: 'Test Project',
          content: 'Test content'
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toMatch(/CSRF/);
    });
  });

  describe('Anti-Replay Protection', () => {
    it('should reject requests without nonce and timestamp', async () => {
      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Project',
          content: 'Test content'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/Missing security headers/);
    });

    it('should accept requests with valid nonce and timestamp', async () => {
      const nonce = generateNonce();
      const timestamp = getTimestamp();

      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-nonce', nonce)
        .set('x-timestamp', timestamp)
        .send({
          title: 'Test Project',
          content: 'Test content'
        });

      expect(response.status).toBe(201);
    });

    it('should reject duplicate nonces', async () => {
      const nonce = generateNonce();
      const timestamp = getTimestamp();

      // First request should succeed
      const response1 = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-nonce', nonce)
        .set('x-timestamp', timestamp)
        .send({
          title: 'Test Project 1',
          content: 'Test content 1'
        });

      expect(response1.status).toBe(201);

      // Second request with same nonce should fail
      const response2 = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-nonce', nonce)
        .set('x-timestamp', timestamp)
        .send({
          title: 'Test Project 2',
          content: 'Test content 2'
        });

      expect(response2.status).toBe(400);
      expect(response2.body.error).toMatch(/Duplicate request/);
    });

    it('should reject requests with old timestamps', async () => {
      const nonce = generateNonce();
      const oldTimestamp = (Date.now() - 6 * 60 * 1000).toString(); // 6 minutes ago

      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-nonce', nonce)
        .set('x-timestamp', oldTimestamp)
        .send({
          title: 'Test Project',
          content: 'Test content'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/Request too old/);
    });

    it('should reject requests with future timestamps', async () => {
      const nonce = generateNonce();
      const futureTimestamp = (Date.now() + 60 * 1000).toString(); // 1 minute in future

      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-nonce', nonce)
        .set('x-timestamp', futureTimestamp)
        .send({
          title: 'Test Project',
          content: 'Test content'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/Invalid timestamp/);
    });
  });

  describe('Authentication Tests', () => {
    it('should return 401 for requests without token', async () => {
      const response = await request(app)
        .get('/api/projects');

      expect(response.status).toBe(401);
    });

    it('should return 401 for requests with invalid token', async () => {
      const response = await request(app)
        .get('/api/projects')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });

    it('should return 401 for requests with expired token', async () => {
      // Create an expired token
      const jwt = require('jsonwebtoken');
      const config = require('../config/config');
      
      const expiredToken = jwt.sign(
        { userId: testUser._id, exp: Math.floor(Date.now() / 1000) - 3600 }, // Expired 1 hour ago
        config.jwt.accessTokenSecret
      );

      const response = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
    });

    it('should return 403 for unauthorized admin actions', async () => {
      const response = await request(app)
        .delete('/api/admin/users')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(403);
    });

    it('should accept requests with valid token', async () => {
      const response = await request(app)
        .get('/api/projects')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
    });
  });

  describe('Token Refresh Security', () => {
    it('should reject refresh with invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: 'invalid-refresh-token'
        });

      expect(response.status).toBe(401);
      expect(response.body.message).toMatch(/Invalid refresh token/);
    });

    it('should reject refresh without refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/Refresh token is required/);
    });

    it('should accept valid refresh token', async () => {
      // First login to get refresh token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      const refreshToken = loginResponse.body.refreshToken;

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: refreshToken
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.refreshToken).toBeDefined();
    });
  });

  describe('Cookie Security', () => {
    it('should set secure cookies in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      const cookies = response.headers['set-cookie'];
      expect(cookies).toBeDefined();

      // Check for secure cookie attributes
      const accessTokenCookie = cookies.find(cookie => cookie.includes('accessToken'));
      const refreshTokenCookie = cookies.find(cookie => cookie.includes('refreshToken'));

      expect(accessTokenCookie).toMatch(/HttpOnly/);
      expect(accessTokenCookie).toMatch(/Secure/);
      expect(accessTokenCookie).toMatch(/SameSite=Strict/);

      expect(refreshTokenCookie).toMatch(/HttpOnly/);
      expect(refreshTokenCookie).toMatch(/Secure/);
      expect(refreshTokenCookie).toMatch(/SameSite=Strict/);

      // Restore environment
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Rate Limiting', () => {
    it('should limit login attempts', async () => {
      const attempts = [];
      
      // Make multiple failed login attempts
      for (let i = 0; i < 10; i++) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'test@example.com',
            password: 'wrongpassword'
          });
        
        attempts.push(response.status);
      }

      // Should eventually get rate limited
      expect(attempts).toContain(429);
    });
  });

  describe('Forged Request Protection', () => {
    it('should return 401 for requests without authentication', async () => {
      const response = await request(app)
        .post('/api/projects')
        .send({
          title: 'Test Project',
          content: 'Test content'
        });

      expect(response.status).toBe(401);
    });

    it('should return 401 for requests with invalid JWT token', async () => {
      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', 'Bearer invalid.token.here')
        .set('x-nonce', generateNonce())
        .set('x-timestamp', getTimestamp())
        .send({
          title: 'Test Project',
          content: 'Test content'
        });

      expect(response.status).toBe(401);
    });

    it('should return 401 for requests with expired JWT token', async () => {
      // Create an expired token
      const jwt = require('jsonwebtoken');
      const config = require('../config/config');
      
      const expiredToken = jwt.sign(
        { userId: testUser._id, name: testUser.name, email: testUser.email, role: testUser.role },
        config.jwt.accessTokenSecret,
        { expiresIn: '1ms' } // Expires immediately
      );

      // Wait for token to expire
      await new Promise(resolve => setTimeout(resolve, 10));

      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${expiredToken}`)
        .set('x-nonce', generateNonce())
        .set('x-timestamp', getTimestamp())
        .send({
          title: 'Test Project',
          content: 'Test content'
        });

      expect(response.status).toBe(401);
    });

    it('should return 401 for requests with malformed JWT token', async () => {
      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', 'Bearer not.a.valid.jwt')
        .set('x-nonce', generateNonce())
        .set('x-timestamp', getTimestamp())
        .send({
          title: 'Test Project',
          content: 'Test content'
        });

      expect(response.status).toBe(401);
    });

    it('should return 401 for requests with JWT signed with wrong secret', async () => {
      const jwt = require('jsonwebtoken');
      
      const wrongSecretToken = jwt.sign(
        { userId: testUser._id, name: testUser.name, email: testUser.email, role: testUser.role },
        'wrong-secret-key',
        { expiresIn: '15m' }
      );

      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${wrongSecretToken}`)
        .set('x-nonce', generateNonce())
        .set('x-timestamp', getTimestamp())
        .send({
          title: 'Test Project',
          content: 'Test content'
        });

      expect(response.status).toBe(401);
    });
  });

  describe('Authorization Tests', () => {
    it('should return 403 for regular user accessing admin-only endpoint', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-nonce', generateNonce())
        .set('x-timestamp', getTimestamp());

      expect(response.status).toBe(403);
    });

    it('should allow admin user to access admin-only endpoint', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-nonce', generateNonce())
        .set('x-timestamp', getTimestamp());

      expect(response.status).toBe(200);
    });

    it('should return 403 for user trying to access another user\'s data', async () => {
      // Create another user
      const otherUser = await User.create({
        name: 'Other User',
        email: 'other@example.com',
        password: 'password123',
        isVerified: true,
        role: 'user',
        subscription: 'free'
      });

      // Try to access other user's profile with regular user token
      const response = await request(app)
        .get(`/api/users/${otherUser._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .set('x-nonce', generateNonce())
        .set('x-timestamp', getTimestamp());

      expect(response.status).toBe(403);

      // Clean up
      await User.findByIdAndDelete(otherUser._id);
    });

    it('should allow admin to access any user\'s data', async () => {
      // Create another user
      const otherUser = await User.create({
        name: 'Other User',
        email: 'other@example.com',
        password: 'password123',
        isVerified: true,
        role: 'user',
        subscription: 'free'
      });

      // Admin should be able to access other user's profile
      const response = await request(app)
        .get(`/api/users/${otherUser._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('x-nonce', generateNonce())
        .set('x-timestamp', getTimestamp());

      expect(response.status).toBe(200);

      // Clean up
      await User.findByIdAndDelete(otherUser._id);
    });
  });

  describe('Token Tampering Protection', () => {
    it('should return 401 for token with tampered payload', async () => {
      const jwt = require('jsonwebtoken');
      const config = require('../config/config');
      
      // Create a valid token
      const validToken = jwt.sign(
        { userId: testUser._id, name: testUser.name, email: testUser.email, role: testUser.role },
        config.jwt.accessTokenSecret,
        { expiresIn: '15m' }
      );

      // Tamper with the payload (change role to admin)
      const parts = validToken.split('.');
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      payload.role = 'admin';
      parts[1] = Buffer.from(JSON.stringify(payload)).toString('base64');
      const tamperedToken = parts.join('.');

      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${tamperedToken}`)
        .set('x-nonce', generateNonce())
        .set('x-timestamp', getTimestamp())
        .send({
          title: 'Test Project',
          content: 'Test content'
        });

      expect(response.status).toBe(401);
    });

    it('should return 401 for token with missing required claims', async () => {
      const jwt = require('jsonwebtoken');
      const config = require('../config/config');
      
      // Create token without userId
      const invalidToken = jwt.sign(
        { name: testUser.name, email: testUser.email, role: testUser.role },
        config.jwt.accessTokenSecret,
        { expiresIn: '15m' }
      );

      const response = await request(app)
        .post('/api/projects')
        .set('Authorization', `Bearer ${invalidToken}`)
        .set('x-nonce', generateNonce())
        .set('x-timestamp', getTimestamp())
        .send({
          title: 'Test Project',
          content: 'Test content'
        });

      expect(response.status).toBe(401);
    });
  });
});
