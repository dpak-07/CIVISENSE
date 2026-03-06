const mongoose = require('mongoose');

const developerProfileSchema = new mongoose.Schema(
  {
    profileType: {
      type: String,
      enum: ['team', 'mentor'],
      default: 'team',
      required: true
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 140
    },
    role: {
      type: String,
      required: true,
      trim: true,
      maxlength: 240
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2400
    },
    photoUrl: {
      type: String,
      trim: true,
      default: null
    },
    skills: {
      type: [String],
      default: []
    },
    highlights: {
      type: [String],
      default: []
    },
    socials: {
      github: {
        type: String,
        trim: true,
        default: '#'
      },
      linkedin: {
        type: String,
        trim: true,
        default: '#'
      },
      portfolio: {
        type: String,
        trim: true,
        default: '#'
      }
    },
    displayOrder: {
      type: Number,
      min: 0,
      default: 100
    },
    isActive: {
      type: Boolean,
      default: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  {
    timestamps: true,
    collection: 'developer_profiles'
  }
);

developerProfileSchema.index({ profileType: 1, isActive: 1, displayOrder: 1, createdAt: 1 });

module.exports = mongoose.model('DeveloperProfile', developerProfileSchema);
