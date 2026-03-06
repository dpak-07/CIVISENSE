const mongoose = require('mongoose');
const { ROLE_VALUES } = require('../constants/roles');

const userMisuseReportSchema = new mongoose.Schema(
  {
    complaintId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Complaint',
      required: true
    },
    reportedUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    reportedByRole: {
      type: String,
      enum: ROLE_VALUES,
      required: true
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1200
    },
    note: {
      type: String,
      trim: true,
      maxlength: 1200,
      default: null
    }
  },
  {
    timestamps: true
  }
);

userMisuseReportSchema.index({ reportedUserId: 1, createdAt: -1 });
userMisuseReportSchema.index({ reportedBy: 1, createdAt: -1 });
userMisuseReportSchema.index({ complaintId: 1, reportedBy: 1 }, { unique: true });

module.exports = mongoose.model('UserMisuseReport', userMisuseReportSchema);
