const express = require('express');
const router = express.Router();
const testimonialController = require('../controllers/testimonialController');
const { verifyToken, requireAdmin } = require('../middleware/auth');

// Public: submit testimonial
router.post('/', testimonialController.submitTestimonial);

// Public: get approved testimonials
router.get('/', testimonialController.getApprovedTestimonials);

// Admin: get all testimonials (including unapproved)
router.get('/admin', verifyToken, requireAdmin, testimonialController.getAllTestimonials);

// Admin: update testimonial
router.patch('/:id', verifyToken, requireAdmin, testimonialController.updateTestimonial);

// Admin: approve testimonial
router.patch('/:id/approve', verifyToken, requireAdmin, testimonialController.approveTestimonial);

// Admin: delete testimonial
router.delete('/:id', verifyToken, requireAdmin, testimonialController.deleteTestimonial);

module.exports = router; 