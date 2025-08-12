const mongoose = require('mongoose');

const ImageUploadSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  publicId: { type: String, required: true },
  version: { type: String },
  createdAt: { type: Date, default: Date.now },
  deletedAt: { type: Date },
});

ImageUploadSchema.index({ userId: 1, publicId: 1 }, { unique: true });

module.exports = mongoose.model('ImageUpload', ImageUploadSchema);


