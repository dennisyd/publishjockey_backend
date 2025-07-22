const jwt = require('jsonwebtoken');
const config = require('../config/config');
const { AuthError } = require('./error');

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  // Get token from Authorization header, query parameter, or cookie
  const authHeader = req.headers.authorization;
  const queryToken = req.query.token;
  
  let token;
  
  // Check Authorization header first
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } 
  // Then check query parameter
  else if (queryToken) {
    token = queryToken;
  }
  
  // If no token found in either place
  if (!token) {
    console.log('No token provided - proceeding as anonymous user');
    req.user = { id: 'anonymous', role: 'anonymous' };
    return next();
  }

  try {
    // Verify the token
    const decoded = jwt.verify(token, config.jwt.accessTokenSecret);
    
    // Check if we have a valid userId in the token
    if (!decoded.userId && decoded.id) {
      decoded.userId = decoded.id; // Handle different id formats
    }
    
    req.user = decoded;
    console.log('Token verified for user:', decoded.userId || decoded.id, 'Role:', decoded.role);
    next();
  } catch (error) {
    console.log('Invalid token:', error.message);
    req.user = { id: 'anonymous', role: 'anonymous' };
    next();
  }
};

// Role-based access control middleware
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AuthError('Authentication required'));
    }

    if (!roles.includes(req.user.role)) {
      return next(new AuthError('Insufficient permissions', 403));
    }

    next();
  };
};

// Strict token verification (doesn't allow anonymous)
const verifyTokenStrict = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please provide a valid token.'
    });
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, config.jwt.accessTokenSecret);
    
    // Check if we have a valid userId in the token
    if (!decoded.userId && decoded.id) {
      decoded.userId = decoded.id;
    }
    
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Token verification failed:', error.message);
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }
};

// Refresh token verification middleware
const verifyRefreshToken = (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    console.log('Refresh token received:', refreshToken ? 'Present' : 'Missing');
    
    if (!refreshToken) {
      throw new AuthError('Refresh token required');
    }

    console.log('Using refreshTokenSecret:', config.jwt.refreshTokenSecret ? 'Secret exists' : 'Secret missing');
    
    const decoded = jwt.verify(refreshToken, config.jwt.refreshTokenSecret);
    console.log('Refresh token verified successfully');
    
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Refresh token verification error:', error.message);
    
    if (error.name === 'JsonWebTokenError') {
      next(new AuthError('Invalid refresh token'));
    } else if (error.name === 'TokenExpiredError') {
      next(new AuthError('Refresh token expired', 401));
    } else {
      next(error);
    }
  }
};

// Middleware to require admin role
const requireAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Access denied: Admin permissions required'
    });
  }
};

module.exports = {
  verifyToken,
  verifyTokenStrict,
  authorize,
  verifyRefreshToken,
  requireAdmin
}; 