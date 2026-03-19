const mongoose = require('mongoose');
const {
  COMPLAINT_STATUS,
  COMPLAINT_STATUS_VALUES,
  AI_PROCESSING_STATUS,
  AI_PROCESSING_STATUS_VALUES,
  OFFICE_TYPE_VALUES
} = require('../constants/complaint');

const complaintSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000
    },
    category: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    images: [
      {
        url: {
          type: String,
          required: true,
          trim: true
        },
        uploadedAt: {
          type: Date,
          default: Date.now
        }
      }
    ],
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
    status: {
      type: String,
      enum: COMPLAINT_STATUS_VALUES,
      default: COMPLAINT_STATUS.REPORTED
    },
    resolutionRemark: {
      type: String,
      trim: true,
      maxlength: 1200,
      default: null
    },
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: 1200,
      default: null
    },
    statusHistory: [
      {
        status: {
          type: String,
          enum: COMPLAINT_STATUS_VALUES,
          required: true
        },
        remark: {
          type: String,
          trim: true,
          maxlength: 1200,
          default: null
        },
        rejectionReason: {
          type: String,
          trim: true,
          maxlength: 1200,
          default: null
        },
        updatedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          default: null
        },
        updatedByRole: {
          type: String,
          default: null
        },
        updatedAt: {
          type: Date,
          default: Date.now
        }
      }
    ],
    severityScore: {
      type: Number,
      default: 0
    },
    priority: {
      score: {
        type: Number,
        default: 0
      },
      level: {
        type: String,
        default: 'low'
      },
      reason: {
        type: String,
        default: null
      },
      reasonSentence: {
        type: String,
        default: null
      },
      aiProcessed: {
        type: Boolean,
        default: false
      },
      aiProcessingStatus: {
        type: String,
        enum: AI_PROCESSING_STATUS_VALUES,
        default: AI_PROCESSING_STATUS.PENDING
      },
      escalation: {
        stage: {
          type: String,
          default: null
        },
        lastEscalatedAt: {
          type: Date,
          default: null
        },
        reason: {
          type: String,
          default: null
        }
      }
    },
    aiMeta: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    duplicateInfo: {
      isDuplicate: {
        type: Boolean,
        default: false
      },
      masterComplaintId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Complaint',
        default: null
      },
      duplicateCount: {
        type: Number,
        default: 0
      }
    },
    assignedMunicipalOffice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MunicipalOffice',
      default: null
    },
    assignedOfficeType: {
      type: String,
      enum: OFFICE_TYPE_VALUES,
      default: null
    },
    routingDistanceMeters: {
      type: Number,
      default: null
    },
    routingReason: {
      type: String,
      default: null
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  {
    timestamps: true
  }
);

complaintSchema.index({ location: '2dsphere' });
complaintSchema.index({ category: 1 });
complaintSchema.index({ status: 1 });
complaintSchema.index({ 'priority.score': -1 });

module.exports = mongoose.model('Complaint', complaintSchema);
