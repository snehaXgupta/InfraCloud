const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema(
  {
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: [true, 'Project must belong to a Client'],
    },
    name: {
      type: String,
      required: [true, 'Please provide a project name'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    repositoryUrl: {
      type: String,
      default: '',
    },
    techStack: [
      {
        type: String,
      },
    ],
    status: {
      type: String,
      enum: ['active', 'archived', 'deploying', 'maintenance'],
      default: 'active',
    },
    leadDevOps: {
      type: String,
      default: 'Infra Core Team',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

projectSchema.virtual('environments', {
  ref: 'Environment',
  localField: '_id',
  foreignField: 'projectId',
  justOne: false,
});

module.exports = mongoose.model('Project', projectSchema);
