const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/server_management_platform';
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`[Database] MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`[Database Error] ${error.message}`);
    console.log('[Database] Please ensure MongoDB is running on localhost:27017');
    process.exit(1);
  }
};

module.exports = connectDB;
