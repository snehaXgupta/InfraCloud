const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a client name'],
      trim: true,
      unique: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'inactive'],
      default: 'active',
    },
    contactEmail: {
      type: String,
      default: '',
    },
    tier: {
      type: String,
      enum: ['Enterprise', 'Business', 'Startup', 'Internal'],
      default: 'Enterprise',
    },
    sla: {
      type: String,
      default: '99.95% High Availability',
    },
    billingReference: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

clientSchema.virtual('projects', {
  ref: 'Project',
  localField: '_id',
  foreignField: 'clientId',
  justOne: false,
});

module.exports = mongoose.model('Client', clientSchema);
