const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { generateRandomToken } = require('../utils/tokenUtils');
const { sendPasswordResetEmail, sendNotificationEmail, sendPasswordChangeEmail } = require('../utils/emailUtils');
const { fixBookAllowances, fixUserBookAllowance } = require('../utils/fixBookAllowances');

// FIXED: Moved helper functions to top to resolve "Failed to delete book" 500 error
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
    console.log('🔍 UPDATE USER START:', { userId: req.params.userId, body: req.body });
    
    const { userId } = req.params;
    const { name, email, role, subscription } = req.body;
    
    // Find user
    console.log('🔍 Finding user...');
    const user = await User.findById(userId);
    
    if (!user) {
      console.log('❌ User not found:', userId);
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    console.log('✅ User found:', user.email);
    
    // Prepare update data
    console.log('🔍 Preparing update data...');
    const updateData = {};
    if (name) updateData.name = name;
    if (email && email !== user.email) {
      console.log('🔍 Checking if email is already in use...');
      // Check if email is already in use
      const existingUser = await User.findOne({ email, _id: { $ne: userId } });
      if (existingUser) {
        console.log('❌ Email already in use:', email);
        return res.status(400).json({
          success: false,
          message: 'Email already in use'
        });
      }
      updateData.email = email;
    }
    if (role) updateData.role = role;
    if (subscription) updateData.subscription = subscription;
    
    console.log('🔍 Update data prepared:', updateData);
    
    // Update user
    console.log('🔍 Updating user in database...');
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password -resetPasswordToken -resetPasswordExpires -verificationToken -verificationTokenExpires');
    
    console.log('✅ User updated in database');
    
    // Create audit log
    console.log('🔍 Creating audit log...');
    try {
      await AuditLog.create({
        action: 'UPDATE_USER',
        performedBy: req.user.userId,
        targetUser: userId,
        details: updateData
      });
      console.log('✅ Audit log created');
    } catch (auditError) {
      console.error('Error creating audit log:', auditError);
      // Don't fail the entire operation for audit log issues
    }
    
    console.log('✅ UPDATE USER SUCCESS');
    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('❌ UPDATE USER ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
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
      const Project = require('../models/Project');
      
      // Find all projects first to get image information
      const userProjects = await Project.find({ userId: userId }).lean();
      deletionReport.booksDeleted = userProjects.length;
      
             // Delete all projects
       const deleteResult = await Project.deleteMany({ userId: userId });
       console.log(`Deleted ${deleteResult.deletedCount} projects for user ${userId}`);
       
       // Update user's books remaining count to full allowance
       try {
         const user = await User.findById(userId);
         if (user) {
           user.booksRemaining = user.booksAllowed;
           await user.save();
           console.log(`Reset books remaining for user ${userId} to full allowance: ${user.booksRemaining}/${user.booksAllowed}`);
         }
       } catch (userUpdateError) {
         console.error('Error updating user books remaining:', userUpdateError);
         deletionReport.errors.push(`User allowance update error: ${userUpdateError.message}`);
       }
       
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

    // Get user's projects/books using proper Project model
    const Project = require('../models/Project');
    
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

// FIXED: Book deletion now works properly with helper functions defined at top
// Delete specific book
const deleteBook = async (req, res) => {
  try {
    console.log('🔍 DELETE BOOK START:', { userId: req.params.userId, bookId: req.params.bookId });
    
    const { userId, bookId } = req.params;
    
    if (!userId || !bookId) {
      console.log('❌ Invalid parameters:', { userId, bookId });
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID or book ID provided'
      });
    }

    // Verify user exists
    console.log('🔍 Verifying user exists...');
    const user = await User.findById(userId);
    if (!user) {
      console.log('❌ User not found:', userId);
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    console.log('✅ User found:', user.email);

    // Get and delete the specific book using proper Project model
    console.log('🔍 Finding book...');
    const Project = require('../models/Project');
    
    const book = await Project.findOne({ _id: bookId, userId: userId });
    if (!book) {
      console.log('❌ Book not found:', { bookId, userId });
      return res.status(404).json({
        success: false,
        message: 'Book not found or does not belong to this user'
      });
    }
    console.log('✅ Book found:', book.title);

    const deletionReport = {
      bookDeleted: false,
      imagesDeleted: 0,
      errors: []
    };

    // Extract and delete images from the book content
    console.log('🔍 Processing images...');
    try {
      // Only process images if Cloudinary is configured
      if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
        const cloudinary = require('cloudinary').v2;
        
        // Configure Cloudinary
        cloudinary.config({
          cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
          api_key: process.env.CLOUDINARY_API_KEY,
          api_secret: process.env.CLOUDINARY_API_SECRET
        });

        // Extract image URLs from book content
        const imageUrls = extractImageUrlsFromContent(book.content);
        console.log(`Found ${imageUrls.length} images to delete`);
        
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
      } else {
        console.log('⚠️ Cloudinary not configured, skipping image deletion');
        deletionReport.errors.push('Cloudinary not configured - images not deleted');
      }
    } catch (imageError) {
      console.error('Error processing images:', imageError);
      deletionReport.errors.push(`Image processing error: ${imageError.message}`);
    }

    // Delete the book
    console.log('🔍 Deleting book from database...');
    await Project.findByIdAndDelete(bookId);
    deletionReport.bookDeleted = true;
    console.log('✅ Book deleted from database');

    // FIXED: Book allowance now properly increments when admin deletes a book
    // Increment the user's books remaining count
    console.log('🔍 Updating user books remaining...');
    try {
      const userForUpdate = await User.findById(userId);
      if (userForUpdate && userForUpdate.booksRemaining < userForUpdate.booksAllowed) {
        userForUpdate.booksRemaining += 1;
        await userForUpdate.save();
        console.log(`✅ Updated books remaining for user ${userId}: ${userForUpdate.booksRemaining}/${userForUpdate.booksAllowed}`);
      } else {
        console.log(`⚠️ Not updating books remaining: current=${userForUpdate?.booksRemaining}, allowed=${userForUpdate?.booksAllowed}`);
      }
    } catch (userUpdateError) {
      console.error('Error updating user books remaining:', userUpdateError);
      deletionReport.errors.push(`User allowance update error: ${userUpdateError.message}`);
    }

    // Create audit log
    console.log('🔍 Creating audit log...');
    try {
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
      console.log('✅ Audit log created');
    } catch (auditError) {
      console.error('Error creating audit log:', auditError);
      deletionReport.errors.push(`Audit log error: ${auditError.message}`);
      // Don't fail the entire operation for audit log issues
    }

    console.log('✅ DELETE BOOK SUCCESS:', deletionReport);
    res.status(200).json({
      success: true,
      message: 'Book deleted successfully',
      deletionReport: deletionReport
    });

  } catch (error) {
    console.error('❌ DELETE BOOK ERROR:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete book',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
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
      // Use proper Project model
      const Project = require('../models/Project');
      
      console.log('Project model loaded');
      
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

// Fix book allowances for all users
const fixAllBookAllowances = async (req, res) => {
  try {
    console.log('Admin requested book allowance fix for all users');
    
    // Run the fix
    await fixBookAllowances();
    
    // Create audit log
    await AuditLog.create({
      action: 'FIX_BOOK_ALLOWANCES',
      performedBy: req.user.userId,
      details: { scope: 'all_users' }
    });
    
    res.status(200).json({
      success: true,
      message: 'Book allowances have been recalculated and fixed for all users'
    });
  } catch (error) {
    console.error('Fix book allowances error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fix book allowances',
      error: error.message
    });
  }
};

// Fix book allowance for a specific user
const fixUserBookAllowanceAdmin = async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }
    
    console.log(`Admin requested book allowance fix for user: ${userId}`);
    
    // Run the fix for specific user
    await fixUserBookAllowance(userId);
    
    // Create audit log
    await AuditLog.create({
      action: 'FIX_USER_BOOK_ALLOWANCE',
      performedBy: req.user.userId,
      targetUser: userId
    });
    
    res.status(200).json({
      success: true,
      message: 'User book allowance has been recalculated and fixed'
    });
  } catch (error) {
    console.error('Fix user book allowance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fix user book allowance',
      error: error.message
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
  deleteBook,
  fixAllBookAllowances,
  fixUserBookAllowanceAdmin
}; 