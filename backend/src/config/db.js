const dns = require('dns');
const mongoose = require('mongoose');

// Configure reliable public DNS servers for MongoDB Atlas SRV records
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {
  // Ignore in environments where setting DNS servers is restricted
}

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/server_management_platform';
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 30000,
    });
    console.log(`[Database] MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`[Database Error] ${error.message}`);
    // Retry connection after 5 seconds instead of crashing the web server immediately
    setTimeout(connectDB, 5000);
  }
};

module.exports = connectDB;
