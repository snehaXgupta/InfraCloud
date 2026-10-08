const mongoose = require('mongoose');

/**
 * Cost records (discovery doc §11).
 *  - kind 'estimated': one row per server per billing day, accrued from the server's monthly rate
 *    by the scheduled ingestion job.
 *  - kind 'actual': one row per server per month, imported from a provider invoice. Actuals
 *    replace the estimate for that server and month. `date` holds the last day of the month.
 * Client/project ids are copied at capture time so history stays attributed to the owner
 * the server had on that day.
 */
const costSnapshotSchema = new mongoose.Schema(
  {
    serverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Server', required: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Client' },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    environmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Environment' },
    provider: { type: String },
    instanceType: { type: String },
    kind: { type: String, enum: ['estimated', 'actual'], required: true },
    date: { type: String, required: true }, // YYYY-MM-DD in the billing timezone
    month: { type: String, required: true }, // YYYY-MM
    amount: { type: Number, required: true, min: 0 },
    monthlyRate: { type: Number, min: 0 }, // estimated rows: the rate the accrual was based on
    currency: { type: String, required: true },
    source: {
      type: String,
      enum: ['manual-rate', 'provider-api', 'plan-catalog', 'size-match', 'unpriced', 'invoice'],
      required: true,
    },
    capturedAt: { type: Date, default: Date.now },
    importedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

costSnapshotSchema.index({ serverId: 1, kind: 1, date: 1 }, { unique: true });
costSnapshotSchema.index({ month: 1, kind: 1, clientId: 1 });

module.exports = mongoose.model('CostSnapshot', costSnapshotSchema);
