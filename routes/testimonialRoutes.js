const express = require('express');
const router = express.Router();
const testimonialController = require('../controllers/testimonialController');
const { verifyToken, requireAdmin } = require('../middleware/auth');

// Public: submit testimonial
router.post('/', testimonialController.submitTestimonial);

// Public: get approved testimonials, Admin: get all testimonials
router.get('/', (req, res, next) => {
  // Check if user is authenticated and is admin
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    // No token, return only approved testimonials
    return testimonialController.getApprovedTestimonials(req, res, next);
  }
  
  // Verify token and check admin status
  verifyToken(req, res, (err) => {
    if (err) {
      // Token invalid, return only approved testimonials
      return testimonialController.getApprovedTestimonials(req, res, next);
    }
    
    // Check if user is admin
    if (req.user && req.user.role === 'admin') {
      // Admin user, return all testimonials
      return testimonialController.getAllTestimonials(req, res, next);
    } else {
      // Non-admin user, return only approved testimonials
      return testimonialController.getApprovedTestimonials(req, res, next);
    }
  });
});

// Admin: update testimonial
router.patch('/:id', verifyToken, requireAdmin, testimonialController.updateTestimonial);

// Admin: approve testimonial
router.patch('/:id/approve', verifyToken, requireAdmin, testimonialController.approveTestimonial);

// Admin: delete testimonial
router.delete('/:id', verifyToken, requireAdmin, testimonialController.deleteTestimonial);

module.exports = router; 