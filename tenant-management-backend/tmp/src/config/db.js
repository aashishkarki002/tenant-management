import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
    if (!uri || uri.trim() === "") {
      throw new Error(
        "MONGODB_URI (or MONGO_URI) is not defined in .env. " +
          "Set MONGODB_URI=your_mongodb_connection_string",
      );
    }
    await mongoose.connect(uri);
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Database connection error:", error.message);
    process.exit(1);
  }
};
