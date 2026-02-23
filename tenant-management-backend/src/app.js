import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import hpp from "hpp";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import authRoute from "./modules/auth/auth.route.js";
import propertyRoute from "./modules/property/property.route.js";
import tenantRoute from "./modules/tenant/tenant.route.js";
import rentRoute from "./modules/rents/rent.route.js";
import bankRoute from "./modules/banks/bank.route.js";
import unitRoute from "./modules/units/unit.route.js";
import notificationRoute from "./modules/notifications/notification.route.js";
import paymentRoute from "./modules/payment/payment.route.js";
import ledgerRoute from "./modules/ledger/ledger.route.js";
import { connectDB } from "./config/db.js";
import revenueRoute from "./modules/revenue/revenue.route.js";
import accountingRoute from "./modules/accounting/accounting.route.js";
import dashboardRoute from "./modules/dashboards/dashboard.route.js";
import electricityRoute from "./modules/electricity/electricity.route.js";
import camRoute from "./modules/cam/cam.route.js";
import expenseRoute from "./modules/expenses/expense.route.js";
import maintenanceRoute from "./modules/maintenance/maintenance.route.js";
import staffRoute from "./modules/staffs/staffs.route.js";
import broadcastRoute from "./modules/broadcasts/broadcast.route.js";
import escalationRoute from "./modules/tenant/escalation/rent.escalation.route.js";
import { startEscalationCron } from "./modules/tenant/escalation/crons/rent.escalation.cron.js";
import generatorRoute from "./modules/maintenance/generators/generator.route.js";
import searchRoute from "./modules/search/search.route.js";
import systemSettingRoute from "./modules/systemConfig/systemSetting.route.js";
import { masterCron } from "./cron/service/master-cron.js";
import pushRoute from "./modules/push/push.route.js";
import { sendTestNotification } from "./modules/push/push.controller.js";
import { initializeWebPush } from "./config/webpush.js";

initializeWebPush();
startEscalationCron();
masterCron();
const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://app.sallyanhouse.com",
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    if (process.env.NODE_ENV !== "production") {
      try {
        const u = new URL(origin);
        const isLocal =
          (u.hostname === "localhost" ||
            u.hostname === "127.0.0.1" ||
            u.hostname === "[::1]") &&
          (u.protocol === "http:" || u.protocol === "https:");
        if (isLocal) return callback(null, true);
      } catch (_) {}
    }
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  optionsSuccessStatus: 200,
};

// CORS must be first — handles OPTIONS preflight before anything else can block it
app.options("/{*path}", cors(corsOptions));
app.use(cors(corsOptions));

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

// Login limiter before the global /api limiter
const loginLimiter = rateLimit({
  max: 5,
  windowMs: 15 * 60 * 1000,
  message: "Too many login attempts, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/auth/login", loginLimiter);

const limiter = rateLimit({
  max: 100,
  windowMs: 60 * 1000,
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api", limiter);

app.use(hpp());
app.use(cookieParser());

app.use(express.json({ limit: "10kb" }));

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

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
app.use("/api/accounting", accountingRoute);
app.use("/api/dashboard", dashboardRoute);
app.use("/api/electricity", electricityRoute);
app.use("/api/cam", camRoute);
app.use("/api/expense", expenseRoute);
app.use("/api/maintenance", maintenanceRoute);
app.use("/api/maintenance/generator", generatorRoute);
app.use("/api/staff", staffRoute);
app.use("/api/broadcast", broadcastRoute);
app.use("/api/escalation", escalationRoute);
app.use("/api/search", searchRoute);
app.use("/api/settings", systemSettingRoute);
app.use("/api/push", pushRoute);
/* -------------------- TEST: push notification (POST body: { title, body }) -------------------- */
app.post("/send-notification", sendTestNotification);
/* -------------------- HEALTH CHECK -------------------- */
app.get("/api/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.use((err, req, res, next) => {
  console.error("🔥 ERROR:", err.stack);

  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({ message: "CORS error" });
  }

  res.status(500).json({
    message:
      process.env.NODE_ENV === "production"
        ? "Internal Server Error"
        : err.message,
  });
});

/* -------------------- DB CONNECT -------------------- */
connectDB()
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB error:", err.message);
    process.exit(1);
  });

export default app;
