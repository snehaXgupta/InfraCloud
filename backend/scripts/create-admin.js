/**
 * Bootstrap the first Platform Admin on a fresh (production) database.
 *
 *   ADMIN_EMAIL=ops@company.com ADMIN_PASSWORD='long-random-pass' npm run create-admin
 *
 * Re-running with an existing email resets that user's password and makes them an active
 * Platform Admin (useful for account recovery).
 */
require('dotenv').config({ path: `${__dirname}/../.env` });
const mongoose = require('mongoose');
const User = require('../src/models/User');

(async () => {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  const name = process.env.ADMIN_NAME || 'Platform Admin';

  if (!email || password.length < 12) {
    console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD (at least 12 characters).');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/server_management_platform');

  let user = await User.findOne({ email }).select('+passwordHash');
  if (user) {
    user.passwordHash = password; // re-hashed by the model's pre-save hook
    user.role = 'Platform Admin';
    user.status = 'active';
    await user.save();
    console.log(`Updated ${email}: password reset, role Platform Admin.`);
  } else {
    user = await User.create({ name, email, passwordHash: password, role: 'Platform Admin', status: 'active' });
    console.log(`Created Platform Admin ${email}.`);
  }

  await mongoose.disconnect();
})().catch((err) => {
  console.error('create-admin failed:', err.message);
  process.exit(1);
});
