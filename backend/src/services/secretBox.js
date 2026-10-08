/**
 * AES-256-GCM encryption for secrets stored in MongoDB (provider API keys).
 * Stored form: { iv, tag, data } base64 strings. The key never touches the database.
 */
const crypto = require('crypto');
const { INTEGRATION_SECRET_KEY } = require('../config/env');

const KEY = Buffer.from(INTEGRATION_SECRET_KEY, 'hex');

const seal = (plaintext) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const data = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  return { iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') };
};

const open = (box) => {
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, Buffer.from(box.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(box.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(box.data, 'base64')), decipher.final()]).toString('utf8');
};

module.exports = { seal, open };
