const dns = require('dns');
const mongoose = require('mongoose');

// Configure reliable public DNS servers for MongoDB Atlas SRV records
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {
  // Ignore in environments where setting DNS servers is restricted
}

let lastDbError = null;

const normalizeMongoUri = (uri) => {
  if (!uri || !uri.startsWith('mongodb')) return uri;
  if (uri.includes('.mongodb.net')) {
    const parts = uri.split('?');
    const base = parts[0];
    const query = parts[1] ? `?${parts[1]}` : '';
    if (base.endsWith('.mongodb.net') || base.endsWith('.mongodb.net/')) {
      const cleanBase = base.replace(/\/$/, '');
      return `${cleanBase}/server_management_platform${query}`;
    }
  }
  return uri;
};

const convertSrvToDirect = (uri) => {
  if (!uri || !uri.startsWith('mongodb+srv://')) return null;
  const match = uri.match(/^mongodb\+srv:\/\/([^:]+):([^@]+)@serverpanelcluster0\.rirs7s4\.mongodb\.net\/?([^?]*)/);
  if (!match) return null;
  const [, user, pass, db] = match;
  const dbName = db || 'server_management_platform';
  return `mongodb://${user}:${pass}@ac-dwp2thq-shard-00-00.rirs7s4.mongodb.net:27017,ac-dwp2thq-shard-00-01.rirs7s4.mongodb.net:27017,ac-dwp2thq-shard-00-02.rirs7s4.mongodb.net:27017/${dbName}?ssl=true&replicaSet=atlas-n5gh0d-shard-0&authSource=admin&retryWrites=true&w=majority`;
};

const connectDB = async () => {
  const configuredUri = process.env.MONGO_URI || 'mongodb://localhost:27017/server_management_platform';

  // Check for placeholder credentials
  if (configuredUri.includes('<db_password>') || configuredUri.includes('<password>')) {
    const placeholderMsg = "MONGO_URI contains placeholder '<db_password>'. Please set your actual database password in environment variables.";
    console.error(`[Database Config Error] ${placeholderMsg}`);
    lastDbError = new Error(placeholderMsg);
    setTimeout(connectDB, 10000);
    return null;
  }

  const rawUri = normalizeMongoUri(configuredUri);
  const directUri = convertSrvToDirect(rawUri);

  // If we have a direct replica-set fallback, try SRV first then direct, or direct if SRV is known to fail
  const candidates = directUri ? [rawUri, directUri] : [rawUri];

  for (const uri of candidates) {
    try {
      const isSrv = uri.startsWith('mongodb+srv://');
      console.log(`[Database] Attempting connection via ${isSrv ? 'SRV' : 'Direct/Standard'} URI...`);
      const conn = await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 15000,
      });
      lastDbError = null;
      console.log(`[Database] MongoDB Connected: ${conn.connection.host} (db: ${conn.connection.name})`);

      // Auto-bootstrap initial admin or demo seed if database is freshly initialized (0 users)
      try {
        const { autoBootstrap } = require('../seed/seed');
        await autoBootstrap();
      } catch (bootErr) {
        console.error('[Database Auto-Bootstrap Warning]', bootErr.message);
      }

      return conn;
    } catch (error) {
      lastDbError = error;
      console.error(`[Database Error] (${uri.startsWith('mongodb+srv://') ? 'SRV' : 'Direct'}): ${error.message}`);
    }
  }

  // Retry after 5s
  setTimeout(connectDB, 5000);
};

const getDbDiagnostics = () => {
  const uri = process.env.MONGO_URI || '';
  let maskedHost = 'none (using localhost:27017 fallback)';
  let placeholderDetected = false;

  if (uri) {
    if (uri.includes('<db_password>') || uri.includes('<password>')) {
      placeholderDetected = true;
    }
    try {
      const withoutCreds = uri.replace(/:\/\/[^@]+@/, '://');
      maskedHost = withoutCreds.split('/')[2] || withoutCreds;
    } catch {
      maskedHost = 'configured';
    }
  }

  let errorMsg = lastDbError ? lastDbError.message : null;
  if (placeholderDetected) {
    errorMsg = "MONGO_URI contains placeholder '<db_password>'. Replace with actual Atlas password in environment settings.";
  }

  return {
    configured: Boolean(process.env.MONGO_URI),
    targetHost: maskedHost,
    connected: mongoose.connection.readyState === 1,
    placeholderDetected,
    lastError: errorMsg,
  };
};

module.exports = connectDB;
module.exports.getDbDiagnostics = getDbDiagnostics;


