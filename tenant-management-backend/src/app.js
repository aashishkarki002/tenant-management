import dotenv from "dotenv";
dotenv.config();

import express from "express";
import authRoute from "./modules/auth/auth.route.js";
import propertyRoute from "./modules/tenant/property.route.js";
import { connectDB } from "./config/db.js";

const app = express();

// Middleware to parse JSON
app.use(express.json());

// Mount routes
app.use("/api/auth", authRoute);
app.use("/api/property", propertyRoute);
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
