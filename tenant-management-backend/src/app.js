import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import authRoute from "./modules/auth/auth.route.js";
import propertyRoute from "./modules/tenant/property.route.js";
import { connectDB } from "./config/db.js";
import cookieParser from "cookie-parser";
import tenantRoute from "./modules/tenant/tenant.route.js";
import rentRoute from "./modules/rents/rent.route.js";
import bankRoute from "./modules/banks/bank.route.js";
import unitRoute from "./modules/tenant/units/unit.route.js";
const app = express();

// CORS middleware - must be before routes
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173", // Vite default port
    credentials: true, // Allow cookies/credentials
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    exposedHeaders: ["Authorization"],
  })
);
app.use(cookieParser());
// Middleware to parse JSON
app.use(express.json());

// Mount routes
app.use("/api/auth", authRoute);
app.use("/api/property", propertyRoute);
app.use("/api/tenant", tenantRoute);
app.use("/api/rent", rentRoute);
app.use("/api/bank", bankRoute);
app.use("/api/unit", unitRoute);
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
