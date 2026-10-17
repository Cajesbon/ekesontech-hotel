const mongoose = require('mongoose');

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set in environment variables.');
    process.exit(1);
  }

  mongoose.set('strictQuery', true);

  try {
    await mongoose.connect(uri, {
      autoIndex: process.env.NODE_ENV !== 'production'
    });
    console.log(`MongoDB connected: ${mongoose.connection.host}`);
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  }

  mongoose.connection.on('disconnected', () => {
    console.warn('MongoDB disconnected.');
  });
}

module.exports = connectDB;
