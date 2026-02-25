const mongoose = require('mongoose');

const sensitiveLocationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    type: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    category: {
      type: String,
      trim: true,
      maxlength: 120,
      default: null
    },
    priorityWeight: {
      type: Number,
      min: 1,
      max: 10,
      default: 1
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1200,
      default: null
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        required: true
      },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator: (coordinates) => Array.isArray(coordinates) && coordinates.length === 2,
          message: 'Location coordinates must be [longitude, latitude]'
        }
      }
    },
    radiusMeters: {
      type: Number,
      min: 10,
      max: 10000,
      default: 150
    },
    mapLink: {
      type: String,
      trim: true,
      default: null
    },
    isActive: {
      type: Boolean,
      default: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  {
    timestamps: true
  }
);

sensitiveLocationSchema.pre('validate', function syncLegacyCategory(next) {
  if (!this.type && this.category) {
    this.type = this.category;
  }

  if (!this.category && this.type) {
    this.category = this.type;
  }

  next();
});

sensitiveLocationSchema.index({ location: '2dsphere' });
sensitiveLocationSchema.index({ isActive: 1 });
sensitiveLocationSchema.index({ type: 1 });
sensitiveLocationSchema.index({ priorityWeight: -1 });

module.exports = mongoose.model('SensitiveLocation', sensitiveLocationSchema);
