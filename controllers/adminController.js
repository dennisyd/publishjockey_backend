const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { generateRandomToken } = require('../utils/tokenUtils');
const { sendPasswordResetEmail, sendNotificationEmail, sendPasswordChangeEmail } = require('../utils/emailUtils');

// Get all users with pagination, sorting and filtering
const getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const sortField = req.query.sortField || 'createdAt';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const search = req.query.search || '';
    const role = req.query.role || '';
    const status = req.query.status || '';
    
    // Build filter
    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    if (role) filter.role = role;
    if (status === 'active') filter.isSuspended = false;
    if (status === 'suspended') filter.isSuspended = true;
    
    // Get users
    const users = await User.find(filter)
      .sort({ [sortField]: sortOrder })
      .skip(skip)
      .limit(limit)
      .select('-password -resetPasswordToken -resetPasswordExpires -verificationToken -verificationTokenExpires');
    
    // Get total count
    const totalUsers = await User.countDocuments(filter);
    const totalPages = Math.ceil(totalUsers / limit);
    
    // Create audit log
    await AuditLog.create({
      action: 'VIEW_USERS',
      performedBy: req.user.userId,
      details: { filter, page, limit }
    });
    
    res.status(200).json({
      success: true,
      users,
      pagination: {
        totalUsers,
        totalPages,
        currentPage: page,
        limit
      }
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve users',
      error: error.message
    });
  }
};

// Get user details including login history
const getUserDetails = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Get user
    const user = await User.findById(userId)
      .select('-password -resetPasswordToken -resetPasswordExpires -verificationToken -verificationTokenExpires');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Get user's login history from audit logs
    const loginHistory = await AuditLog.find({
      action: 'LOGIN',
      targetUser: userId
    }).sort({ timestamp: -1 }).limit(10);
    
    // Get user's recent activity
    const recentActivity = await AuditLog.find({
      targetUser: userId
    }).sort({ timestamp: -1 }).limit(20);
    
    // Create audit log
    await AuditLog.create({
      action: 'VIEW_USER_DETAILS',
      performedBy: req.user.userId,
      targetUser: userId
    });
    
    res.status(200).json({
      success: true,
      user,
      loginHistory,
      recentActivity
    });
  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve user details',
      error: error.message
    });
  }
};

// Update user information
const updateUserInfo = async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, email, role, subscription } = req.body;
    
    // Find user
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Prepare update data
    const updateData = {};
    if (name) updateData.name = name;
    if (email && email !== user.email) {
      // Check if email is already in use
      const existingUser = await User.findOne({ email, _id: { $ne: userId } });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email already in use'
        });
      }
      updateData.email = email;
    }
    if (role) updateData.role = role;
    if (subscription) updateData.subscription = subscription;
    
    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password -resetPasswordToken -resetPasswordExpires -verificationToken -verificationTokenExpires');
    
    // Create audit log
    await AuditLog.create({
      action: 'UPDATE_USER',
      performedBy: req.user.userId,
      targetUser: userId,
      details: updateData
    });
    
    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user',
      error: error.message
    });
  }
};

// Admin reset user password
const adminResetPassword = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Find user
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Generate token
    const resetToken = generateRandomToken();
    const resetTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    // Save token to user
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetTokenExpires;
    await user.save();
    
    // Send password reset email
    await sendPasswordResetEmail({
      name: user.name,
      email: user.email,
      resetToken
    });
    
    // Create audit log
    await AuditLog.create({
      action: 'ADMIN_RESET_PASSWORD',
      performedBy: req.user.userId,
      targetUser: userId
    });
    
    res.status(200).json({
      success: true,
      message: 'Password reset email sent to user'
    });
  } catch (error) {
    console.error('Admin reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset user password',
      error: error.message
    });
  }
};

// Impersonate user (generate special token for temporary access)
const impersonateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Find user
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Generate JWT for impersonation (with short expiry)
    const jwt = require('jsonwebtoken');
    const config = require('../config/config');
    
    const impersonationToken = jwt.sign(
      { 
        userId: user._id, 
        role: user.role,
        name: user.name,
        email: user.email,
        impersonatedBy: req.user.userId 
      },
      config.jwt.accessTokenSecret,
      { expiresIn: '1h' }
    );
    
    // Create audit log
    await AuditLog.create({
      action: 'IMPERSONATE_USER',
      performedBy: req.user.userId,
      targetUser: userId,
      details: { expiresIn: '1 hour' }
    });
    
    res.status(200).json({
      success: true,
      message: 'Impersonation token generated',
      impersonationToken
    });
  } catch (error) {
    console.error('Impersonate user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to impersonate user',
      error: error.message
    });
  }
};

