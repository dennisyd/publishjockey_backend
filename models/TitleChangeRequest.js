const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const TitleChangeRequestSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  oldTitle: { type: String, required: true },
  newTitle: { type: String, required: true },
  similarityDelta: { type: Number, required: true }, // percentage 0-100
  triggerReason: { type: String, required: true },
  status: { type: String, enum: ['Pending', 'Approved', 'Denied', 'Cancelled'], default: 'Pending', index: true },
  requestedAt: { type: Date, default: Date.now },
  decidedAt: { type: Date },
  decidedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  denialReason: { type: String },
  adminNotes: { type: String },
}, { timestamps: true });

// Ensure only one pending per project
TitleChangeRequestSchema.index({ projectId: 1, status: 1 });

module.exports = mongoose.model('TitleChangeRequest', TitleChangeRequestSchema);


