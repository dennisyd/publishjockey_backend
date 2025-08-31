const Project = require('../models/Project');
const User = require('../models/User');
const mongoose = require('mongoose');
const config = require('../config/config');
const { updateUserImageCount } = require('../utils/imageScanner');
const { getLocalizedBookStructure } = require('../utils/bookStructureLocalization');
const { validateWordLimit } = require('../utils/wordCounter');

/**
 * Get all projects
 * @route GET /api/projects
 * @access Private
 */
exports.getProjects = async (req, res) => {
  try {
    let query = {};
    
    // If authenticated user, filter projects by owner/collaborator/userId
    if (req.user) {
      const userId = req.user.userId || req.user.id;
      
      if (userId && userId !== 'anonymous') {
        // Look for projects where either owner, userId, or collaborators matches the user
        query = {
          $or: [
            { owner: userId },
            { userId: userId },
            { collaborators: userId }
          ]
        };
      }
    }
    
    // Query for projects
    
    const projects = await Project.find(query)
      .populate('owner', 'name email')
      .populate('collaborators', 'name email');
    
    // Found projects for user
    
    res.status(200).json({
      success: true,
      count: projects.length,
      data: projects
    });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * Get a single project
 * @route GET /api/projects/:id
 * @access Private
 */
exports.getProject = async (req, res) => {
  try {
    // Validate if the id is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid project ID'
      });
    }
    
    const project = await Project.findById(req.params.id)
      .populate('owner', 'name email')
      .populate('collaborators', 'name email');
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }
    
    // In development mode, allow access to all projects
    // In production, enforce access control
    if (config.nodeEnv === 'production') {
      // If project has owner, check permissions
      if (project.owner && req.user && req.user.id !== 'anonymous') {
        const isOwner = project.owner._id.toString() === req.user.id;
        const isCollaborator = project.collaborators.some(
          collab => collab._id && collab._id.toString() === req.user.id
        );
        
        if (!isOwner && !isCollaborator) {
          return res.status(403).json({
            success: false,
            message: 'You do not have permission to access this project'
          });
        }
      }
    }
    
    res.status(200).json({
      success: true,
      data: project
    });
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * Create a new project
 * @route POST /api/projects
 * @access Private
 */
