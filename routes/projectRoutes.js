const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { validateCsrfToken } = require('../middleware/csrf');
const { validateProjectTitle, validateContent } = require('../middleware/validation');
const {
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject
} = require('../controllers/projectController');

// Apply regular token verification to all project routes
router.use(verifyToken);

// Set up routes with controller functions
router
  .route('/')
  .get(getProjects)
  .post(validateProjectTitle, createProject);

router
  .route('/:id')
  .get(getProject)
  .put(updateProject)
  .delete(deleteProject);

module.exports = router; 