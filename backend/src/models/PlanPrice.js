const mongoose = require('mongoose');

// Plan prices synced from provider APIs; these override the built-in list prices.
const planPriceSchema = new mongoose.Schema(
  {
    provider: { type: String, required: true },
    type: { type: String, required: true },
    vcpu: Number,
    ramGb: Number,
    diskGb: Number,
    priceMonthly: Number,
    family: String,
    syncedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

planPriceSchema.index({ provider: 1, type: 1 }, { unique: true });

module.exports = mongoose.model('PlanPrice', planPriceSchema);
