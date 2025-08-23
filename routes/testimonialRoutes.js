const express = require('express');
const router = express.Router();
const testimonialController = require('../controllers/testimonialController');
const { verifyToken, requireAdmin } = require('../middleware/auth');

// Public: submit testimonial
router.post('/', testimonialController.submitTestimonial);

// Public: get approved testimonials, Admin: get all testimonials
router.get('/', (req, res, next) => {
  // If ?approved=true, show only approved (public access)
  if (req.query.approved === 'true') {
    return testimonialController.getApprovedTestimonials(req, res, next);
  }
  // For getting all testimonials, require admin authentication
  return verifyToken(req, res, (err) => {
    if (err) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    return requireAdmin(req, res, () => {
      return testimonialController.getAllTestimonials(req, res, next);
    });
  });
});

// Admin: update testimonial
router.patch('/:id', verifyToken, requireAdmin, testimonialController.updateTestimonial);

// Admin: approve testimonial
router.patch('/:id/approve', verifyToken, requireAdmin, testimonialController.approveTestimonial);

// Admin: delete testimonial
router.delete('/:id', verifyToken, requireAdmin, testimonialController.deleteTestimonial);

module.exports = router; 