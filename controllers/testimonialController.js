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
    console.log('Attempting to update testimonial with ID:', id);
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log('Invalid ObjectId format:', id);
      return res.status(400).json({ error: 'Invalid testimonial ID format' });
    }
    
    const testimonial = await Testimonial.findByIdAndUpdate(
      id,
      { name, email, text, avatarUrl },
      { new: true, runValidators: true }
    );
    
    if (!testimonial) {
      console.log('Testimonial not found with ID:', id);
      return res.status(404).json({ error: 'Testimonial not found' });
    }
    
    console.log('Successfully updated testimonial:', id);
    res.json({ message: 'Testimonial updated successfully', testimonial });
  } catch (err) {
    console.error('Error updating testimonial:', err);
    res.status(400).json({ error: err.message });
  }
};

// PATCH /api/testimonials/:id/approve (admin)
exports.approveTestimonial = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Attempting to approve testimonial with ID:', id);
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log('Invalid ObjectId format:', id);
      return res.status(400).json({ error: 'Invalid testimonial ID format' });
    }
    
    const testimonial = await Testimonial.findByIdAndUpdate(id, { approved: true }, { new: true });
    if (!testimonial) {
      console.log('Testimonial not found with ID:', id);
      return res.status(404).json({ error: 'Testimonial not found' });
    }
    
    console.log('Successfully approved testimonial:', id);
    res.json({ message: 'Testimonial approved', testimonial });
  } catch (err) {
    console.error('Error approving testimonial:', err);
    res.status(400).json({ error: err.message });
  }
};

// DELETE /api/testimonials/:id (admin)
exports.deleteTestimonial = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Attempting to delete testimonial with ID:', id);
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log('Invalid ObjectId format:', id);
      return res.status(400).json({ error: 'Invalid testimonial ID format' });
    }
    
    const testimonial = await Testimonial.findByIdAndDelete(id);
    if (!testimonial) {
      console.log('Testimonial not found with ID:', id);
      return res.status(404).json({ error: 'Testimonial not found' });
    }
    
    console.log('Successfully deleted testimonial:', id);
    res.json({ message: 'Testimonial deleted' });
  } catch (err) {
    console.error('Error deleting testimonial:', err);
    res.status(400).json({ error: err.message });
  }
}; 