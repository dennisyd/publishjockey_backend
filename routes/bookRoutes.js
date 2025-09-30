const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');

// Apply authentication middleware to all book routes
router.use(verifyToken);

// Basic placeholder routes
router.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Book routes are working',
    data: []
  });
});

router.get('/:id', (req, res) => {
  res.status(200).json({
    success: true,
    message: `Book with ID ${req.params.id} fetched`,
    data: { id: req.params.id }
  });
});

module.exports = router; 