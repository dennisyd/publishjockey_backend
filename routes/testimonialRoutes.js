const express = require('express');
const router = express.Router();
const testimonialController = require('../controllers/testimonialController');

// Public: submit testimonial
router.post('/', testimonialController.submitTestimonial);

// Public: get approved testimonials, Admin: get all testimonials
router.get('/', (req, res, next) => {
  // If ?approved=true, show only approved; else, show all (admin)
  if (req.query.approved === 'true') {
    return testimonialController.getApprovedTestimonials(req, res, next);
  }
  return testimonialController.getAllTestimonials(req, res, next);
});

// Admin: update testimonial
router.patch('/:id', testimonialController.updateTestimonial);

// Admin: approve testimonial
router.patch('/:id/approve', testimonialController.approveTestimonial);

// Admin: delete testimonial
router.delete('/:id', testimonialController.deleteTestimonial);

module.exports = router; 