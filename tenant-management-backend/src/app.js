import dotenv from "dotenv";
dotenv.config();
console.log(dotenv.config());

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import authRoute from "./modules/auth/auth.route.js";
import propertyRoute from "./modules/tenant/property.route.js";
import tenantRoute from "./modules/tenant/tenant.route.js";
import rentRoute from "./modules/rents/rent.route.js";
import bankRoute from "./modules/banks/bank.route.js";
import unitRoute from "./modules/tenant/units/unit.route.js";
import notificationRoute from "./modules/notifications/notification.route.js";
import paymentRoute from "./modules/payment/payment.route.js";
import ledgerRoute from "./modules/ledger/ledger.route.js";
import { connectDB } from "./config/db.js";
import revenueRoute from "./modules/revenue/revenue.route.js";
// 🚨 Only run cron jobs in production
if (process.env.NODE_ENV === "production") {
  await import("./cron/monthlyRent.cron.js");
  await import("./cron/monthlyEmail.cron.js");
}

const app = express();

/* -------------------- MIDDLEWARE -------------------- */
app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? false,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  })
);

app.use(cookieParser());
app.use(express.json());

/* -------------------- ROUTES -------------------- */
app.use("/api/auth", authRoute);
app.use("/api/property", propertyRoute);
app.use("/api/tenant", tenantRoute);
app.use("/api/rent", rentRoute);
app.use("/api/bank", bankRoute);
app.use("/api/unit", unitRoute);
app.use("/api/notification", notificationRoute);
app.use("/api/payment", paymentRoute);
app.use("/api/ledger", ledgerRoute);
app.use("/api/revenue", revenueRoute);
/* -------------------- HEALTH CHECK -------------------- */
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

/* -------------------- DB CONNECT -------------------- */
connectDB()
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB error:", err.message);
    process.exit(1);
  });

export default app;
