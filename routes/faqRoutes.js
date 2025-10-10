const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

/**
 * @route   GET /api/faq
 * @desc    Get all FAQ items
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const faqPath = path.join(__dirname, '../faq/faq-data.json');
    const faqData = await fs.readFile(faqPath, 'utf-8');
    const faqs = JSON.parse(faqData);
    
    // Sort by order field
    faqs.sort((a, b) => a.order - b.order);
    
    res.json({
      success: true,
      count: faqs.length,
      data: faqs
    });
  } catch (error) {
    console.error('Error fetching FAQ data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch FAQ data'
    });
  }
});

/**
 * @route   GET /api/faq/featured
 * @desc    Get featured FAQ items only
 * @access  Public
 */
router.get('/featured', async (req, res) => {
  try {
    const faqPath = path.join(__dirname, '../faq/faq-data.json');
    const faqData = await fs.readFile(faqPath, 'utf-8');
    const faqs = JSON.parse(faqData);
    
    // Filter featured and sort by order
    const featured = faqs
      .filter(faq => faq.featured)
      .sort((a, b) => a.order - b.order);
    
    res.json({
      success: true,
      count: featured.length,
      data: featured
    });
  } catch (error) {
    console.error('Error fetching featured FAQs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch featured FAQs'
    });
  }
});

/**
 * @route   GET /api/faq/category/:category
 * @desc    Get FAQ items by category
 * @access  Public
 */
router.get('/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    
    const faqPath = path.join(__dirname, '../faq/faq-data.json');
    const faqData = await fs.readFile(faqPath, 'utf-8');
    const faqs = JSON.parse(faqData);
    
    // Filter by category (case-insensitive) and sort by order
    const filtered = faqs
      .filter(faq => faq.category.toLowerCase() === category.toLowerCase())
      .sort((a, b) => a.order - b.order);
    
    res.json({
      success: true,
      category,
      count: filtered.length,
      data: filtered
    });
  } catch (error) {
    console.error('Error fetching FAQs by category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch FAQs by category'
    });
  }
});

/**
 * @route   GET /api/faq/categories
 * @desc    Get all unique FAQ categories
 * @access  Public
 */
router.get('/categories', async (req, res) => {
  try {
    const faqPath = path.join(__dirname, '../faq/faq-data.json');
    const faqData = await fs.readFile(faqPath, 'utf-8');
    const faqs = JSON.parse(faqData);
    
    // Get unique categories
    const categories = [...new Set(faqs.map(faq => faq.category))];
    
    // Count items per category
    const categoriesWithCount = categories.map(category => ({
      category,
      count: faqs.filter(faq => faq.category === category).length
    }));
    
    res.json({
      success: true,
      count: categories.length,
      data: categoriesWithCount
    });
  } catch (error) {
    console.error('Error fetching FAQ categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch FAQ categories'
    });
  }
});

/**
 * @route   GET /api/faq/:id
 * @desc    Get a single FAQ item by ID
 * @access  Public
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const faqPath = path.join(__dirname, '../faq/faq-data.json');
    const faqData = await fs.readFile(faqPath, 'utf-8');
    const faqs = JSON.parse(faqData);
    
    const faq = faqs.find(item => item.id === id);
    
    if (!faq) {
      return res.status(404).json({
        success: false,
        message: 'FAQ item not found'
      });
    }
    
    res.json({
      success: true,
      data: faq
    });
  } catch (error) {
    console.error('Error fetching FAQ item:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch FAQ item'
    });
  }
});

module.exports = router;