// Export user data (GDPR/CCPA compliance)
const exportUserData = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Find user
    const user = await User.findById(userId)
      .select('-password -resetPasswordToken -resetPasswordExpires -verificationToken -verificationTokenExpires');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Get user's login history
    const loginHistory = await AuditLog.find({
      $or: [
        { targetUser: userId },
        { performedBy: userId }
      ]
    }).sort({ timestamp: -1 });
    
    // Compile user data for export
    const userData = {
      personalInfo: {
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        role: user.role,
        subscription: user.subscription,
        subscriptionExpires: user.subscriptionExpires
      },
      activityLogs: loginHistory
    };
    
    // Create audit log
    await AuditLog.create({
      action: 'EXPORT_USER_DATA',
      performedBy: req.user.userId,
      targetUser: userId
    });
    
    res.status(200).json({
      success: true,
      userData
    });
  } catch (error) {
    console.error('Export user data error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export user data',
      error: error.message
    });
  }
};

// Suspend user
const suspendUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;
    
    // Find user
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Check if user is already suspended
    if (user.isSuspended) {
      return res.status(400).json({
        success: false,
        message: 'User is already suspended'
      });
    }
    
    // Suspend user
    user.isSuspended = true;
    user.suspensionReason = reason || 'Suspended by administrator';
    await user.save();
    
    // Create audit log
    await AuditLog.create({
      action: 'SUSPEND_USER',
      performedBy: req.user.userId,
      targetUser: userId,
      details: { reason: reason || 'Suspended by administrator' }
    });
    
    res.status(200).json({
      success: true,
      message: 'User suspended successfully'
    });
  } catch (error) {
    console.error('Suspend user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to suspend user',
      error: error.message
    });
  }
};

// Unsuspend user
const unsuspendUser = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Find user
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Check if user is already active
    if (!user.isSuspended) {
      return res.status(400).json({
        success: false,
        message: 'User is already active'
      });
    }
    
    // Unsuspend user
    user.isSuspended = false;
    user.suspensionReason = undefined;
    await user.save();
    
    // Create audit log
    await AuditLog.create({
      action: 'UNSUSPEND_USER',
      performedBy: req.user.userId,
      targetUser: userId
    });
    
    res.status(200).json({
      success: true,
      message: 'User activated successfully'
    });
  } catch (error) {
    console.error('Unsuspend user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to activate user',
      error: error.message
    });
  }
};

// Change user role
const changeUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    
    // Validate role
    const validRoles = ['user', 'admin', 'editor'];
    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role'
      });
    }
    
    // Find user
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Check if role is already assigned
    if (user.role === role) {
      return res.status(400).json({
        success: false,
        message: `User already has the ${role} role`
      });
    }
    
    // Update role
    user.role = role;
    await user.save();
    
    // Create audit log
    await AuditLog.create({
      action: 'CHANGE_USER_ROLE',
      performedBy: req.user.userId,
      targetUser: userId,
      details: { previousRole: user.role, newRole: role }
    });
    
    res.status(200).json({
      success: true,
      message: `User role updated to ${role} successfully`
    });
  } catch (error) {
    console.error('Change user role error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change user role',
      error: error.message
    });
  }
};

