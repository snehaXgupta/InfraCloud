/**
 * MongoDB Atlas Connection Diagnostics & Verification Tool
 *
 * Usage:
 *   node scripts/test-db-connection.js
 *   node scripts/test-db-connection.js "<mongo_uri>"
 */
require('dotenv').config({ path: `${__dirname}/../.env` });
const dns = require('dns');
const mongoose = require('mongoose');

try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {}

const targetUri = process.argv[2] || process.env.MONGO_URI || 'mongodb://localhost:27017/server_management_platform';

console.log('\n======================================================');
console.log('   MongoDB Connection Diagnostics & Verification');
console.log('======================================================\n');

// 1. Check for placeholder password
if (targetUri.includes('<db_password>') || targetUri.includes('<password>')) {
  console.error('[FAIL] Detected placeholder "<db_password>" in connection URI!');
  console.error('       You must replace "<db_password>" with the actual password');
  console.error('       of user "shubhigupta1078_db_user" created in MongoDB Atlas.\n');
  process.exit(1);
}

// 2. Mask password for logging
const maskedUri = targetUri.replace(/:\/\/[^@]+@/, '://***:***@');
console.log(`[Target URI]: ${maskedUri}`);

// 3. Normalize URI to ensure database name exists
let effectiveUri = targetUri;
if (effectiveUri.includes('.mongodb.net')) {
  const parts = effectiveUri.split('?');
  const base = parts[0];
  const query = parts[1] ? `?${parts[1]}` : '';
  if (base.endsWith('.mongodb.net') || base.endsWith('.mongodb.net/')) {
    effectiveUri = `${base.replace(/\/$/, '')}/server_management_platform${query}`;
    console.log(`[Info] Added database name: ${effectiveUri.replace(/:\/\/[^@]+@/, '://***:***@')}`);
  }
}

(async () => {
  try {
    console.log('\n[Connecting] Attempting connection via Mongoose...');
    const conn = await mongoose.connect(effectiveUri, {
      serverSelectionTimeoutMS: 15000,
    });

    console.log(`[SUCCESS] Connected to MongoDB host: ${conn.connection.host}`);
    console.log(`[SUCCESS] Target Database: ${conn.connection.name}`);

    // Check collections and users
    const User = require('../src/models/User');
    const userCount = await User.countDocuments();
    console.log(`[Status] Users in database: ${userCount}`);

    if (userCount === 0) {
      console.log('\n[WARNING] Database is currently EMPTY (0 users).');
      console.log('          You cannot log in until you seed the database or create an admin.');
      console.log('          Run: npm run seed   OR   npm run create-admin\n');
    } else {
      const users = await User.find().select('name email role');
      console.log('\nAvailable Accounts for Login:');
      users.forEach((u) => {
        console.log(`  - [${u.role}] ${u.email} (${u.name})`);
      });
      console.log('\n[SUCCESS] Everything is configured properly! You can log in with any of the above accounts.\n');
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\n[CONNECTION ERROR]', error.message);
    if (error.message.includes('bad auth')) {
      console.error('\n[Hint]: Authentication failed. Please check:');
      console.error('  1. Did you set the correct database user password in MongoDB Atlas?');
      console.error('  2. Does the password have special characters? (If so, they must be URL-encoded, e.g. @ -> %40)');
      console.error('  3. In MongoDB Atlas -> Database Access, verify "shubhigupta1078_db_user" exists.\n');
    } else if (error.message.includes('querySrv') || error.message.includes('ENOTFOUND')) {
      console.error('\n[Hint]: DNS SRV resolution failed. Make sure your network or hosting provider allows DNS lookups.\n');
    } else if (error.message.includes('selection timed out')) {
      console.error('\n[Hint]: Connection timed out. Please check:');
      console.error('  1. In MongoDB Atlas -> Network Access -> IP Access List:');
      console.error('     Ensure "0.0.0.0/0" (Allow Access from Anywhere) is added.');
      console.error('     (Render and cloud providers use dynamic IP addresses that will be blocked otherwise).\n');
    }
    process.exit(1);
  }
})();
