// Define custom errors
class AuthError extends Error {
  constructor(message, statusCode = 401) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
  }
}

// Custom API error class
class ApiError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

// Not found middleware
const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

// Error handler middleware
const errorHandler = (err, req, res, next) => {
  // Set default status code if not set
  const statusCode = err.statusCode || 500;
  
  console.error('Error:', err.message);
  console.error('Stack:', err.stack);
  
  // Structured error response
  res.status(statusCode).json({
    success: false,
    error: {
      message: err.message,
      stack: process.env.NODE_ENV === 'production' ? '🥞' : err.stack,
    },
  });
};

module.exports = {
  notFound,
  errorHandler,
  ApiError,
  AuthError
}; 