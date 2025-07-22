const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
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
  .post(createProject);

router
  .route('/:id')
  .get(getProject)
  .put(updateProject)
  .delete(deleteProject);

module.exports = router; 