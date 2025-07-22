const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ProjectSchema = new Schema({
  title: {
    type: String,
    required: [true, 'Project title is required'],
    trim: true,
    maxlength: [100, 'Project title cannot be more than 100 characters']
  },
  author: {
    type: String,
    default: ''
  },
  subtitle: {
    type: String,
    default: ''
  },
  isbn: {
    type: String,
    default: ''
  },
  description: {
    type: String,
    required: false,
    default: '',
    trim: true
  },
  status: {
    type: String,
    enum: ['planning', 'in-progress', 'completed', 'on-hold'],
    default: 'planning'
  },
  owner: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: false,
    default: null
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  collaborators: [{
    type: Schema.Types.ObjectId,
    ref: 'User'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  content: {
    type: Object,
    default: {}
  },
  structure: {
    type: Object,
    default: {
      front: ["Title Page", "Copyright", "Dedication", "Acknowledgments"],
      main: ["Chapter 1", "Chapter 2", "Chapter 3"],
      back: ["About the Author"]
    }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Project', ProjectSchema); 