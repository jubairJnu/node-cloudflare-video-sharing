import mongoose from "mongoose";
import config from "../../app/config";

export const connectDB = async () => {
  try {
    await mongoose.connect(config.DB_URL!);
    console.log("✅ Connected to MongoDB");
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    process.exit(1);
  }
};
