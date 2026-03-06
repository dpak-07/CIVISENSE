const mongoose = require('mongoose');
const { OFFICE_TYPE_VALUES } = require('../constants/complaint');

const municipalOfficeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    type: {
      type: String,
      enum: OFFICE_TYPE_VALUES,
      required: true
    },
    zone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
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
    mapLink: {
      type: String,
      trim: true,
      default: null
    },
    officerCredentials: {
      officerName: {
        type: String,
        trim: true,
        maxlength: 120,
        default: null
      },
      officerEmail: {
        type: String,
        trim: true,
        lowercase: true,
        maxlength: 255,
        default: null
      },
      officerPassword: {
        type: String,
        trim: true,
        maxlength: 120,
        default: null
      }
    },
    workload: {
      type: Number,
      default: 0,
      min: 0
    },
    maxCapacity: {
      type: Number,
      required: true,
      min: 1
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

municipalOfficeSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('MunicipalOffice', municipalOfficeSchema);
