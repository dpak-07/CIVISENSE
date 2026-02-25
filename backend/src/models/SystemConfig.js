const mongoose = require('mongoose');

const systemConfigSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'app_distribution'
    },
    androidApkUrl: {
      type: String,
      trim: true,
      default: 'https://github.com/dpak-07/CIVISENCE/releases'
    },
    iosNote: {
      type: String,
      trim: true,
      default:
        'iOS build is coming soon. Apple dev tools asked for money, our startup wallet said "buffering...".'
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('SystemConfig', systemConfigSchema);

