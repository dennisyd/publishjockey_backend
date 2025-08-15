const { body, param, query, validationResult } = require('express-validator');
const mongoSanitize = require('express-mongo-sanitize');

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('Validation errors:', errors.array());
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg,
        value: err.value
      }))
    });
  }
  next();
};

// MongoDB sanitization middleware
const sanitizeInput = mongoSanitize({
  replaceWith: '_', // Replace prohibited characters with underscore
  onSanitize: ({ req, key }) => {
    console.warn(`Sanitized input detected in ${req.method} ${req.path}: ${key}`);
  }
});

// User registration validation
const validateUserRegistration = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Name can only contain letters, spaces, hyphens, and apostrophes'),
  
  body('email')
    .trim()
    .normalizeEmail()
    .isEmail()
    .withMessage('Must be a valid email address')
    .isLength({ max: 254 })
    .withMessage('Email too long'),
  
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  
  handleValidationErrors
];

// User login validation
const validateUserLogin = [
  body('email')
    .trim()
    .normalizeEmail()
    .isEmail()
    .withMessage('Must be a valid email address'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ max: 128 })
    .withMessage('Password too long'),
  
  handleValidationErrors
];

// Project creation validation
const validateProjectCreation = [
  body('title')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Project title must be between 1 and 200 characters')
    .matches(/^[a-zA-Z0-9\s\-_.,!?'":()]+$/)
    .withMessage('Project title contains invalid characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  
  body('author')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Author name must be less than 100 characters')
    .matches(/^[a-zA-Z\s'-]*$/)
    .withMessage('Author name can only contain letters, spaces, hyphens, and apostrophes'),
  
  body('subtitle')
    .optional()
    .trim()
    .isLength({ max: 300 })
    .withMessage('Subtitle must be less than 300 characters'),
  
  body('isbn')
    .optional()
    .trim()
    .matches(/^(97[89])?\d{9}(\d|X)$/)
    .withMessage('ISBN must be a valid 10 or 13 digit ISBN'),
  
  handleValidationErrors
];

// Project update validation
const validateProjectUpdate = [
  param('id')
    .isMongoId()
    .withMessage('Invalid project ID format'),
  
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Project title must be between 1 and 200 characters'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
  
  body('content')
    .optional()
    .isObject()
    .withMessage('Content must be an object'),
  
  body('structure')
    .optional()
    .isObject()
    .withMessage('Structure must be an object'),
  
  handleValidationErrors
];

// MongoDB ObjectId validation
const validateObjectId = (field = 'id') => [
  param(field)
    .isMongoId()
    .withMessage(`Invalid ${field} format`),
  
  handleValidationErrors
];

// Query parameter validation
const validateQueryParams = [
  query('page')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Page must be a number between 1 and 1000'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be a number between 1 and 100'),
  
  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search term must be less than 100 characters')
    .matches(/^[a-zA-Z0-9\s\-_.,!?'"]+$/)
    .withMessage('Search term contains invalid characters'),
  
  handleValidationErrors
];

// Password reset validation
const validatePasswordReset = [
  body('email')
    .trim()
    .normalizeEmail()
    .isEmail()
    .withMessage('Must be a valid email address'),
  
  handleValidationErrors
];

// Password reset confirm validation
const validatePasswordResetConfirm = [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required')
    .isLength({ min: 32, max: 64 })
    .withMessage('Invalid reset token format'),
  
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  
  handleValidationErrors
];

// Content validation for project sections
const validateContent = [
  body('content')
    .isString()
    .withMessage('Content must be a string')
    .isLength({ max: 100000 }) // 100KB limit
    .withMessage('Content is too large (max 100,000 characters)')
    .custom((value) => {
      // Check for XSS patterns
      const xssPatterns = [
        /<script[^>]*>.*?<\/script>/gis,
        /<iframe[^>]*>.*?<\/iframe>/gis,
        /<object[^>]*>.*?<\/object>/gis,
        /<embed[^>]*>/gi,
        /javascript:/gi,
        /vbscript:/gi,
        /data:text\/html/gi,
        /on\w+\s*=/gi,
        /expression\s*\(/gi
      ];
      
      for (const pattern of xssPatterns) {
        if (pattern.test(value)) {
          throw new Error('Content contains potentially dangerous patterns');
        }
      }
      return true;
    }),
  
  handleValidationErrors
];

// Enhanced project title validation with XSS prevention
const validateProjectTitle = [
  body('title')
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage('Project title must be between 1 and 200 characters')
    .matches(/^[a-zA-Z0-9\s\-_.,!?'":()]+$/)
    .withMessage('Project title contains invalid characters')
    .custom((value) => {
      // Additional XSS checks for titles
      const dangerousPatterns = [
        /<script/gi,
        /javascript:/gi,
        /on\w+\s*=/gi
      ];
      
      for (const pattern of dangerousPatterns) {
        if (pattern.test(value)) {
          throw new Error('Title contains potentially dangerous content');
        }
      }
      return true;
    }),
  
  handleValidationErrors
];

module.exports = {
  sanitizeInput,
  handleValidationErrors,
  validateUserRegistration,
  validateUserLogin,
  validateProjectCreation,
  validateProjectUpdate,
  validateObjectId,
  validateQueryParams,
  validatePasswordReset,
  validatePasswordResetConfirm,
  validateContent,
  validateProjectTitle
}; 