import dotenv from "dotenv";
dotenv.config();

import express from "express";
import authRoutes from "./routes/auth.route.js";

import { connectDB } from "./config/db.js";

const app = express();

// Middleware to parse JSON
app.use(express.json());

// Mount routes
app.use("/api/auth", authRoutes);

// Connect DB
connectDB()
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((error) => {
    console.log(error.message);
    process.exit(1);
  });

export default app;
