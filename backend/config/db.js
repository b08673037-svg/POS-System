import mongoose from "mongoose";

/**
 * Connects to MongoDB using the MONGO_URI from .env
 * Exits the process if the connection fails, because the API
 * is useless without a database.
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📦 Database: ${conn.connection.name}`);
  } catch (error) {
    console.error(`❌ MongoDB connection failed: ${error.message}`);
    process.exit(1); // 1 = exit with failure
  }
};

export default connectDB;