// Delete user
const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Validate userId is provided and is a valid format
    if (!userId || userId === 'undefined') {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID provided'
      });
    }
    
    // Find user
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const deletionReport = {
      booksDeleted: 0,
      imagesDeleted: 0,
      userDeleted: false,
      errors: []
    };

    // 1. Find and delete all projects/books belonging to this user
    try {
      const mongoose = require('mongoose');
      const Project = mongoose.models.Project || mongoose.model('Project', 
        new mongoose.Schema({}), 'projects');
      
      // Find all projects first to get image information
      const userProjects = await Project.find({ userId: userId }).lean();
      deletionReport.booksDeleted = userProjects.length;
      
      // Delete all projects
      const deleteResult = await Project.deleteMany({ userId: userId });
      console.log(`Deleted ${deleteResult.deletedCount} projects for user ${userId}`);
      
      // Verify deletion
      const remainingProjects = await Project.find({ userId: userId }).countDocuments();
      if (remainingProjects > 0) {
        deletionReport.errors.push(`Failed to delete all projects. ${remainingProjects} projects remain.`);
      }
    } catch (projectError) {
      console.error('Error deleting user projects:', projectError);
      deletionReport.errors.push(`Project deletion error: ${projectError.message}`);
    }

    // 2. Find and delete all images belonging to this user
    try {
      const ImageUpload = require('../models/ImageUpload');
      const cloudinary = require('cloudinary').v2;
      
      // Configure Cloudinary
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
      });

      // Find all image uploads for this user
      const userImages = await ImageUpload.find({ userId: userId }).lean();
      deletionReport.imagesDeleted = userImages.length;

      // Delete images from Cloudinary
      for (const image of userImages) {
        try {
          await cloudinary.uploader.destroy(image.publicId);
          console.log(`Deleted image from Cloudinary: ${image.publicId}`);
        } catch (cloudinaryError) {
          console.error(`Failed to delete image from Cloudinary: ${image.publicId}`, cloudinaryError);
          deletionReport.errors.push(`Cloudinary deletion error for ${image.publicId}: ${cloudinaryError.message}`);
        }
      }

      // Delete image records from database
      const imageDeleteResult = await ImageUpload.deleteMany({ userId: userId });
      console.log(`Deleted ${imageDeleteResult.deletedCount} image records for user ${userId}`);

      // Verify image deletion
      const remainingImages = await ImageUpload.find({ userId: userId }).countDocuments();
      if (remainingImages > 0) {
        deletionReport.errors.push(`Failed to delete all image records. ${remainingImages} records remain.`);
      }
    } catch (imageError) {
      console.error('Error deleting user images:', imageError);
      deletionReport.errors.push(`Image deletion error: ${imageError.message}`);
    }

    // 3. Delete user
    try {
      await User.findByIdAndDelete(userId);
      deletionReport.userDeleted = true;
      console.log(`Deleted user: ${userId}`);
    } catch (userError) {
      console.error('Error deleting user:', userError);
      deletionReport.errors.push(`User deletion error: ${userError.message}`);
    }

    // 4. Create audit log
    try {
      await AuditLog.create({
        action: 'DELETE_USER',
        performedBy: req.user.userId || 'system',
        details: { 
          deletedUser: userId, 
          email: user.email,
          deletionReport: deletionReport
        }
      });
    } catch (auditError) {
      console.error('Error creating audit log:', auditError);
      deletionReport.errors.push(`Audit log error: ${auditError.message}`);
    }

    // 5. Return detailed deletion report
    const success = deletionReport.userDeleted && deletionReport.errors.length === 0;
    
    res.status(success ? 200 : 207).json({
      success: success,
      message: success ? 'User and all associated data deleted successfully' : 'User deletion completed with some errors',
      deletionReport: deletionReport
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: error.message
    });
  }
};

// Get user books
const getUserBooks = async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId || userId === 'undefined') {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID provided'
      });
    }

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get user's projects/books
    const mongoose = require('mongoose');
    const Project = mongoose.models.Project || mongoose.model('Project', 
      new mongoose.Schema({}), 'projects');
    
    const books = await Project.find({ userId: userId })
      .select('title createdAt updatedAt _id')
      .sort({ updatedAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      books: books,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });

  } catch (error) {
    console.error('Get user books error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user books',
      error: error.message
    });
  }
};

// Delete specific book
const deleteBook = async (req, res) => {
  try {
    const { userId, bookId } = req.params;
    
    if (!userId || !bookId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID or book ID provided'
      });
    }

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get and delete the specific book
    const mongoose = require('mongoose');
    const Project = mongoose.models.Project || mongoose.model('Project', 
      new mongoose.Schema({}), 'projects');
    
    const book = await Project.findOne({ _id: bookId, userId: userId });
    if (!book) {
      return res.status(404).json({
        success: false,
        message: 'Book not found or does not belong to this user'
      });
    }

    const deletionReport = {
      bookDeleted: false,
      imagesDeleted: 0,
      errors: []
    };

    // Extract and delete images from the book content
    try {
      const ImageUpload = require('../models/ImageUpload');
      const cloudinary = require('cloudinary').v2;
      
      // Configure Cloudinary
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
      });

      // Extract image URLs from book content
      const imageUrls = extractImageUrlsFromContent(book.content);
      
      for (const imageUrl of imageUrls) {
        try {
          // Extract public ID from URL
          const publicId = extractPublicIdFromUrl(imageUrl);
          if (publicId) {
            await cloudinary.uploader.destroy(publicId);
            console.log(`Deleted image from Cloudinary: ${publicId}`);
            deletionReport.imagesDeleted++;
          }
        } catch (cloudinaryError) {
          console.error(`Failed to delete image: ${imageUrl}`, cloudinaryError);
          deletionReport.errors.push(`Image deletion error: ${cloudinaryError.message}`);
        }
      }
    } catch (imageError) {
      console.error('Error processing images:', imageError);
      deletionReport.errors.push(`Image processing error: ${imageError.message}`);
    }

    // Delete the book
    await Project.findByIdAndDelete(bookId);
    deletionReport.bookDeleted = true;

    // Create audit log
    await AuditLog.create({
      action: 'DELETE_BOOK',
      performedBy: req.user.userId || 'system',
      targetUser: userId,
      details: { 
        bookId: bookId,
        bookTitle: book.title,
        deletionReport: deletionReport
      }
    });

    res.status(200).json({
      success: true,
      message: 'Book deleted successfully',
      deletionReport: deletionReport
    });

  } catch (error) {
    console.error('Delete book error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete book',
      error: error.message
    });
  }
};

