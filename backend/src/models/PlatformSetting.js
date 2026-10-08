const mongoose = require('mongoose');

// Small key/value store for platform-wide switches changed from the UI (e.g. muting alert email).
const platformSettingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: mongoose.Schema.Types.Mixed },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PlatformSetting', platformSettingSchema);
