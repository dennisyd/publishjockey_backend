const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { verifyToken, verifyTokenStrict } = require('../middleware/auth');
const { validateCsrfToken } = require('../middleware/csrf');
const User = require('../models/User');
const Project = require('../models/Project');
const { scanUserImageUsage, updateUserImageCount } = require('../utils/imageScanner');
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

// Get user's image usage statistics (content scan; fast)
router.get('/usage', verifyTokenStrict, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Count images by scanning user's projects for Cloudinary URLs and image tags
    const actualUsage = await scanUserImageUsage(req.user.userId, Project);
    const totalLimit = user.getTotalImageLimit();

    // Persist canonical used value from scan when different
    if (actualUsage !== (user.imagesUsed || 0)) {
      await User.findByIdAndUpdate(req.user.userId, { imagesUsed: actualUsage });
    }

    res.json({
      used: actualUsage,
      allowed: user.imagesAllowed,
      additional: user.additionalImageSlots,
      total: totalLimit,
      remaining: totalLimit - actualUsage,
      canUpload: actualUsage < totalLimit
    });
  } catch (error) {
    console.error('Error fetching image usage:', error);
    res.status(500).json({ error: 'Failed to fetch image usage' });
  }
});

// Force a fast recount based on content and persist it
router.post('/recount', verifyTokenStrict, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const actualUsage = await updateUserImageCount(req.user.userId, User, Project);
    const totalLimit = user.getTotalImageLimit();

    res.json({
      success: true,
      used: actualUsage,
      total: totalLimit,
      remaining: totalLimit - actualUsage,
      canUpload: actualUsage < totalLimit
    });
  } catch (error) {
    console.error('Error recounting image usage:', error);
    res.status(500).json({ error: 'Failed to recount image usage' });
  }
});

// Check if user can upload more images
router.get('/check-limit', verifyTokenStrict, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const ledgerCount = await ImageUpload.countDocuments({ userId: req.user.userId, deletedAt: { $exists: false } });
    const totalLimit = user.getTotalImageLimit();

    res.json({
      canUpload: ledgerCount < totalLimit,
      used: ledgerCount,
      total: totalLimit,
      remaining: totalLimit - ledgerCount
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
router.post('/upload-url', verifyTokenStrict, validateCsrfToken, async (req, res) => {
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

// Confirm image upload (no counter update; counting is content-based)
router.post('/confirm-upload', verifyTokenStrict, validateCsrfToken, async (req, res) => {
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

    // Optionally record the upload for diagnostics, but do not change counters
    await ImageUpload.findOneAndUpdate(
      { userId: req.user.userId, publicId: public_id },
      { userId: req.user.userId, publicId: public_id, version },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Construct the image URL
    const url = cloudinary.url(public_id, {
      version: version,
      secure: true
    });

    res.json({ success: true, message: 'Image upload confirmed', url });
  } catch (error) {
    console.error('Error confirming upload:', error);
    res.status(500).json({ error: 'Failed to confirm upload' });
  }
});

// Upload image directly (no counter update; counting is content-based)
router.post('/', verifyTokenStrict, validateCsrfToken, upload.single('image'), async (req, res) => {
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

    // Record upload for diagnostics, but do not update counters here
    await ImageUpload.findOneAndUpdate(
      { userId: req.user.userId, publicId: uploadResult.public_id },
      { userId: req.user.userId, publicId: uploadResult.public_id, version: uploadResult.version },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, url: uploadResult.secure_url, public_id: uploadResult.public_id });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Delete image (no counter update; counting is content-based)
router.delete('/:id', verifyTokenStrict, validateCsrfToken, async (req, res) => {
  try {
    const { id } = req.params;
    // Normalize id: may be Cloudinary public_id or a full URL
    let publicId = id;
    if (/^https?:\/\//i.test(id)) {
      try {
        const { extractPublicIdFromUrl } = require('../utils/imageScanner');
        const extracted = extractPublicIdFromUrl(id);
        if (extracted) publicId = extracted;
      } catch (e) {
        console.warn('[images] delete: failed to normalize URL to public_id', { id });
      }
    }

    // Delete from Cloudinary
    await cloudinary.uploader.destroy(publicId);
    
    // Mark as deleted in diagnostics ledger (optional), but do not change counters here
    await ImageUpload.findOneAndUpdate(
      { userId: req.user.userId, publicId: publicId },
      { deletedAt: new Date() }
    );

    res.json({ success: true, message: 'Image deleted successfully' });
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

module.exports = router;