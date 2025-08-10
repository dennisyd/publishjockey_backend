const express = require('express');
const router = express.Router();
const { verifyTokenStrict, requireAdmin } = require('../middleware/auth');
const ctrl = require('../controllers/titleChangeController');

// Admin-only routes
router.use(verifyTokenStrict, requireAdmin);

router.get('/', ctrl.list);
router.post('/:id/approve', ctrl.approve);
router.post('/:id/deny', ctrl.deny);

module.exports = router;


