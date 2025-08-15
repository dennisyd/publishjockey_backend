const express = require('express');
const router = express.Router();
const { verifyToken, requireAdmin } = require('../middleware/auth');
const { SecurityMonitor } = require('../services/securityMonitor');

const securityMonitor = new SecurityMonitor();

// CSP violation reporting endpoint
router.post('/csp-violation', async (req, res) => {
  try {
    const violation = req.body;
    
    // Log to security monitoring system
    await securityMonitor.logCspViolation(violation, req);
    
    res.status(204).send();
  } catch (error) {
    console.error('Error processing CSP violation:', error);
    res.status(500).json({ error: 'Failed to process CSP violation' });
  }
});

// Security audit endpoint (admin only)
router.get('/audit', verifyToken, requireAdmin, (req, res) => {
  try {
    const audit = {
      timestamp: new Date().toISOString(),
      headers: {
        'X-Content-Type-Options': req.get('X-Content-Type-Options'),
        'X-Frame-Options': req.get('X-Frame-Options'),
        'X-XSS-Protection': req.get('X-XSS-Protection'),
        'Referrer-Policy': req.get('Referrer-Policy'),
        'Permissions-Policy': req.get('Permissions-Policy'),
        'Content-Security-Policy': req.get('Content-Security-Policy')
      },
      request: {
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        requestId: req.id
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        hasCloudinary: !!process.env.CLOUDINARY_CLOUD_NAME,
        hasStripe: !!process.env.STRIPE_SECRET_KEY,
        hasMongo: !!process.env.MONGODB_URI
      }
    };

    res.json({
      success: true,
      audit
    });
  } catch (error) {
    console.error('Error generating security audit:', error);
    res.status(500).json({ error: 'Failed to generate security audit' });
  }
});

// Security health check endpoint
router.get('/health', (req, res) => {
  const health = {
    timestamp: new Date().toISOString(),
    status: 'healthy',
    security: {
      cspEnabled: !!req.get('Content-Security-Policy'),
      xssProtection: req.get('X-XSS-Protection') === '1; mode=block',
      frameOptions: req.get('X-Frame-Options') === 'DENY',
      contentTypeOptions: req.get('X-Content-Type-Options') === 'nosniff',
      referrerPolicy: req.get('Referrer-Policy') === 'strict-origin-when-cross-origin'
    },
    request: {
      id: req.id,
      method: req.method,
      url: req.url
    }
  };

  res.json(health);
});

// Get security events (admin only)
router.get('/events', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { type, severity, resolved, ip, startDate, endDate, limit = 100 } = req.query;
    
    const filters = {
      type,
      severity,
      resolved: resolved === 'true' ? true : resolved === 'false' ? false : undefined,
      ip,
      startDate,
      endDate
    };

    const events = await securityMonitor.getSecurityEvents(filters, parseInt(limit));
    
    res.json({
      success: true,
      events,
      count: events.length
    });
  } catch (error) {
    console.error('Error fetching security events:', error);
    res.status(500).json({ error: 'Failed to fetch security events' });
  }
});

// Get security statistics (admin only)
router.get('/stats', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const stats = await securityMonitor.getSecurityStats(parseInt(days));
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error fetching security stats:', error);
    res.status(500).json({ error: 'Failed to fetch security stats' });
  }
});

// Resolve security event (admin only)
router.put('/events/:eventId/resolve', verifyToken, requireAdmin, async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = await securityMonitor.resolveEvent(eventId, req.user.userId);
    
    if (!event) {
      return res.status(404).json({ error: 'Security event not found' });
    }
    
    res.json({
      success: true,
      event
    });
  } catch (error) {
    console.error('Error resolving security event:', error);
    res.status(500).json({ error: 'Failed to resolve security event' });
  }
});

module.exports = router;


