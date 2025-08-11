const Project = require('../models/Project');
const User = require('../models/User');

// Helper: Count images inside arbitrary value (string | object | array)
function countImagesInValue(value) {
  let count = 0;

  if (typeof value === 'string') {
    const text = value;

    // 1) Cloudinary URLs
    const cloudinaryUrlRegex = /https?:\/\/res\.cloudinary\.com\/[\w\-]+\/[\w\-]+\/[\w\-]+\/[^\s)"'>]+/gi;
    const cloudinaryMatches = text.match(cloudinaryUrlRegex);
    if (cloudinaryMatches) count += cloudinaryMatches.length;

    // 2) Markdown images: ![alt](url)
    const markdownImgRegex = /!\[[^\]]*\]\(([^)]+)\)/g;
    let mdMatch;
    while ((mdMatch = markdownImgRegex.exec(text)) !== null) {
      count += 1;
    }

    // 3) HTML <img src="...">
    const htmlImgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let htmlMatch;
    while ((htmlMatch = htmlImgRegex.exec(text)) !== null) {
      count += 1;
    }

    // 4) Placeholder images: {{IMAGE:name|width|height}}
    const placeholderRegex = /\{\{IMAGE:[^|}]*?(?:\|[^|}]*){0,2}\}\}/g;
    const placeholderMatches = text.match(placeholderRegex);
    if (placeholderMatches) count += placeholderMatches.length;

    return count;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      count += countImagesInValue(item);
    }
    return count;
  }

  if (value && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      count += countImagesInValue(value[key]);
    }
    return count;
  }

  return 0;
}

// Function to scan all projects for a user and count image occurrences (robust)
async function scanUserImageUsage(userId, ProjectModel) {
  try {
    // Find all projects owned by or shared with the user
    const projects = await ProjectModel.find({
      $or: [
        { owner: userId },
        { userId: userId },
        { collaborators: userId }
      ]
    }).lean();

    let totalImageCount = 0;

    for (const project of projects) {
      if (project.content) {
        totalImageCount += countImagesInValue(project.content);
      }
    }

    return totalImageCount;
  } catch (error) {
    console.error('Error scanning user image usage:', error);
    return 0;
  }
}

// Function to update a user's imagesUsed count based on actual usage
async function updateUserImageCount(userId, UserModel, ProjectModel) {
  try {
    const actualUsage = await scanUserImageUsage(userId, ProjectModel);
    
    // Update the user's imagesUsed field
    await UserModel.findByIdAndUpdate(userId, { 
      imagesUsed: actualUsage 
    });

    return actualUsage;
  } catch (error) {
    console.error('Error updating user image count:', error);
    return 0;
  }
}

// Function to get all unique Cloudinary image URLs used by a user
async function getUserImageUrls(userId, ProjectModel) {
  try {
    const projects = await ProjectModel.find({
      $or: [
        { owner: userId },
        { userId: userId },
        { collaborators: userId }
      ]
    }).lean();

    const imageUrls = new Set();
    const cloudinaryUrlRegex = /https?:\/\/res\.cloudinary\.com\/[^)\s]+/g;

    for (const project of projects) {
      if (project.content) {
        for (const sectionKey in project.content) {
          const content = project.content[sectionKey];
          if (typeof content === 'string') {
            const matches = content.match(cloudinaryUrlRegex);
            if (matches) {
              matches.forEach(url => imageUrls.add(url));
            }
          }
        }
      }
    }

    return Array.from(imageUrls);
  } catch (error) {
    console.error('Error getting user image URLs:', error);
    return [];
  }
}

// Function to extract public_id from Cloudinary URL
function extractPublicIdFromUrl(cloudinaryUrl) {
  try {
    // Extract public_id from Cloudinary URL
    // Example: https://res.cloudinary.com/cloud_name/image/upload/v1234567890/folder/image.jpg
    const match = cloudinaryUrl.match(/\/v\d+\/(.+?)(?:\.[^.]+)?$/);
    return match ? match[1] : null;
  } catch (error) {
    console.error('Error extracting public_id from URL:', error);
    return null;
  }
}

// Function to find orphaned images (uploaded to Cloudinary but not used in any project)
async function findOrphanedImages(userId, cloudinaryImages, ProjectModel) {
  try {
    // Get all image URLs currently used in projects
    const usedImageUrls = await getUserImageUrls(userId, ProjectModel);
    const usedPublicIds = usedImageUrls
      .map(url => extractPublicIdFromUrl(url))
      .filter(id => id !== null);

    // Find images in Cloudinary that are not used in any project
    const orphanedImages = cloudinaryImages.filter(image => 
      !usedPublicIds.includes(image.public_id)
    );

    return orphanedImages;
  } catch (error) {
    console.error('Error finding orphaned images:', error);
    return [];
  }
}

module.exports = {
  scanUserImageUsage,
  updateUserImageCount,
  getUserImageUrls,
  extractPublicIdFromUrl,
  findOrphanedImages
};