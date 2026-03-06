const mongoose = require('mongoose');

const blacklistedUserSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1200
    },
    reportCount: {
      type: Number,
      required: true,
      min: 1
    },
    threshold: {
      type: Number,
      required: true,
      min: 1,
      default: 3
    },
    latestReportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserMisuseReport',
      default: null
    },
    reportIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UserMisuseReport'
      }
    ],
    source: {
      type: String,
      trim: true,
      default: 'misuse_report_threshold'
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    blacklistedAt: {
      type: Date,
      default: Date.now
    },
    notifiedAt: {
      type: Date,
      default: null
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

blacklistedUserSchema.index({ blacklistedAt: -1 });
blacklistedUserSchema.index({ reportCount: -1 });

module.exports = mongoose.model('BlacklistedUser', blacklistedUserSchema);