exports.createProject = async (req, res) => {
  try {
    // Create project request received
    
    // Validate required fields manually before attempting to create
    if (!req.body.title) {
      return res.status(400).json({
        success: false,
        message: 'Project title is required',
        errors: ['Project title is required']
      });
    }
    
    // Description is now optional, removed validation
    
    // Prepare project data
    const projectData = {
      ...req.body,
      description: req.body.description || ''
    };
    
    const userId = req.user?.userId || req.user?.id;
    
    // Set both owner and userId fields to ensure compatibility between systems
    if (userId && userId !== 'anonymous') {
      projectData.owner = userId;
      projectData.userId = userId; // Add userId field for export-backend compatibility
    }
    // Otherwise, leave owner as null (we've made it optional in the model)
    
    // Get the language from the request body or default to English
    const language = req.body.language || 'en';
    console.log('Creating project with language:', language);
    
    // Use localized book structure based on the language
    const localizedStructure = getLocalizedBookStructure(language);
    projectData.structure = localizedStructure;
    
    console.log('Creating project with data:', projectData);
    
    const project = await Project.create(projectData);
    
    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      data: project
    });
  } catch (error) {
    console.error('Error creating project:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: messages
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * Update a project
 * @route PUT /api/projects/:id
 * @access Private
 */
exports.updateProject = async (req, res) => {
  try {
    // Update project request received

    // Validate if the id is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid project ID'
      });
    }
    
    let project = await Project.findById(req.params.id);
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }
    
    // Log update details for debugging
    console.log('Project update request received:', {
      projectId: req.params.id,
      hasStructure: !!req.body.structure,
      structureSize: req.body.structure ? Object.keys(req.body.structure).length : 0,
      updateFields: Object.keys(req.body)
    });
    
    if (req.body.structure) {
      console.log('Structure update details:', {
        front: req.body.structure.front ? req.body.structure.front.length : 0,
        main: req.body.structure.main ? req.body.structure.main.length : 0,
        back: req.body.structure.back ? req.body.structure.back.length : 0,
        frontSections: req.body.structure.front || [],
        mainSections: req.body.structure.main || [],
        backSections: req.body.structure.back || []
      });
    }
    
    // In production, enforce owner-only updates
    if (config.nodeEnv === 'production') {
      // If project has an owner and user is authenticated
      if (project.owner && req.user && req.user.id !== 'anonymous') {
        if (project.owner.toString() !== req.user.id) {
          return res.status(403).json({
            success: false,
            message: 'You do not have permission to update this project'
          });
        }
      }
    }
    
    // Detect title change before update for flagging
    const originalTitle = project.title;
    const willChangeTitle = typeof req.body.title === 'string' && req.body.title.trim() !== originalTitle;

    // Check word limit for ebook subscriptions if content is being updated
    if (req.body.content && req.user && req.user.userId) {
      try {
        const user = await User.findById(req.user.userId);
        if (user && user.wordLimit) {
          const contentToCheck = { ...project.content, ...req.body.content };
          const validation = validateWordLimit(contentToCheck, user.wordLimit);
          
          if (!validation.isValid) {
            return res.status(400).json({
              success: false,
              message: `Content exceeds word limit of ${user.wordLimit} words. Current content: ${validation.wordCount} words.`,
              data: {
                wordCount: validation.wordCount,
                wordLimit: user.wordLimit,
                wordsOver: validation.wordCount - user.wordLimit
              }
            });
          }
        }
      } catch (error) {
        console.error('Error checking word limit:', error);
        // Continue with update even if word limit check fails
      }
    }

    // Update the project
    project = await Project.findByIdAndUpdate(
      req.params.id, 
      req.body, 
      { new: true, runValidators: true }
    );

    // Debug: Log what was actually saved
    console.log('💾 PROJECT SAVED DEBUG:', {
      projectId: project._id,
      savedContentKeys: project.content && typeof project.content === 'object' ? Object.keys(project.content) : [],
      savedContentPreview: project.content && typeof project.content === 'object' ? JSON.stringify(project.content).substring(0, 200) : 'N/A',
      savedTitle: project.title,
      structureKeys: project.structure ? Object.keys(project.structure) : []
    });

    // Title change monitoring (Single plans only; after 3 days; >25% delta)
    try {
      if (willChangeTitle && req.user && req.user.userId) {
        const user = await User.findById(req.user.userId);
        if (user) {
          const titleChangeCtrl = require('./titleChangeController');
          await titleChangeCtrl.flagIfNeeded({ user, project, newTitle: req.body.title });
        }
      }
    } catch (e) {
      console.error('Title change monitoring error:', e);
    }

    // Update user's image count based on actual usage (async, don't wait)
    if (req.body.content && req.user && req.user.userId) {
      updateUserImageCount(req.user.userId, User, Project).catch(error => {
        console.error('Error updating user image count after project save:', error);
      });
    }

    // Verify the structure was saved correctly if it was part of the update
    if (req.body.structure && project.structure) {
      console.log('Structure saved successfully:', {
        frontLength: project.structure.front ? project.structure.front.length : 0,
        mainLength: project.structure.main ? project.structure.main.length : 0,
        backLength: project.structure.back ? project.structure.back.length : 0
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Project updated successfully',
      data: project
    });
  } catch (error) {
    console.error('Error updating project:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: messages
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * Delete a project
 * @route DELETE /api/projects/:id
 * @access Private
 */
exports.deleteProject = async (req, res) => {
  try {
    // Validate if the id is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid project ID'
      });
    }
    
    const project = await Project.findById(req.params.id);
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }
    
    // In production, enforce owner-only deletion
    if (config.nodeEnv === 'production') {
      // If project has an owner and user is authenticated
      if (project.owner && req.user && req.user.id !== 'anonymous') {
        if (project.owner.toString() !== req.user.id) {
          return res.status(403).json({
            success: false,
            message: 'You do not have permission to delete this project'
          });
        }
      }
    }
    
    await Project.findByIdAndDelete(req.params.id);
    
    res.status(200).json({
      success: true,
      message: 'Project deleted successfully',
      data: {}
    });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * Get project word count information
 * @route GET /api/projects/:id/wordcount
 * @access Private
 */
exports.getProjectWordCount = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid project ID'
      });
    }

    const project = await Project.findById(req.params.id);
    
    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found'
      });
    }

    // Get user's word limit
    let wordLimit = null;
    if (req.user && req.user.userId) {
      const user = await User.findById(req.user.userId);
      wordLimit = user ? user.wordLimit : null;
    }

    const validation = validateWordLimit(project.content, wordLimit);

    res.status(200).json({
      success: true,
      data: {
        wordCount: validation.wordCount,
        wordLimit: validation.wordLimit,
        wordsRemaining: validation.wordsRemaining,
        isValid: validation.isValid
      }
    });
  } catch (error) {
    console.error('Error getting project word count:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
}; 