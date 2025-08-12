const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { verifyToken, verifyTokenStrict } = require('../middleware/auth');
const User = require('../models/User');
const Project = require('../models/Project');
const { scanUserImageUsage } = require('../utils/imageScanner');
const ImageUpload = require('../models/ImageUpload');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Get user's image usage statistics (now usage-based)
router.get('/usage', verifyTokenStrict, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Compute actual usage from content without overwriting upload-based counter
    const actualUsage = await scanUserImageUsage(req.user.userId, Project);
    const used = Math.max(user.imagesUsed || 0, actualUsage);

    // Self-heal: persist the higher value so immediate uploads are reflected
    if (used !== user.imagesUsed) {
      await User.findByIdAndUpdate(req.user.userId, { imagesUsed: used });
    }

    const updatedUser = used === user.imagesUsed ? user : await User.findById(req.user.userId);
    const totalLimit = updatedUser.getTotalImageLimit();

    res.json({
      used,
      allowed: updatedUser.imagesAllowed,
      additional: updatedUser.additionalImageSlots,
      total: totalLimit,
      remaining: totalLimit - used,
      canUpload: used < totalLimit
    });
  } catch (error) {
    console.error('Error fetching image usage:', error);
    res.status(500).json({ error: 'Failed to fetch image usage' });
  }
});

// Check if user can upload more images
router.get('/check-limit', verifyTokenStrict, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const canUpload = user.canUploadImages();
    const totalLimit = user.getTotalImageLimit();

    res.json({
      canUpload,
      used: user.imagesUsed,
      total: totalLimit,
      remaining: totalLimit - user.imagesUsed
    });
  } catch (error) {
    console.error('Error checking image limit:', error);
    res.status(500).json({ error: 'Failed to check image limit' });
  }
});

// Validate image usage for export (export-time check)
router.post('/validate-export', verifyTokenStrict, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get actual usage from project content
    const actualUsage = await scanUserImageUsage(req.user.userId, Project);
    const totalLimit = user.getTotalImageLimit();

    const isValid = actualUsage <= totalLimit;
    const overLimit = Math.max(0, actualUsage - totalLimit);

    res.json({
      valid: isValid,
      used: actualUsage,
      limit: totalLimit,
      overLimit: overLimit,
      message: isValid 
        ? 'Export allowed - within image limits'
        : `Your account contains ${actualUsage} images, but your plan allows ${totalLimit}. Please upgrade your plan or remove ${overLimit} images.`
    });
  } catch (error) {
    console.error('Error validating export:', error);
    res.status(500).json({ error: 'Failed to validate export' });
  }
});

// Get upload URL (pre-signed upload)
router.post('/upload-url', verifyTokenStrict, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const totalLimit = user.getTotalImageLimit();
    if (user.imagesUsed >= totalLimit) {
      return res.status(403).json({ 
        error: `You have reached your image limit (${user.imagesUsed}/${totalLimit}). Please delete some images or purchase additional slots to continue.` 
      });
    }

    // Generate timestamp for unique filename
    const timestamp = Date.now();
    const publicId = `${req.user.userId}/${timestamp}`;

    const signature = cloudinary.utils.api_sign_request({
      timestamp: timestamp,
      public_id: publicId
    }, process.env.CLOUDINARY_API_SECRET);

    res.json({
      signature,
      timestamp,
      api_key: process.env.CLOUDINARY_API_KEY,
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      public_id: publicId
    });
  } catch (error) {
    console.error('Error generating upload URL:', error);
    res.status(500).json({ error: 'Failed to generate upload URL' });
  }
});

// Confirm image upload and update user's count
router.post('/confirm-upload', verifyTokenStrict, async (req, res) => {
  try {
    const { public_id, version, signature } = req.body;
    
    // Verify the upload with Cloudinary
    const expectedSignature = cloudinary.utils.api_sign_request({
      public_id,
      version
    }, process.env.CLOUDINARY_API_SECRET);

    if (signature !== expectedSignature) {
      return res.status(400).json({ error: 'Invalid signature' });
    }

    // Idempotent confirm: create a record if not exists, increment only once
    const created = await ImageUpload.findOneAndUpdate(
      { userId: req.user.userId, publicId: public_id },
      { userId: req.user.userId, publicId: public_id, version },
      { upsert: true, new: false, setDefaultsOnInsert: true }
    );
    if (!created) {
      await User.findByIdAndUpdate(req.user.userId, { $inc: { imagesUsed: 1 } });
    }

    // Construct the image URL
    const url = cloudinary.url(public_id, {
      version: version,
      secure: true
    });

    res.json({ 
      success: true, 
      message: 'Image upload confirmed',
      url: url
    });
  } catch (error) {
    console.error('Error confirming upload:', error);
    res.status(500).json({ error: 'Failed to confirm upload' });
  }
});

// Upload image directly
router.post('/', verifyTokenStrict, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const totalLimit = user.getTotalImageLimit();
    if (user.imagesUsed >= totalLimit) {
      return res.status(403).json({ 
        error: `You have reached your image limit (${user.imagesUsed}/${totalLimit}). Please delete some images or purchase additional slots to continue.` 
      });
    }

    // Upload to Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          resource_type: 'image',
          folder: `user_${req.user.userId}`,
          use_filename: true,
          unique_filename: true
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(req.file.buffer);
    });

    // Direct upload increments once and records entry to prevent future duplicates
    const createdDirect = await ImageUpload.findOneAndUpdate(
      { userId: req.user.userId, publicId: uploadResult.public_id },
      { userId: req.user.userId, publicId: uploadResult.public_id, version: uploadResult.version },
      { upsert: true, new: false, setDefaultsOnInsert: true }
    );
    if (!createdDirect) {
      await User.findByIdAndUpdate(req.user.userId, { $inc: { imagesUsed: 1 } });
    }

    res.json({
      success: true,
      url: uploadResult.secure_url,
      public_id: uploadResult.public_id
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Delete image
router.delete('/:id', verifyTokenStrict, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Delete from Cloudinary
    await cloudinary.uploader.destroy(id);
    
    // Decrement only if we actually had a recorded upload
    const removed = await ImageUpload.findOneAndUpdate(
      { userId: req.user.userId, publicId: id, deletedAt: { $exists: false } },
      { deletedAt: new Date() }
    );
    if (removed && !removed.deletedAt) {
      await User.findByIdAndUpdate(req.user.userId, { $inc: { imagesUsed: -1 } });
    }

    res.json({ success: true, message: 'Image deleted successfully' });
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

module.exports = router;