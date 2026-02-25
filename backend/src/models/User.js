const mongoose = require('mongoose');
const { ROLE_VALUES } = require('../constants/roles');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 255
    },
    passwordHash: {
      type: String,
      required: true,
      select: false
    },
    role: {
      type: String,
      enum: ROLE_VALUES,
      default: 'citizen'
    },
    municipalOfficeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MunicipalOffice',
      default: null
    },
    language: {
      type: String,
      enum: ['en', 'ta', 'hi'],
      default: 'en'
    },
    isActive: {
      type: Boolean,
      default: true
    },
    deviceToken: {
      type: String,
      trim: true,
      default: null
    },
    profilePhotoUrl: {
      type: String,
      trim: true,
      default: null
    },
    refreshTokenHash: {
      type: String,
      default: null,
      select: false
    }
  },
  {
    timestamps: true
  }
);

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.refreshTokenHash;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('User', userSchema);
