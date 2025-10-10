const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

/**
 * @route   GET /api/blog
 * @desc    Get all blog posts metadata
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const indexPath = path.join(__dirname, '../blog/index.json');
    const indexData = await fs.readFile(indexPath, 'utf-8');
    const posts = JSON.parse(indexData);
    
    // Sort by publish date (newest first)
    posts.sort((a, b) => new Date(b.publishDate) - new Date(a.publishDate));
    
    res.json({
      success: true,
      count: posts.length,
      data: posts
    });
  } catch (error) {
    console.error('Error fetching blog index:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch blog posts'
    });
  }
});

/**
 * @route   GET /api/blog/featured
 * @desc    Get featured blog posts
 * @access  Public
 */
router.get('/featured', async (req, res) => {
  try {
    const indexPath = path.join(__dirname, '../blog/index.json');
    const indexData = await fs.readFile(indexPath, 'utf-8');
    const posts = JSON.parse(indexData);
    
    // Filter featured posts and sort by date
    const featured = posts
      .filter(post => post.featured)
      .sort((a, b) => new Date(b.publishDate) - new Date(a.publishDate));
    
    res.json({
      success: true,
      count: featured.length,
      data: featured
    });
  } catch (error) {
    console.error('Error fetching featured posts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch featured posts'
    });
  }
});

/**
 * @route   GET /api/blog/:slug
 * @desc    Get a single blog post by slug
 * @access  Public
 */
router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    
    // Get metadata from index
    const indexPath = path.join(__dirname, '../blog/index.json');
    const indexData = await fs.readFile(indexPath, 'utf-8');
    const posts = JSON.parse(indexData);
    const postMeta = posts.find(post => post.slug === slug);
    
    if (!postMeta) {
      return res.status(404).json({
        success: false,
        message: 'Blog post not found'
      });
    }
    
    // Get markdown content
    const contentPath = path.join(__dirname, `../blog/${slug}.md`);
    const content = await fs.readFile(contentPath, 'utf-8');
    
    res.json({
      success: true,
      data: {
        ...postMeta,
        content
      }
    });
  } catch (error) {
    console.error('Error fetching blog post:', error);
    
    if (error.code === 'ENOENT') {
      return res.status(404).json({
        success: false,
        message: 'Blog post not found'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to fetch blog post'
    });
  }
});

/**
 * @route   GET /api/blog/category/:category
 * @desc    Get blog posts by category
 * @access  Public
 */
router.get('/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    
    const indexPath = path.join(__dirname, '../blog/index.json');
    const indexData = await fs.readFile(indexPath, 'utf-8');
    const posts = JSON.parse(indexData);
    
    // Filter by category (case-insensitive)
    const filtered = posts
      .filter(post => post.category.toLowerCase() === category.toLowerCase())
      .sort((a, b) => new Date(b.publishDate) - new Date(a.publishDate));
    
    res.json({
      success: true,
      category,
      count: filtered.length,
      data: filtered
    });
  } catch (error) {
    console.error('Error fetching posts by category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch posts by category'
    });
  }
});

/**
 * @route   GET /api/blog/tag/:tag
 * @desc    Get blog posts by tag
 * @access  Public
 */
router.get('/tag/:tag', async (req, res) => {
  try {
    const { tag } = req.params;
    
    const indexPath = path.join(__dirname, '../blog/index.json');
    const indexData = await fs.readFile(indexPath, 'utf-8');
    const posts = JSON.parse(indexData);
    
    // Filter by tag (case-insensitive)
    const filtered = posts
      .filter(post => 
        post.tags.some(t => t.toLowerCase() === tag.toLowerCase())
      )
      .sort((a, b) => new Date(b.publishDate) - new Date(a.publishDate));
    
    res.json({
      success: true,
      tag,
      count: filtered.length,
      data: filtered
    });
  } catch (error) {
    console.error('Error fetching posts by tag:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch posts by tag'
    });
  }
});

module.exports = router;

