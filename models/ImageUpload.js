const mongoose = require('mongoose');

const ImageUploadSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  publicId: { type: String, required: true },
  version: { type: String },
  createdAt: { type: Date, default: Date.now },
  deletedAt: { type: Date },
});

ImageUploadSchema.index({ userId: 1, publicId: 1 }, { unique: true });

// TTL index to automatically purge deletion log entries after a retention window
// Only applies when deletedAt exists
ImageUploadSchema.index(
  { deletedAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 3, partialFilterExpression: { deletedAt: { $exists: true } } }
);

module.exports = mongoose.model('ImageUpload', ImageUploadSchema);


