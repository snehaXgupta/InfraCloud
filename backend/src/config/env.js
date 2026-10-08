/**
 * Central runtime configuration. In production, missing or weak secrets stop the process
 * at boot instead of silently falling back to development defaults.
 */
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';
const DEV_JWT_SECRET = 'dev_jwt_secret_key_server_management_infra_2026';

const problems = [];
if (isProduction) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET === DEV_JWT_SECRET) {
    problems.push('JWT_SECRET must be set to a random value of at least 32 characters');
  }
  if (!process.env.MONGO_URI) problems.push('MONGO_URI must be set');
  if (!process.env.CLIENT_URL) problems.push('CLIENT_URL must be set to the public URL of the panel');
  if (!/^[0-9a-f]{64}$/i.test(process.env.INTEGRATION_SECRET_KEY || '')) {
    problems.push('INTEGRATION_SECRET_KEY must be 64 hex characters (openssl rand -hex 32); it encrypts provider API keys');
  }
}
if (problems.length) {
  console.error(`[Config] Refusing to start in production:\n  - ${problems.join('\n  - ')}`);
  process.exit(1);
}

module.exports = {
  isProduction,
  JWT_SECRET: process.env.JWT_SECRET || DEV_JWT_SECRET,
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  ENABLE_WEB_TERMINAL: process.env.ENABLE_WEB_TERMINAL === 'true',
  // Dev fallback is derived from the JWT secret; production requires its own key (checked above)
  INTEGRATION_SECRET_KEY:
    process.env.INTEGRATION_SECRET_KEY ||
    require('crypto').createHash('sha256').update(`integrations:${process.env.JWT_SECRET || DEV_JWT_SECRET}`).digest('hex'),
  // Real provider calls (Vultr) for resize stay off until validated; the simulated provider always works
  ENABLE_RESIZE_EXECUTION: process.env.ENABLE_RESIZE_EXECUTION === 'true',
};