// Helper function to extract image URLs from content
const extractImageUrlsFromContent = (content) => {
  const imageUrls = [];
  
  if (!content) return imageUrls;
  
  // Convert content to string if it's an object
  const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
  
  // Find Cloudinary URLs
  const cloudinaryRegex = /https:\/\/res\.cloudinary\.com\/[^\/]+\/image\/upload\/[^"'\s]+/g;
  const matches = contentStr.match(cloudinaryRegex);
  
  if (matches) {
    imageUrls.push(...matches);
  }
  
  return [...new Set(imageUrls)]; // Remove duplicates
};

// Helper function to extract public ID from Cloudinary URL
const extractPublicIdFromUrl = (url) => {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    const uploadIndex = pathParts.indexOf('upload');
    
    if (uploadIndex !== -1 && uploadIndex + 1 < pathParts.length) {
      // Get everything after 'upload/' and before the file extension
      const publicIdWithVersion = pathParts.slice(uploadIndex + 2).join('/');
      // Remove version if present
      const publicId = publicIdWithVersion.replace(/^v\d+\//, '');
      return publicId;
    }
  } catch (error) {
    console.error('Error extracting public ID from URL:', error);
  }
  
  return null;
};

// Send notification to user
const sendNotification = async (req, res) => {
  try {
    const { userId } = req.params;
    const { subject, message, sendEmail } = req.body;
    
    if (!subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Subject and message are required'
      });
    }
    
    // Find user
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Create notification in database
    const notification = {
      title: subject,
      message,
      read: false,
      createdAt: new Date()
    };
    
    if (!user.notifications) user.notifications = [];
    user.notifications.push(notification);
    await user.save();
    
    // Send email notification if requested
    if (sendEmail) {
      await sendNotificationEmail({
        name: user.name,
        email: user.email,
        subject,
        message
      });
    }
    
    // Create audit log
    await AuditLog.create({
      action: 'SEND_NOTIFICATION',
      performedBy: req.user.userId,
      targetUser: userId,
      details: { subject, emailSent: !!sendEmail }
    });
    
    res.status(200).json({
      success: true,
      message: 'Notification sent successfully'
    });
  } catch (error) {
    console.error('Send notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send notification',
      error: error.message
    });
  }
};

// Bulk action on users
const bulkUserAction = async (req, res) => {
  try {
    const { userIds, action, reason } = req.body;
    
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'User IDs are required'
      });
    }
    
    if (!action) {
      return res.status(400).json({
        success: false,
        message: 'Action is required'
      });
    }
    
    // Valid actions
    const validActions = ['suspend', 'unsuspend', 'delete', 'changeRole'];
    if (!validActions.includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action'
      });
    }
    
    // Special validation for changeRole
    if (action === 'changeRole' && !req.body.role) {
      return res.status(400).json({
        success: false,
        message: 'Role is required for changeRole action'
      });
    }
    
    // Process each user
    const results = [];
    
    for (const userId of userIds) {
      try {
        // Find user
        const user = await User.findById(userId);
        
        if (!user) {
          results.push({ userId, success: false, message: 'User not found' });
          continue;
        }
        
        // Perform action
        switch (action) {
          case 'suspend':
            if (user.isSuspended) {
              results.push({ userId, success: false, message: 'User already suspended' });
            } else {
              user.isSuspended = true;
              user.suspensionReason = reason || 'Suspended by administrator';
              await user.save();
              results.push({ userId, success: true, message: 'User suspended' });
            }
            break;
            
          case 'unsuspend':
            if (!user.isSuspended) {
              results.push({ userId, success: false, message: 'User not suspended' });
            } else {
              user.isSuspended = false;
              user.suspensionReason = undefined;
              await user.save();
              results.push({ userId, success: true, message: 'User activated' });
            }
            break;
            
          case 'delete':
            await User.findByIdAndDelete(userId);
            results.push({ userId, success: true, message: 'User deleted' });
            break;
            
          case 'changeRole':
            const role = req.body.role;
            if (user.role === role) {
              results.push({ userId, success: false, message: `User already has role ${role}` });
            } else {
              user.role = role;
              await user.save();
              results.push({ userId, success: true, message: `User role changed to ${role}` });
            }
            break;
        }
        
      } catch (error) {
        console.error(`Error processing user ${userId}:`, error);
        results.push({ userId, success: false, message: error.message });
      }
    }
    
    // Create audit log
    await AuditLog.create({
      action: `BULK_${action.toUpperCase()}`,
      performedBy: req.user.userId,
      details: { 
        userIds, 
        action, 
        reason: action === 'suspend' ? reason : undefined,
        role: action === 'changeRole' ? req.body.role : undefined
      }
    });
    
    // Return results
    res.status(200).json({
      success: true,
      message: 'Bulk action processed',
      results,
      summary: {
        total: userIds.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      }
    });
  } catch (error) {
    console.error('Bulk user action error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process bulk action',
      error: error.message
    });
  }
};

