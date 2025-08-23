const mongoose = require('mongoose');
const Testimonial = require('../models/Testimonial');

// POST /api/testimonials
exports.submitTestimonial = async (req, res) => {
  try {
    const { name, email, text, avatarUrl } = req.body;
    const testimonial = new Testimonial({ name, email, text, avatarUrl });
    await testimonial.save();
    res.status(201).json({ message: 'Testimonial submitted for review.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// GET /api/testimonials?approved=true
exports.getApprovedTestimonials = async (req, res) => {
  try {
    const testimonials = await Testimonial.find({ approved: true }).sort({ createdAt: -1 });
    res.json(testimonials);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/testimonials (admin)
exports.getAllTestimonials = async (req, res) => {
  try {
    const testimonials = await Testimonial.find().sort({ createdAt: -1 });
    res.json(testimonials);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PATCH /api/testimonials/:id (admin)
exports.updateTestimonial = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, text, avatarUrl } = req.body;
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid testimonial ID format' });
    }
    
    const testimonial = await Testimonial.findByIdAndUpdate(
      id,
      { name, email, text, avatarUrl },
      { new: true, runValidators: true }
    );
    
    if (!testimonial) {
      return res.status(404).json({ error: 'Testimonial not found' });
    }
    
    res.json({ message: 'Testimonial updated successfully', testimonial });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// PATCH /api/testimonials/:id/approve (admin)
exports.approveTestimonial = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid testimonial ID format' });
    }
    
    const testimonial = await Testimonial.findByIdAndUpdate(id, { approved: true }, { new: true });
    if (!testimonial) {
      return res.status(404).json({ error: 'Testimonial not found' });
    }
    
    res.json({ message: 'Testimonial approved', testimonial });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// DELETE /api/testimonials/:id (admin)
exports.deleteTestimonial = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid testimonial ID format' });
    }
    
    const testimonial = await Testimonial.findByIdAndDelete(id);
    if (!testimonial) {
      return res.status(404).json({ error: 'Testimonial not found' });
    }
    
    res.json({ message: 'Testimonial deleted' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}; 