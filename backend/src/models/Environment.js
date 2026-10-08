const mongoose = require('mongoose');

const environmentSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Environment must belong to a Project'],
    },
    name: {
      type: String,
      required: [true, 'Please provide an environment name'],
      trim: true,
    },
    type: {
      type: String,
      enum: ['Development', 'Staging', 'Production', 'QA', 'DR'],
      required: [true, 'Please specify environment type (Development, Staging, Production)'],
    },
    status: {
      type: String,
      enum: ['healthy', 'degraded', 'deploying', 'offline'],
      default: 'healthy',
    },
    clusterUrl: {
      type: String,
      default: '',
    },
    variablesCount: {
      type: Number,
      default: 12,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

environmentSchema.virtual('servers', {
  ref: 'Server',
  localField: '_id',
  foreignField: 'environmentId',
  justOne: false,
});

module.exports = mongoose.model('Environment', environmentSchema);