// Get audit logs
const getAuditLogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const sortField = req.query.sortField || 'timestamp';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const action = req.query.action || '';
    const userId = req.query.userId || '';
    const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
    const endDate = req.query.endDate ? new Date(req.query.endDate) : null;
    
    // Build filter
    const filter = {};
    if (action) filter.action = action;
    if (userId) {
      filter.$or = [
        { performedBy: userId },
        { targetUser: userId }
      ];
    }
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = startDate;
      if (endDate) filter.timestamp.$lte = endDate;
    }
    
    // Get audit logs
    const auditLogs = await AuditLog.find(filter)
      .sort({ [sortField]: sortOrder })
      .skip(skip)
      .limit(limit)
      .populate('performedBy', 'name email')
      .populate('targetUser', 'name email');
    
    // Get total count
    const totalLogs = await AuditLog.countDocuments(filter);
    const totalPages = Math.ceil(totalLogs / limit);
    
    res.status(200).json({
      success: true,
      auditLogs,
      pagination: {
        totalLogs,
        totalPages,
        currentPage: page,
        limit
      }
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve audit logs',
      error: error.message
    });
  }
};

// Dashboard statistics
const getDashboardStats = async (req, res) => {
  try {
    console.log('Getting dashboard statistics...');
    
    // Get total number of users
    const totalUsers = await User.countDocuments();
    console.log('Total users:', totalUsers);
    
    // Get users with premium subscription (any non-free subscription)
    const premiumUsers = await User.countDocuments({ subscription: { $ne: 'free' } });
    console.log('Premium users:', premiumUsers);
    
    // Get total number of active projects (books)
    let activeBooks = 0;
    try {
      // Create a model for the 'projects' collection directly
      const mongoose = require('mongoose');
      
      // Check if model already exists to avoid overwriting
      let Project;
      if (mongoose.models.Project) {
        Project = mongoose.models.Project;
      } else {
        // Define a minimal schema - we just need to count documents
        const projectSchema = new mongoose.Schema({}, { strict: false });
        Project = mongoose.model('Project', projectSchema, 'projects');
      }
      
      console.log('Project model created');
      
      // Count documents
      activeBooks = await Project.countDocuments();
      console.log('Total projects:', activeBooks);
      
    } catch (projectErr) {
      console.error('Project model error:', projectErr.message);
      console.log('Using 0 for project count due to errors');
    }
    
    // Create audit log with try/catch to prevent it from breaking the response
    try {
      await AuditLog.create({
        action: 'VIEW_DASHBOARD_STATS',
        performedBy: req.user.userId
      });
      console.log('Audit log created');
    } catch (auditErr) {
      console.error('Error creating audit log:', auditErr.message);
    }
    
    // Send the response
    console.log('Sending dashboard stats response');
    res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        premiumUsers,
        activeBooks
      }
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve dashboard statistics',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

module.exports = {
  getAllUsers,
  getUserDetails,
  updateUserInfo,
  adminResetPassword,
  impersonateUser,
  exportUserData,
  suspendUser,
  unsuspendUser,
  changeUserRole,
  deleteUser,
  sendNotification,
  bulkUserAction,
  getAuditLogs,
  getDashboardStats,
  getUserBooks,
  deleteBook
}; 